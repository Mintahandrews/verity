import type { SignalResult, Verdict, VerdictState } from './types.ts';

const HEADLINES: Record<VerdictState, string> = {
  verified: 'Verified — cryptographic provenance confirmed',
  unverified: 'Unverified — not enough evidence to confirm or refute',
  suspicious: 'Suspicious — evidence contradicts this media',
};

/**
 * Fuse signal results into a verdict.
 *
 * Rules (see AGENTS.md):
 * - Any credible negative → suspicious. Real media with false context is the
 *   #1 misinfo pattern, so a contradiction always dominates a valid signature.
 * - Only conclusive (cryptographic) positives → verified.
 * - Everything else → unverified. Never "fake".
 */
export function fuse(results: SignalResult[], now = new Date()): Verdict {
  const active = results.filter((r) => r.outcome !== 'unsupported' && r.outcome !== 'error');
  const negatives = active.filter((r) => r.outcome === 'negative');
  const conclusivePositive = active.find((r) => r.outcome === 'positive' && r.conclusive);

  let state: VerdictState;
  let confidence: number;
  if (negatives.length > 0) {
    state = 'suspicious';
    confidence = Math.max(...negatives.map((r) => r.confidence));
  } else if (conclusivePositive) {
    state = 'verified';
    confidence = conclusivePositive.confidence;
  } else {
    state = 'unverified';
    confidence = 0;
  }

  return { state, confidence, headline: HEADLINES[state], signals: results, checkedAt: now.toISOString() };
}

/** A verdict-shaped record for when analysis itself failed — keeps the card clickable. */
export function errorVerdict(message: string, now = new Date()): Verdict {
  return {
    state: 'unverified',
    confidence: 0,
    headline: 'This check could not run',
    signals: [
      {
        signalId: 'fetch',
        signalName: 'Media retrieval',
        outcome: 'error',
        confidence: 0,
        summary: 'Verity could not obtain the media bytes to analyze.',
        evidence: [{ label: message }],
      },
    ],
    checkedAt: now.toISOString(),
    error: message,
  };
}
