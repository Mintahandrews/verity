import { Bot } from 'grammy';
import type { MediaKind, Verdict } from '@verity/core';
import { analyzeBuffer } from './pipeline.ts';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required (from @BotFather)');
  process.exit(1);
}

const bot = new Bot(token);

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

// Forwarded or fresh photos/videos/documents — the misinfo vector.
bot.on(['message:photo', 'message:video', 'message:document', 'message:animation'], async (ctx) => {
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
  ctx.reply('Send or forward me a photo or video — I’ll tell you what can be verified.'),
);

void bot.start();
console.log('verity bot running (long polling)');
