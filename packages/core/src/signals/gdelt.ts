import type { Evidence, Signal, SignalResult } from '../types.ts';
import { hasBreakingMarkers, keywordsFrom } from './claimtext.ts';

const API = 'https://api.gdeltproject.org/api/v2/doc/doc';
const TIMEOUT_MS = 8000;
const STALE_DAYS = 30;

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string; // "20240115T123000Z"
  domain?: string;
}

/** "20240115T123000Z" → Date, or null. */
export function parseSeenDate(s: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Build the GDELT query string from context text - exported for tests. */
export function gdeltQuery(contextText: string): string {
  return keywordsFrom(contextText, 6).join(' ');
}

/**
 * GDELT DOC 2.0 coverage check. Free, keyless, global news index. For media
 * shared as "breaking", stale-or-absent coverage of the same claim is the
 * signature of a recycled event. Evidence stays reader-facing: article count,
 * earliest coverage in the window, top outlets.
 */
export const gdeltSignal: Signal = {
  id: 'gdelt',
  name: 'News coverage (GDELT)',
  supports: (m) => !!m.contextText?.trim(),
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };
    const query = gdeltQuery(media.contextText ?? '');
    if (query.length < 8) {
      return {
        ...base,
        outcome: 'unsupported',
        confidence: 0,
        summary: 'Not enough context text to check news coverage.',
        evidence: [],
      };
    }

    try {
      // No sort param: GDELT enforces ~1 req/5s per IP and returns plain-text
      // errors (fails soft below). We take the earliest seendate client-side
      // across whatever ranking comes back.
      const q = new URLSearchParams({
        query,
        mode: 'artlist',
        maxrecords: '25',
        format: 'json',
        timespan: '3m',
      });
      const res = await fetch(`${API}?${q}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`gdelt ${res.status}`);
      const body = (await res.json()) as { articles?: GdeltArticle[] };
      const articles = body.articles ?? [];

      if (articles.length === 0) {
        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary: 'No global news coverage matches this claim in the last 3 months.',
          evidence: [{ label: `Query: ${query}` }],
        };
      }

      const dates = articles
        .map((a) => (a.seendate ? parseSeenDate(a.seendate) : null))
        .filter((d): d is Date => !!d)
        .sort((a, b) => a.getTime() - b.getTime());
      const earliest = dates[0];
      const domains = [...new Set(articles.map((a) => a.domain).filter(Boolean))].slice(0, 3);
      const evidence: Evidence[] = [
        { label: `${articles.length} matching article(s) in the last 3 months` },
        ...(earliest
          ? [{ label: 'Earliest coverage', detail: earliest.toISOString().slice(0, 10) }]
          : []),
        ...(domains.length ? [{ label: 'Outlets', detail: domains.join(', ') }] : []),
      ];

      if (earliest && hasBreakingMarkers(media.contextText)) {
        const ageDays = (Date.now() - earliest.getTime()) / 86_400_000;
        if (ageDays > STALE_DAYS) {
          return {
            ...base,
            outcome: 'negative',
            confidence: 0.4,
            summary:
              'The claimed event was covered weeks ago - presented as new/breaking, this looks recycled.',
            evidence,
          };
        }
      }

      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'News coverage of this claim exists.',
        evidence,
      };
    } catch {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'News coverage check unavailable.',
        evidence: [],
      };
    }
  },
};
