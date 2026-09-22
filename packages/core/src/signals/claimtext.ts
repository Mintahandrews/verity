/**
 * Shared helpers for reading claim-like context text (captions, OCR output).
 * Used by the wayback, GDELT and geolocation signals.
 */

/** Markers that the surrounding text presents the media as new/breaking. */
const BREAKING_RE =
  /\b(breaking|just in|just now|happening now|happening right now|live|developing|urgent|today|this morning|this evening|tonight|yesterday|earlier today)\b/i;

export function hasBreakingMarkers(text?: string): boolean {
  return !!text && BREAKING_RE.test(text);
}

const TWEET_RE = /(?:twitter\.com|x\.com)\/[A-Za-z0-9_]+\/status(?:es)?\/(\d{5,25})/g;

/** Deduped tweet status IDs found in URLs or free text. */
export function tweetIdsFrom(...texts: Array<string | undefined>): string[] {
  const ids = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const m of t.matchAll(TWEET_RE)) ids.add(m[1]!);
  }
  return [...ids];
}

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'been', 'were', 'they', 'their',
  'there', 'here', 'what', 'when', 'where', 'which', 'while', 'about',
  'after', 'before', 'just', 'like', 'will', 'would', 'could', 'should',
  'into', 'over', 'under', 'then', 'than', 'them', 'these', 'those',
  'video', 'photo', 'image', 'footage', 'watch', 'breaking', 'news',
  'today', 'yesterday', 'tonight', 'morning', 'evening', 'urgent', 'live',
  'https', 'http', 'www', 'com',
]);

/**
 * Build a compact keyword query from free text: deduped, stopword-free,
 * longest-first. GDELT ANDs space-separated terms.
 */
export function keywordsFrom(text: string, max = 6): string[] {
  const seen = new Set<string>();
  const words = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w) && !seen.has(w) && seen.add(w));
  return words.sort((a, b) => b.length - a.length).slice(0, max);
}
