import { Client, Events, GatewayIntentBits } from 'discord.js';
import type { MediaKind, Verdict } from '@checkverity/core';
import { analyzeBuffer } from './pipeline.ts';
import { shutdownOcr } from './ocr.ts';
import { RateLimiter } from './ratelimit.ts';

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('DISCORD_BOT_TOKEN is required (Discord Developer Portal -> Bot)');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const limiter = new RateLimiter(
  Number(process.env.RATE_LIMIT_MAX ?? 30),
  Number(process.env.RATE_LIMIT_WINDOW_MS ?? 3_600_000),
);
const MAX_BYTES = 25 * 1024 * 1024; // Discord's standard upload cap

const STATE_ICON: Record<Verdict['state'], string> = {
  verified: '✅',
  unverified: '❓',
  suspicious: '⚠️',
};
const STATE_COLOR: Record<Verdict['state'], number> = {
  verified: 0x26a200,
  unverified: 0x7e8371,
  suspicious: 0xd97706,
};

function kindOf(contentType: string | null | undefined): MediaKind | null {
  if (contentType?.startsWith('image/')) return 'image';
  if (contentType?.startsWith('video/')) return 'video';
  if (contentType?.startsWith('audio/')) return 'audio';
  return null;
}

const HELP = `**Verity** checks what can be *proven* about media - not vibes.
Attach an image or video (or DM me one) and I'll report C2PA provenance, metadata forensics, prior sightings, and fact-check evidence.
Verdicts: ✅ verified · ❓ unverified · ⚠️ suspicious — unverified means unproven, not false.`;

client.once(Events.ClientReady, (c) => console.log(`verity discord bot online as ${c.user.tag}`));

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;
  const attachment = [...msg.attachments.values()].find((a) => kindOf(a.contentType));

  // No media -> help on command, silence otherwise. '!verity' WITH an
  // attachment is a scan request, not a help request.
  if (!attachment) {
    if (/^!verity(\s+help)?$/i.test(msg.content.trim())) await msg.reply(HELP);
    return;
  }

  if (!limiter.allow(msg.author.id)) {
    await msg.reply(`You're checking faster than I can keep up - try again shortly.`);
    return;
  }
  if (attachment.size > MAX_BYTES) {
    await msg.reply('That file is too large to check (>25MB).');
    return;
  }

  try {
    await msg.channel.sendTyping();
    const res = await fetch(attachment.url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      await msg.reply(`Could not download the attachment (HTTP ${res.status}).`);
      return;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const verdict = await analyzeBuffer(
      kindOf(attachment.contentType)!,
      // CDN URLs are short-lived but public - the pipeline submits hashes
      // only, so nothing sensitive persists.
      attachment.url,
      buf,
      msg.content || undefined,
    );

    const fields = verdict.signals
      .filter((s) => s.outcome !== 'unsupported')
      .slice(0, 5)
      .map((s) => ({ name: s.signalName, value: s.summary.slice(0, 1024) }));
    await msg.reply({
      embeds: [
        {
          title: `${STATE_ICON[verdict.state]} ${verdict.headline}`.slice(0, 256),
          color: STATE_COLOR[verdict.state],
          fields,
          ...(verdict.shareUrl ? { url: verdict.shareUrl } : {}),
          footer: { text: 'unverified means unproven, not false · verity' },
        },
      ],
    });
  } catch (e) {
    await msg.reply(`Check failed: ${e instanceof Error ? e.message : String(e)}`);
  }
});

const shutdown = async (): Promise<void> => {
  client.destroy();
  await shutdownOcr();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

void client.login(token);
