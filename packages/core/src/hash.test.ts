import { describe, expect, it } from 'vitest';
import { hamming64, hammingHex, pHash64, pHashHex, sha256Hex } from './hash.ts';

const luma = (fn: (i: number) => number) => Array.from({ length: 32 * 32 }, (_, i) => fn(i));

// Smooth low-frequency field — closer to real photos than a raw ramp, whose
// periodic coefficients sit right at the median and flip bits chaotically.
const field = (fx: number, fy: number) =>
  luma((i) => 128 + 60 * Math.sin((i % 32) / fx) * Math.cos(Math.floor(i / 32) / fy));

describe('sha256Hex', () => {
  it('hashes deterministically', async () => {
    const a = await sha256Hex(new TextEncoder().encode('verity').buffer as ArrayBuffer);
    const b = await sha256Hex(new TextEncoder().encode('verity').buffer as ArrayBuffer);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('pHash64', () => {
  it('is stable for identical input', () => {
    const a = pHash64(luma((i) => i % 256));
    const b = pHash64(luma((i) => i % 256));
    expect(a).toBe(b);
  });

  it('distinguishes different images', () => {
    expect(hamming64(pHash64(field(5, 4)), pHash64(field(3, 6)))).toBeGreaterThan(0);
  });

  it('is close under brightness/contrast shifts (re-encode survival)', () => {
    const a = pHash64(field(5, 4));
    const b = pHash64(luma((i) => field(5, 4)[i]! * 0.95 + 10));
    expect(hamming64(a, b)).toBeLessThan(8);
  });
});

describe('hammingHex', () => {
  it('counts bit differences between hex hashes', () => {
    const a = pHashHex(pHash64(field(5, 4)));
    expect(hammingHex(a, a)).toBe(0);
    expect(hammingHex('0000000000000000', 'ffffffffffffffff')).toBe(64);
  });
});
