import { Bot } from 'grammy';
import type { MediaKind, Verdict } from '@verity/core';
import { analyzeBuffer } from './pipeline.ts';
import { shutdownOcr } from './ocr.ts';
import { RateLimiter } from './ratelimit.ts';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required (from @BotFather)');
  process.exit(1);
}

const bot = new Bot(token);

// Per-user sliding window: generous enough for a group-chat fact-checker,
// tight enough to blunt scripted abuse before the API gets rate-limited upstream.
const limiter = new RateLimiter(
  Number(process.env.RATE_LIMIT_MAX ?? 30),
  Number(process.env.RATE_LIMIT_WINDOW_MS ?? 3_600_000),
);

const STATE_ICON: Record<Verdict['state'], string> = {
  verified: '✅',
  unverified: '❓',
  suspicious: '⚠️',
};

function kindOf(msg: {
  photo?: unknown;
  video?: unknown;
  animation?: unknown;
  document?: { mime_type?: string };
}): MediaKind {
  if (msg.photo) return 'image';
  if (msg.video || msg.animation) return 'video';
  const mime = msg.document?.mime_type ?? '';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'image';
}

function formatReply(v: Verdict): string {
  const lines = [`${STATE_ICON[v.state]} ${v.headline}`];
  for (const s of v.signals.filter((s) => s.outcome !== 'unsupported').slice(0, 4)) {
    lines.push(`• ${s.signalName}: ${s.summary}`);
  }
  if (v.shareUrl) lines.push('', v.shareUrl);
  return lines.join('\n');
}

const HELP = `Verity checks what can be *proven* about media - not vibes.

Send or forward me a photo or video and I'll report:
• Cryptographic provenance (C2PA Content Credentials)
• Generator fingerprints in file metadata
• Whether a matching claim was fact-checked false
• Whether the media was seen before (near-duplicate matching)

Verdicts: ✅ verified · ❓ unverified · ⚠️ suspicious
Unverified means provenance couldn't be confirmed - it does NOT mean the content is false.`;

bot.command('start', (ctx) =>
  ctx.reply(`${HELP}\n\nForward me something to check. 📎`),
);
bot.command('help', (ctx) => ctx.reply(HELP));

// Forwarded or fresh photos/videos/documents - the misinfo vector.
bot.on(['message:photo', 'message:video', 'message:document', 'message:animation'], async (ctx) => {
  const userId = ctx.from?.id ?? ctx.chat.id;
  if (!limiter.allow(userId)) {
    await ctx.reply(
      `You're checking faster than I can keep up - try again in ~${limiter.retryAfterSeconds(userId)}s.`,
    );
    return;
  }
  try {
    const file = await ctx.getFile(); // bot API limit: 20MB download
    if (!file.file_path) {
      await ctx.reply('Could not fetch that file from Telegram (over the 20MB bot limit?).');
      return;
    }
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const buf = Buffer.from(await (await fetch(fileUrl)).arrayBuffer());
    const verdict = await analyzeBuffer(
      kindOf(ctx.message),
      fileUrl,
      buf,
      ctx.message.caption ?? undefined,
    );
    await ctx.reply(formatReply(verdict), {
      link_preview_options: { is_disabled: true },
    });
  } catch (e) {
    await ctx.reply(`Check failed: ${e instanceof Error ? e.message : String(e)}`);
  }
});

bot.on('message', (ctx) =>
  ctx.reply('Send or forward me a photo or video - I’ll tell you what can be verified.'),
);

const shutdown = async (): Promise<void> => {
  bot.stop();
  await shutdownOcr();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

void bot.start();
console.log('verity bot running (long polling)');
