/** SHA-256 of raw bytes — the canonical content identity key. */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const GRID = 32;
const SAMPLE = 8;

/**
 * Classic pHash: 32×32 luminance grid → 2D DCT → keep top-left 8×8 (minus DC),
 * bit set where coefficient exceeds the median. Survives re-encoding, scaling,
 * and mild crops — which is what makes "first seen elsewhere" detection work.
 */
export function pHash64(luma: ArrayLike<number>, size = GRID): bigint {
  const coeffs: number[] = [];
  for (let v = 0; v < SAMPLE; v++) {
    for (let u = 0; u < SAMPLE; u++) {
      let sum = 0;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          sum +=
            luma[y * size + x]! *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size));
        }
      }
      coeffs.push(sum);
    }
  }
  const rest = coeffs.slice(1).sort((a, b) => a - b);
  const median = rest[Math.floor(rest.length / 2)]!;
  let hash = 0n;
  for (const c of coeffs) hash = (hash << 1n) | (c > median ? 1n : 0n);
  return hash;
}

export function pHashHex(hash: bigint): string {
  return hash.toString(16).padStart(16, '0');
}

export function hamming64(a: bigint, b: bigint): number {
  let d = a ^ b;
  let n = 0;
  while (d) {
    n += Number(d & 1n);
    d >>= 1n;
  }
  return n;
}

export function hammingHex(a: string, b: string): number {
  return hamming64(BigInt(`0x${a}`), BigInt(`0x${b}`));
}
