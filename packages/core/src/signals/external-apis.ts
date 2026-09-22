import type { Evidence, Signal, SignalResult } from '../types.ts';
import { hasBreakingMarkers } from './claimtext.ts';

const TIMEOUT_MS = 10_000;

/**
 * Optional third-party integrations, activated only when the operator
 * provides API keys. All three upload media bytes or text to the provider,
 * so they are wired opt-in (env vars on the bot/registry side) and never
 * part of the local-first default path.
 */

interface SauceResult {
  header?: { similarity?: string };
  data?: { ext_urls?: string[]; title?: string };
}

/** Similarity percent of the strongest SauceNAO hit. Exported for tests. */
export function bestSauceSimilarity(results: SauceResult[] | undefined): number {
  let best = 0;
  for (const r of results ?? []) {
    const s = Number(r.header?.similarity ?? 0);
    if (s > best) best = s;
  }
  return best;
}

/**
 * SauceNAO reverse-image search (free key from saucenao.com). Unlike the
 * Google Lens deep-link this actually returns structured prior sightings.
 * Uploads the media itself - opt-in only.
 */
export function createSauceNaoSignal(apiKey: string): Signal {
  return {
    id: 'saucenao',
    name: 'Reverse search (SauceNAO)',
    supports: (m) => m.kind === 'image',
    async analyze(media): Promise<SignalResult> {
      const base = { signalId: this.id, signalName: this.name };
      try {
        const form = new FormData();
        form.set('output_type', '2');
        form.set('api_key', apiKey);
        form.set('numres', '5');
        form.set('db', '999');
        form.set('file', media.blob, 'media.jpg');
        const res = await fetch('https://saucenao.com/search.php', {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`saucenao ${res.status}`);
        const j = (await res.json()) as { results?: SauceResult[] };
        const sim = bestSauceSimilarity(j.results);
        const hit = j.results?.[0];
        const src = hit?.data?.ext_urls?.[0];

        if (sim < 70) {
          return {
            ...base,
            outcome: 'neutral',
            confidence: 0,
            summary: 'No strong matches in reverse-image search.',
            evidence: [],
          };
        }

        const evidence: Evidence[] = [
          { label: 'Closest match', detail: `${sim.toFixed(0)}% similar` },
          ...(src ? [{ label: 'Earlier source', detail: src }] : []),
        ];
        if (hasBreakingMarkers(media.contextText)) {
          return {
            ...base,
            outcome: 'negative',
            confidence: 0.45,
            summary: 'This image already circulates online while the context claims it is new/breaking.',
            evidence,
          };
        }
        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary: `Found online: closest match ${sim.toFixed(0)}% similar.`,
          evidence,
        };
      } catch {
        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary: 'Reverse-image search unavailable.',
          evidence: [],
        };
      }
    },
  };
}

interface SightengineResponse {
  type?: { ai_generated?: number };
}

/**
 * Sightengine AI-generation check (free tier ~500 ops/mo) as a second
 * opinion alongside the local ONNX detector. Negative-only by design -
 * a "real" score never contributes to verified. Uploads media - opt-in.
 */
export function createSightengineSignal(apiUser: string, apiSecret: string): Signal {
  return {
    id: 'sightengine',
    name: 'AI detection (Sightengine)',
    supports: (m) => m.kind === 'image',
    async analyze(media): Promise<SignalResult> {
      const base = { signalId: this.id, signalName: this.name };
      try {
        const form = new FormData();
        form.set('models', 'genai');
        form.set('api_user', apiUser);
        form.set('api_secret', apiSecret);
        form.set('media', media.blob, 'media.jpg');
        const res = await fetch('https://api.sightengine.com/1.0/check.json', {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`sightengine ${res.status}`);
        const j = (await res.json()) as SightengineResponse;
        const score = j.type?.ai_generated;
        if (score === undefined) throw new Error('no score');

        const evidence: Evidence[] = [
          { label: 'AI-generated score', detail: score.toFixed(2) },
          { label: 'AI detectors are heuristic - treat as a flag, not proof' },
        ];
        if (score >= 0.7) {
          return {
            ...base,
            outcome: 'negative',
            confidence: 0.4,
            summary: 'Independent detector rates this image as likely AI-generated.',
            evidence,
          };
        }
        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary: `Detector score ${score.toFixed(2)} - below the flag threshold.`,
          evidence,
        };
      } catch {
        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary: 'External AI detection unavailable.',
          evidence: [],
        };
      }
    },
  };
}

/**
 * ClaimBuster check-worthiness scoring (free key via claimbuster.org).
 * Informational only: a claim being check-worthy says nothing about truth,
 * so this never goes negative - it labels which claims deserve scrutiny.
 * Sends the caption/OCR text only, not media.
 */
export function createClaimBusterSignal(apiKey: string): Signal {
  return {
    id: 'claimbuster',
    name: 'Claim-worthiness',
    supports: (m) => !!m.contextText,
    async analyze(media): Promise<SignalResult> {
      const base = { signalId: this.id, signalName: this.name };
      try {
        const text = media.contextText!.slice(0, 500);
        const res = await fetch(
          `https://idir.uta.edu/claimbuster/api/v2/score/text/${encodeURIComponent(text)}`,
          {
            headers: { 'x-api-key': apiKey },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          },
        );
        if (!res.ok) throw new Error(`claimbuster ${res.status}`);
        const j = (await res.json()) as {
          score?: number;
          results?: Array<{ score?: number }>;
        };
        const score = j.score ?? j.results?.[0]?.score;
        if (score === undefined) throw new Error('no score');

        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary:
            score >= 0.6
              ? `Context contains a check-worthy claim (score ${score.toFixed(2)}).`
              : `No strongly check-worthy claim in the context (score ${score.toFixed(2)}).`,
          evidence: [{ label: 'ClaimBuster check-worthiness', detail: score.toFixed(2) }],
        };
      } catch {
        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary: 'Claim-worthiness check unavailable.',
          evidence: [],
        };
      }
    },
  };
}
