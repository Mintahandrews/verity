import { describe, expect, it } from 'vitest';
import { detectAiSignatures } from './aisignatures';

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function pngChunk(type: string, payload: string): number[] {
  const data = [...type].map((c) => c.charCodeAt(0));
  const body = [...payload].map((c) => c.charCodeAt(0));
  const len = [(body.length >>> 24) & 0xff, (body.length >>> 16) & 0xff, (body.length >>> 8) & 0xff, body.length & 0xff];
  return [...len, ...data, ...body, 0, 0, 0, 0]; // CRC ignored by scanner
}

describe('detectAiSignatures', () => {
  it('finds Stable Diffusion PNG parameters chunk', () => {
    const bytes = new Uint8Array([
      ...PNG_SIG,
      ...pngChunk('tEXt', 'parameters a cat, Steps: 20, Sampler: Euler a'),
      ...pngChunk('IDAT', ''),
    ]);
    const hits = detectAiSignatures(bytes);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.generator === 'diffusion pipeline' || h.location.includes('tEXt'))).toBe(true);
  });

  it('finds generator names in embedded metadata text', () => {
    const bytes = new Uint8Array([...'JFIF   Software: Midjourney   '.split('').map((c) => c.charCodeAt(0))]);
    expect(detectAiSignatures(bytes).some((h) => h.generator === 'midjourney')).toBe(true);
  });

  it('returns empty for clean bytes', () => {
    const bytes = new Uint8Array([...'\x89PNG\r\n\x1a\n ordinary photo data'.split('').map((c) => c.charCodeAt(0))]);
    expect(detectAiSignatures(bytes)).toEqual([]);
  });

  it('detects ComfyUI workflow JSON', () => {
    const bytes = new Uint8Array([
      ...PNG_SIG,
      ...pngChunk('tEXt', 'workflow {"class_type": "KSampler"}'),
      ...pngChunk('IDAT', ''),
    ]);
    expect(detectAiSignatures(bytes).some((h) => h.generator === 'comfyui')).toBe(true);
  });
});
