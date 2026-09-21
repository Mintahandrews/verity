import type { Evidence, Signal, SignalResult } from '../types.ts';

/**
 * Claim checking: when media arrives with context text (caption, alt, nearby
 * copy), query Google Fact Check Tools for matching reviewed claims. A
 * false-rated match → negative (suspicious) — a claim debunked by independent
 * reviewers contradicts the content's implication.
 *
 * API key: extension reads chrome.storage.local.factCheckKey; the bot reads
 * process.env.FACT_CHECK_API_KEY. No key → 'unsupported' (documented, not error).
 */

const ENDPOINT = 'https://factchecktools.googleapis.com/v1alpha1/claims:search';
const MIN_CONTEXT = 30;

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

interface Claim {
  text?: string;
  claimant?: string;
  claimReview?: Array<{
    publisher?: { name?: string };
    url?: string;
    textualRating?: string;
    reviewDate?: string;
  }>;
}

export const factCheckSignal: Signal = {
  id: 'fact-check',
  name: 'Fact-check database',
  supports: () => true,
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };
    const text = media.contextText?.trim();

    if (!text || text.length < MIN_CONTEXT) {
      return {
        ...base,
        outcome: 'unsupported',
        confidence: 0,
        summary: 'No caption or surrounding text to check.',
        evidence: [],
      };
    }

    const key = await getApiKey();
    if (!key) {
      return {
        ...base,
        outcome: 'unsupported',
        confidence: 0,
        summary: 'No fact-check API key configured.',
        evidence: [
          { label: 'Set factCheckKey (extension storage) or FACT_CHECK_API_KEY (bot)' },
        ],
      };
    }

    const res = await fetch(
      `${ENDPOINT}?query=${encodeURIComponent(text.slice(0, 400))}&languageCode=en&key=${key}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error(`fact-check API failed: HTTP ${res.status}`);
    const { claims } = (await res.json()) as { claims?: Claim[] };

    if (!claims?.length) {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'No matching fact-checks found for the surrounding text.',
        evidence: [],
      };
    }

    const evidence: Evidence[] = [];
    let worst: 'negative' | 'positive' | 'neutral' = 'neutral';
    for (const claim of claims.slice(0, 3)) {
      for (const review of (claim.claimReview ?? []).slice(0, 2)) {
        const rating = review.textualRating ?? 'unrated';
        const outcome = classifyRating(rating);
        if (outcome === 'negative') worst = 'negative';
        else if (outcome === 'positive' && worst !== 'negative') worst = 'positive';
        evidence.push({
          label: `${review.publisher?.name ?? 'Fact-check'}: “${(claim.text ?? '').slice(0, 120)}” — ${rating}`,
          ...(review.url ? { detail: review.url } : {}),
        });
      }
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
            : `${claims.length} related fact-check(s) found — ratings inconclusive.`,
      evidence: evidence.slice(0, 5),
    };
  },
};
