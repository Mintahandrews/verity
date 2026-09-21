import exifr from 'exifr';
import type { Evidence, Signal, SignalResult } from '@verity/core';

/**
 * Metadata forensics. Deliberately conservative: stripped EXIF is the norm after
 * social-media re-uploads, so absence is neutral — never negative.
 */
export const metadataSignal: Signal = {
  id: 'metadata',
  name: 'Metadata forensics',
  supports: (m) => m.kind === 'image',
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };
    const data = (await exifr
      .parse(media.blob, { gps: true, translateValues: true })
      .catch(() => undefined)) as Record<string, unknown> | undefined;

    if (!data || Object.keys(data).length === 0) {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'No embedded metadata — normal after a social-media re-upload.',
        evidence: [],
      };
    }

    const evidence: Evidence[] = [];
    let outcome: SignalResult['outcome'] = 'neutral';
    let confidence = 0;

    const camera = [data.Make, data.Model].filter(Boolean).join(' ');
    if (camera) {
      evidence.push({ label: `Camera: ${camera}` });
      outcome = 'positive';
      confidence = 0.3; // weak positive — metadata is trivially editable
    }
    if (data.Software || data.ProcessingSoftware) {
      evidence.push({ label: `Processed by ${data.Software ?? data.ProcessingSoftware}` });
    }
    if (data.DateTimeOriginal) {
      evidence.push({ label: `Original timestamp: ${new Date(data.DateTimeOriginal as string).toISOString()}` });
    }
    if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      evidence.push({ label: 'Contains GPS location data' });
    }

    // Structural contradiction: modification predates creation.
    const created = data.DateTimeOriginal ? new Date(data.DateTimeOriginal as string).getTime() : NaN;
    const modified = data.ModifyDate ? new Date(data.ModifyDate as string).getTime() : NaN;
    if (Number.isFinite(created) && Number.isFinite(modified) && modified < created) {
      outcome = 'negative';
      confidence = 0.4;
      evidence.push({ label: 'Timestamp inconsistency: modified before created' });
    }

    return {
      ...base,
      outcome,
      confidence,
      summary:
        outcome === 'positive'
          ? 'Camera metadata present (weak signal — metadata is editable).'
          : outcome === 'negative'
            ? 'Metadata contains inconsistencies.'
            : 'Metadata present but inconclusive.',
      evidence,
    };
  },
};
