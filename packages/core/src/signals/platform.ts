import type { Signal, SignalResult } from '../types.ts';

/**
 * Known social-platform media CDNs. Uploading to these strips EXIF and C2PA
 * provenance by design, so their absence says nothing about authenticity -
 * the useful evidence is prior sightings and fact-checks. Naming the platform
 * explains the empty forensic results instead of leaving a bare "unverified".
 */
const PLATFORM_HOSTS: Array<[RegExp, string]> = [
  [/\.ytimg\.com$|\.googlevideo\.com$/, 'YouTube'],
  [/\.twimg\.com$|\.twitter\.com$|\.x\.com$/, 'X (Twitter)'],
  [/\.cdninstagram\.com$|\.fbcdn\.net$|\.facebook\.com$|\.instagram\.com$/, 'Meta (Facebook/Instagram)'],
  [/\.redd\.it$|\.reddit\.com$/, 'Reddit'],
  [/\.tiktokcdn[a-z0-9.-]*\.com$|\.tiktok\.com$/, 'TikTok'],
  [/\.pinimg\.com$|\.pinterest\.com$/, 'Pinterest'],
  [/\.sc-cdn\.net$|\.snapchat\.com$/, 'Snapchat'],
  [/\.discordapp\.com$|\.discord\.com$|\.media\.discordapp\.net$/, 'Discord'],
  [/\.whatsapp\.net$|\.whatsapp\.com$/, 'WhatsApp'],
  [/\.telegram\.org$|\.t\.me$|\.telesco\.pe$/, 'Telegram'],
];

/** Exported for tests. */
export function platformFor(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PLATFORM_HOSTS.find(([re]) => re.test(host))?.[1] ?? null;
  } catch {
    return null;
  }
}

export const platformSignal: Signal = {
  id: 'platform',
  name: 'Platform re-upload',
  supports: (m) => platformFor(m.url) !== null,
  async analyze(media): Promise<SignalResult> {
    const platform = platformFor(media.url)!;
    const host = new URL(media.url).hostname;
    return {
      signalId: this.id,
      signalName: this.name,
      outcome: 'neutral',
      confidence: 0,
      summary: `Served from ${platform}'s CDN. Social platforms strip metadata and provenance on upload, so a missing signature here is expected - not evidence of manipulation.`,
      evidence: [
        { label: `Media host: ${host}` },
        {
          label: 'What matters here',
          detail:
            'Prior sightings and fact-check matches carry the most weight for platform-hosted media.',
        },
      ],
    };
  },
};
