import type { Evidence, Signal, SignalResult } from '@verity/core';

/**
 * Reverse image search — the "real photo, wrong context" detector.
 * Default adapter: Google Lens uploadbyurl (free, unofficial, brittle —
 * parses result HTML and degrades gracefully when Google changes markup or
 * rate-limits). For a production deployment, swap in TinEye/Bing Visual
 * Search behind the same signal shape.
 *
 * Privacy: sends the media URL (not bytes) to Google. Only runs on public
 * http(s) URLs and only when the user enables it — popup toggle writes
 * chrome.storage.local.reverseSearch.
 */

const DATE_RE = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/g;

function extractLens(html: string): { count: number; earliest?: string } {
  // Count external result links — Lens results live in <a> tags off-domain.
  const links = html.match(/<a [^>]*href="https?:\/\/(?!lens\.google|www\.google|accounts\.google)[^"]*"/g) ?? [];
  const dates = html.match(DATE_RE) ?? [];
  const parsed = dates
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  return {
    count: links.length,
    ...(parsed[0] ? { earliest: new Date(parsed[0]).toISOString().slice(0, 10) } : {}),
  };
}

export const reverseSearchSignal: Signal = {
  id: 'reverse-search',
  name: 'Reverse image search',
  supports: (m) => m.kind === 'image' && /^https?:/.test(m.url),
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };
    const { reverseSearch } = (await chrome.storage.local.get('reverseSearch')) as {
      reverseSearch?: boolean;
    };
    if (!reverseSearch) {
      return {
        ...base,
        outcome: 'unsupported',
        confidence: 0,
        summary: 'Reverse search is off — enable it in the extension popup.',
        evidence: [],
      };
    }

    const res = await fetch(
      `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(media.url)}`,
      { credentials: 'omit', redirect: 'follow' },
    );
    if (!res.ok) throw new Error(`Lens request failed: HTTP ${res.status}`);
    const { count, earliest } = extractLens(await res.text());

    if (count === 0) {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'No other sightings of this image found.',
        evidence: [],
      };
    }

    const evidence: Evidence[] = [
      { label: `Found on ~${count} other pages`, detail: 'Google Lens' },
      ...(earliest ? [{ label: 'Earliest indexed sighting', detail: earliest }] : []),
    ];
    // A much older first-sighting relative to a "breaking news" context is the
    // classic miscontextualization tell — surfaced as evidence for the reader.
    return {
      ...base,
      outcome: 'neutral',
      confidence: 0,
      summary: `This image appears on ~${count} other pages${earliest ? `, earliest seen ${earliest}` : ''}.`,
      evidence,
    };
  },
};
