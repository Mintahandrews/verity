import { detectAiSignatures } from '../aisignatures.ts';
import type { Signal, SignalResult } from '../types.ts';

/**
 * Deterministic layer of the AI-detection ensemble: scans file bytes for
 * generator fingerprints (PNG tEXt "parameters"/"workflow" chunks, EXIF/XMP
 * software markers). High precision, no model. Absence is neutral — most
 * AI images ship stripped metadata.
 */
export const aiMetadataSignal: Signal = {
  id: 'ai-metadata',
  name: 'Generator signatures',
  supports: (m) => m.kind === 'image',
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };
    const hits = detectAiSignatures(new Uint8Array(await media.blob.arrayBuffer()));
    if (hits.length === 0) {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'No generator fingerprints in the file metadata.',
        evidence: [],
      };
    }
    return {
      ...base,
      outcome: 'positive',
      confidence: 0.9,
      summary: `File metadata declares AI generation: ${hits.map((h) => h.generator).join(', ')}.`,
      evidence: hits.map((h) => ({ label: h.generator, detail: h.location })),
    };
  },
};
