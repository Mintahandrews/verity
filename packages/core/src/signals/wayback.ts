import type { Evidence, Signal, SignalResult } from '../types.ts';
import { hasBreakingMarkers } from './claimtext.ts';

const CDX = 'https://web.archive.org/cdx/search/cdx';
const RECYCLED_DAYS = 30;
const TIMEOUT_MS = 8000;

/** "20200101123456" → Date, or null. */
export function parseCdxTimestamp(ts: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(ts);
  if (!m) return null;
  const d = new Date(
    Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Earliest snapshot timestamp for a URL, or null. CDX sorts ascending by default. */
async function firstSnapshot(url: string): Promise<{ ts: Date; original: string } | null> {
  const q = new URLSearchParams({
    url,
    output: 'json',
    limit: '1',
    fl: 'timestamp,original',
    filter: 'statuscode:200',
    collapse: 'digest',
  });
  const res = await fetch(`${CDX}?${q}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  const rows = (await res.json()) as string[][];
  const row = rows[1]; // row 0 is the header
  if (!row?.[0]) return null;
  const ts = parseCdxTimestamp(row[0]);
  return ts ? { ts, original: row[1] ?? url } : null;
}

/**
 * Wayback Machine first-sighting. The classic misinfo pattern is real media
 * recirculated with a new claim - an archived copy that predates the claimed
 * "breaking" context is direct evidence of recycling.
 *
 * Sends only the media URL to archive.org (same class as reverse search, but
 * the Internet Archive is a nonprofit library - no opt-in gate needed).
 * Skips blob:/data: URLs and Telegram file URLs (they embed the bot token).
 */
export const waybackSignal: Signal = {
  id: 'wayback',
  name: 'Web archive sightings',
  supports: (m) => /^https?:\/\//.test(m.url) && !/api\.telegram\.org/.test(m.url),
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };

    try {
      // Exact URL first; fall back to the URL without query (CDN signatures
      // and tracking params often break exact matches in the index).
      const u = new URL(media.url);
      const variants = [media.url];
      if (u.search) variants.push(u.origin + u.pathname);

      let hit: { ts: Date; original: string } | null = null;
      for (const v of variants) {
        hit = await firstSnapshot(v);
        if (hit) break;
      }

      if (!hit) {
        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary: 'No archived copies of this media URL found.',
          evidence: [],
        };
      }

      const evidence: Evidence[] = [
        { label: 'First archived', detail: hit.ts.toISOString().slice(0, 10) },
      ];
      const ageDays = (Date.now() - hit.ts.getTime()) / 86_400_000;

      // "Breaking" context + an archive record far older = recycled media.
      if (hasBreakingMarkers(media.contextText) && ageDays > RECYCLED_DAYS) {
        return {
          ...base,
          outcome: 'negative',
          confidence: 0.5,
          summary:
            'This URL was archived well before the claimed timeframe - likely recirculated media.',
          evidence: [...evidence, { label: 'Context claims this is new/breaking media' }],
        };
      }

      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: `This exact media URL was first archived ${hit.ts.toISOString().slice(0, 10)}.`,
        evidence,
      };
    } catch {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'Web archive check unavailable.',
        evidence: [],
      };
    }
  },
};
