import type { Evidence, MediaInput, Signal, SignalResult } from '../types.ts';

/**
 * Claim checking: when media arrives with context (caption, alt, nearby copy,
 * or a hosting page URL), match it against reviewed-claim sources. A
 * false-rated match → negative (suspicious): a claim debunked by independent
 * reviewers contradicts the content's implication.
 *
 * Providers (all fail-soft — an unreachable source just contributes nothing):
 *  - Google Fact Check Tools API — needs a key: extension reads
 *    chrome.storage.local.factCheckKey, bot reads env FACT_CHECK_API_KEY.
 *  - ClaimReview JSON-LD — keyless: fetches URLs found in the context (or
 *    media.pageUrl) and parses schema.org ClaimReview markup. Covers the
 *    common case where the page hosting the media IS a fact-check article.
 */

const MIN_CONTEXT = 30;
const MAX_URL_FETCH_BYTES = 512 * 1024;

export interface FactCheckMatch {
  claim: string;
  rating: string;
  publisher: string;
  url?: string;
}

type Provider = (media: MediaInput) => Promise<FactCheckMatch[]>;

export function classifyRating(rating: string): 'negative' | 'positive' | 'neutral' {
  const r = rating.toLowerCase();
  if (
    /(false|pants on fire|incorrect|misleading|fake|hoax|fabricat|altered|manipulated|out of context|miscaptioned|scam|satire presented as)/.test(
      r,
    )
  ) {
    return 'negative';
  }
  if (/(true|correct|accurate|authentic)/.test(r)) return 'positive';
  return 'neutral';
}

async function getApiKey(): Promise<string | undefined> {
  const g = globalThis as {
    chrome?: { storage?: { local?: { get(k: string): Promise<Record<string, string>> } } };
    process?: { env?: Record<string, string | undefined> };
  };
  if (g.chrome?.storage?.local) {
    return (await g.chrome.storage.local.get('factCheckKey')).factCheckKey;
  }
  return g.process?.env?.FACT_CHECK_API_KEY;
}

interface GoogleClaim {
  text?: string;
  claimReview?: Array<{
    publisher?: { name?: string };
    url?: string;
    textualRating?: string;
  }>;
}

const googleProvider: Provider = async (media) => {
  const key = await getApiKey();
  const text = media.contextText?.trim();
  if (!key || !text || text.length < MIN_CONTEXT) return [];
  const res = await fetch(
    `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(text.slice(0, 400))}&languageCode=en&key=${key}`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!res.ok) throw new Error(`fact-check API failed: HTTP ${res.status}`);
  const { claims } = (await res.json()) as { claims?: GoogleClaim[] };
  return (claims ?? []).flatMap((c) =>
    (c.claimReview ?? []).map((r) => ({
      claim: c.text ?? '',
      rating: r.textualRating ?? 'unrated',
      publisher: r.publisher?.name ?? 'Fact-check',
      ...(r.url ? { url: r.url } : {}),
    })),
  );
};

// ——— ClaimReview JSON-LD provider ———

interface ClaimReviewNode {
  '@type'?: string | string[];
  claimReviewed?: string;
  reviewRating?: { ratingValue?: number; alternateName?: string; ratingExplanation?: string };
  author?: { name?: string };
  url?: string;
}

function* walkJsonLd(node: unknown): Generator<ClaimReviewNode> {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) yield* walkJsonLd(n);
    return;
  }
  const o = node as ClaimReviewNode & { '@graph'?: unknown };
  const types = Array.isArray(o['@type']) ? o['@type'] : [o['@type']];
  if (types.includes('ClaimReview')) yield o;
  if (o['@graph']) yield* walkJsonLd(o['@graph']);
}

