import type { Evidence, Signal, SignalResult } from '../types.ts';

const MAX_DIM = 1024;
const REENCODE_QUALITY = 0.95;
const BLOCK = 8;

function isJpeg(type: string): boolean {
  return /jpe?g/i.test(type);
}

interface ElaStats {
  mean: number;
  max: number;
  /** Share of 8x8 blocks whose error exceeds 3x the global mean. */
  hotFraction: number;
}

/** Block-level error stats from two equal-size RGBA buffers. Exported for tests. */
export function elaStats(orig: Uint8ClampedArray, recon: Uint8ClampedArray, w: number, h: number): ElaStats | null {
  const bw = Math.floor(w / BLOCK);
  const bh = Math.floor(h / BLOCK);
  if (bw < 4 || bh < 4) return null;
  const blockErr = new Float64Array(bw * bh);
  let sum = 0;
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let acc = 0;
      for (let y = 0; y < BLOCK; y++) {
        for (let x = 0; x < BLOCK; x++) {
          const i = ((by * BLOCK + y) * w + bx * BLOCK + x) * 4;
          acc += (Math.abs(orig[i]! - recon[i]!) + Math.abs(orig[i + 1]! - recon[i + 1]!) + Math.abs(orig[i + 2]! - recon[i + 2]!)) / 3;
        }
      }
      const e = acc / (BLOCK * BLOCK);
      blockErr[by * bw + bx] = e;
      sum += e;
    }
  }
  const mean = sum / blockErr.length;
  const max = Math.max(...blockErr);
  const hot = blockErr.filter((e) => e > Math.max(3 * mean, 6)).length;
  return { mean, max, hotFraction: hot / blockErr.length };
}

/**
 * Error Level Analysis: re-encode the JPEG at q95 and diff per-8x8 block.
 * Regions edited after the last save recompress differently and show as
 * hotspots. Deliberately conservative - text-heavy memes raise error
 * uniformly (high mean, no hotspot fraction) so they stay neutral.
 * Requires canvas APIs; reports 'unsupported' where they don't exist (Node).
 */
export const elaSignal: Signal = {
  id: 'ela',
  name: 'Edit forensics (ELA)',
  supports: (m) =>
    m.kind === 'image' && typeof OffscreenCanvas !== 'undefined',
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };

    if (!isJpeg(media.blob.type)) {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'ELA applies to JPEG images only.',
        evidence: [],
      };
    }

    try {
      const bmp = await createImageBitmap(media.blob);
      const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
      const w = Math.max(BLOCK, Math.round(bmp.width * scale));
      const h = Math.max(BLOCK, Math.round(bmp.height * scale));

      const readPixels = async (b: Blob): Promise<Uint8ClampedArray | null> => {
        const i = await createImageBitmap(b);
        const c = new OffscreenCanvas(w, h);
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(i, 0, 0, w, h);
        i.close();
        return ctx.getImageData(0, 0, w, h).data;
      };

      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      const reconBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: REENCODE_QUALITY });

      const orig = await readPixels(media.blob);
      const recon = await readPixels(reconBlob);
      if (!orig || !recon) throw new Error('no 2d context');
      const stats = elaStats(orig, recon, w, h);
      if (!stats) {
        return { ...base, outcome: 'neutral', confidence: 0, summary: 'Image too small for block-level analysis.', evidence: [] };
      }

      const evidence: Evidence[] = [
        { label: 'Average re-encode error', detail: stats.mean.toFixed(2) },
        { label: 'Peak block error', detail: stats.max.toFixed(1) },
        { label: 'Hotspot blocks', detail: `${(stats.hotFraction * 100).toFixed(1)}%` },
      ];

      // A handful of sharply-hot blocks = localized re-save; a uniformly hot
      // image = low original quality, not editing. Both bounds matter.
      const localized = stats.hotFraction > 0.001 && stats.hotFraction < 0.2;
      if (localized && stats.max >= 12 && stats.max >= 4 * stats.mean) {
        return {
          ...base,
          outcome: 'negative',
          confidence: 0.35,
          summary: 'ELA hotspots suggest some regions were saved at a different quality - possible local edits.',
          evidence: [...evidence, { label: 'ELA is heuristic - treat as a flag, not proof' }],
        };
      }

      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary:
          stats.hotFraction >= 0.2
            ? 'Uniformly high ELA error - consistent with a heavily compressed image, not localized edits.'
            : 'No localized recompression detected.',
        evidence,
      };
    } catch {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'ELA could not run on this image.',
        evidence: [],
      };
    }
  },
};
