import { sha1Hex } from '../hash.ts';
import type { Evidence, Signal, SignalResult } from '../types.ts';
import { hasBreakingMarkers } from './claimtext.ts';

const API = 'https://commons.wikimedia.org/w/api.php';
const RECYCLED_DAYS = 30;
const TIMEOUT_MS = 8000;

interface CommonsResponse {
  query?: {
    allimages?: Array<{ name: string; timestamp?: string; url?: string }>;
  };
}

/** First Commons upload timestamp in the response, or null. Exported for tests. */
export function firstUpload(j: CommonsResponse): { name: string; ts: Date } | null {
  const img = j.query?.allimages?.[0];
  if (!img?.timestamp) return null;
  const ts = new Date(img.timestamp);
  return Number.isNaN(ts.getTime()) ? null : { name: img.name, ts };
}

/**
 * Wikimedia Commons prior-sighting. Commons indexes files by SHA-1, so an
 * exact-content lookup needs only the hash - no media or URL leaves the
 * device beyond a content digest (same privacy class as registry lookup).
 * A Commons upload that predates a "breaking" claim is recycled-media evidence.
 */
export const commonsSignal: Signal = {
  id: 'commons',
  name: 'Wikimedia sightings',
  supports: (m) => m.kind === 'image' || m.kind === 'video',
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };

    try {
      const sha1 = await sha1Hex(await media.blob.arrayBuffer());
      const q = new URLSearchParams({
        action: 'query',
        list: 'allimages',
        aisha1: sha1,
        aiprop: 'name|timestamp|url',
        ailimit: '1',
        format: 'json',
        origin: '*',
      });
      const res = await fetch(`${API}?${q}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`commons ${res.status}`);
      const hit = firstUpload((await res.json()) as CommonsResponse);

      if (!hit) {
        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary: 'No identical file on Wikimedia Commons.',
          evidence: [],
        };
      }

      const evidence: Evidence[] = [
        { label: 'On Wikimedia Commons', detail: hit.name },
        { label: 'Uploaded', detail: hit.ts.toISOString().slice(0, 10) },
      ];
      const ageDays = (Date.now() - hit.ts.getTime()) / 86_400_000;

      if (hasBreakingMarkers(media.contextText) && ageDays > RECYCLED_DAYS) {
        return {
          ...base,
          outcome: 'negative',
          confidence: 0.5,
          summary:
            'This exact file was on Wikimedia Commons well before the claimed timeframe - likely recirculated.',
          evidence: [...evidence, { label: 'Context claims this is new/breaking media' }],
        };
      }

      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: `Identical file uploaded to Wikimedia Commons on ${hit.ts.toISOString().slice(0, 10)}.`,
        evidence,
      };
    } catch {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'Wikimedia Commons check unavailable.',
        evidence: [],
      };
    }
  },
};