export function claimReviewMatches(html: string): FactCheckMatch[] {
  const out: FactCheckMatch[] = [];
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const json = block.replace(/<[^>]+>/g, '').trim();
    try {
      for (const cr of walkJsonLd(JSON.parse(json))) {
        const rating =
          cr.reviewRating?.alternateName ?? cr.reviewRating?.ratingExplanation ?? '';
        out.push({
          claim: (cr.claimReviewed ?? '').slice(0, 160),
          rating,
          publisher: cr.author?.name ?? 'Fact-check page',
          ...(cr.url ? { url: cr.url } : {}),
        });
      }
    } catch {
      /* malformed JSON-LD — skip */
    }
  }
  return out;
}

const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;

const claimReviewProvider: Provider = async (media) => {
  const urls = new Set<string>();
  if (media.pageUrl && /^https?:/.test(media.pageUrl)) urls.add(media.pageUrl);
  for (const m of media.contextText?.match(URL_RE) ?? []) urls.add(m);

  const matches: FactCheckMatch[] = [];
  for (const pageUrl of [...urls].slice(0, 2)) {
    try {
      const res = await fetch(pageUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { accept: 'text/html' },
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('html')) continue;
      const reader = res.body?.getReader();
      if (!reader) continue;
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_URL_FETCH_BYTES) break;
        chunks.push(value);
      }
      const html = new Uint8Array(size);
      let off = 0;
      for (const c of chunks) {
        html.set(c, off);
        off += c.length;
      }
      matches.push(...claimReviewMatches(new TextDecoder().decode(html)));
      if (matches.length >= 6) break;
    } catch {
      /* unreachable page — skip */
    }
  }
  return matches;
};

const PROVIDERS: Provider[] = [googleProvider, claimReviewProvider];

export const factCheckSignal: Signal = {
  id: 'fact-check',
  name: 'Fact-check database',
  supports: () => true,
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };
    const text = media.contextText?.trim();
    // Non-global regex for the test — URL_RE is /g and .test mutates lastIndex.
    const hasUrl =
      (media.pageUrl && /^https?:/.test(media.pageUrl)) ||
      /https?:\/\/[^\s"'<>)\]]+/.test(text ?? '');

    if ((!text || text.length < MIN_CONTEXT) && !hasUrl) {
      return {
        ...base,
        outcome: 'unsupported',
        confidence: 0,
        summary: 'No caption or surrounding text to check.',
        evidence: [],
      };
    }

    const matches: FactCheckMatch[] = [];
    for (const provider of PROVIDERS) {
      try {
        matches.push(...(await provider(media)));
      } catch {
        /* provider failed — others may still contribute */
      }
    }

    if (!matches.length) {
      const keyConfigured = Boolean(await getApiKey());
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: keyConfigured
          ? 'No matching fact-checks found for the surrounding text.'
          : 'No matching fact-checks found. (No fact-check API key configured — only ClaimReview markup was checked.)',
        evidence: keyConfigured
          ? []
          : [{ label: 'Set factCheckKey / FACT_CHECK_API_KEY for claim search' }],
      };
    }

    const evidence: Evidence[] = [];
    let worst: 'negative' | 'positive' | 'neutral' = 'neutral';
    for (const m of matches.slice(0, 8)) {
      const outcome = classifyRating(m.rating);
      if (outcome === 'negative') worst = 'negative';
      else if (outcome === 'positive' && worst !== 'negative') worst = 'positive';
      evidence.push({
        label: `${m.publisher}: “${m.claim.slice(0, 120)}” — ${m.rating}`,
        ...(m.url ? { detail: m.url } : {}),
      });
    }

    return {
      ...base,
      outcome: worst === 'neutral' ? 'neutral' : worst,
      confidence: worst === 'negative' ? 0.75 : worst === 'positive' ? 0.5 : 0,
      summary:
        worst === 'negative'
          ? 'Independent fact-checks rate a matching claim as false or misleading.'
          : worst === 'positive'
            ? 'Fact-checks corroborate a matching claim.'
            : `${matches.length} related fact-check(s) found — ratings inconclusive.`,
      evidence: evidence.slice(0, 5),
    };
  },
};
