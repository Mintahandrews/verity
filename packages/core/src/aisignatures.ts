/**
 * Deterministic AI-generator signature detection. Generators routinely leave
 * fingerprints in files: PNG tEXt chunks (A1111 "parameters", ComfyUI
 * "workflow"/"prompt"), EXIF Software strings, XMP packets. High precision,
 * zero model required - the honest first layer of an AI-detection ensemble.
 */

export interface AiSignatureHit {
  generator: string;
  /** Where the fingerprint was found (e.g. 'PNG tEXt "parameters"'). */
  location: string;
}

const GENERATORS = [
  'stable diffusion',
  'comfyui',
  'midjourney',
  'dall-e',
  'dalle',
  'adobe firefly',
  'ideogram',
  'flux.1',
  'invokeai',
  'novelai',
  'leonardo.ai',
  'bing image creator',
  'copilot designer',
  'imagen',
  'firefly',
  'diffusionbee',
  'draw things',
  'swarmui',
  'fooocus',
  'automatic1111',
  'a1111',
];

/** PNG/text keys that generative tools use to store generation params. */
const PARAM_KEYS = ['parameters', 'workflow', 'prompt', 'comment', 'description', 'software', 'usercomment', 'xmptoolkit'];

/** Only scan this much - signatures always live in headers, never pixel data. */
const SCAN_BYTES = 512 * 1024;

function toAscii(bytes: Uint8Array, start: number, end: number): string {
  let out = '';
  for (let i = start; i < end; i++) {
    const b = bytes[i]!;
    out += b >= 32 && b < 127 ? String.fromCharCode(b) : ' ';
  }
  return out;
}

/** Find which generator name (if any) appears in a text chunk payload. */
function matchGenerator(text: string): string | null {
  const lower = text.toLowerCase();
  for (const g of GENERATORS) {
    if (lower.includes(g)) return g;
  }
  // tEXt keys holding structured gen params are themselves strong evidence
  if (/\bsteps\s*:\s*\d+/i.test(text) && /\bsampler\b/i.test(text)) return 'diffusion pipeline';
  if (/"class_type"\s*:/.test(text)) return 'comfyui';
  return null;
}

function scanPng(bytes: Uint8Array, hits: AiSignatureHit[]): void {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!SIG.every((b, i) => bytes[i] === b)) return;
  let off = 8;
  const limit = Math.min(bytes.length, SCAN_BYTES);
  while (off + 8 <= limit) {
    const len = (bytes[off]! << 24 | bytes[off + 1]! << 16 | bytes[off + 2]! << 8 | bytes[off + 3]!) >>> 0;
    const type = toAscii(bytes, off + 4, off + 8);
    const dataStart = off + 8;
    const dataEnd = Math.min(dataStart + len, limit);
    if (type === 'tEXt' || type === 'iTXt') {
      const payload = toAscii(bytes, dataStart, dataEnd);
      const nul = payload.indexOf(' ');
      const keyword = (nul === -1 ? payload : payload.slice(0, payload.indexOf('  ') + 1 || undefined))
        .split('\0')[0]!
        .trim()
        .toLowerCase();
      const gen = matchGenerator(payload);
      if (gen && PARAM_KEYS.some((k) => keyword.startsWith(k) || payload.toLowerCase().includes(k))) {
        hits.push({ generator: gen, location: `PNG ${type} chunk` });
      } else if (gen) {
        hits.push({ generator: gen, location: `PNG ${type} chunk` });
      }
    }
    off = dataStart + len + 4; // skip CRC
    if (type === 'IDAT' || type === 'IEND') break; // params live before pixel data
  }
}

function scanBlobText(bytes: Uint8Array, hits: AiSignatureHit[]): void {
  const head = toAscii(bytes, 0, Math.min(bytes.length, SCAN_BYTES)).toLowerCase();
  for (const g of GENERATORS) {
    if (head.includes(g)) {
      hits.push({ generator: g, location: 'embedded metadata text' });
    }
  }
}

/**
 * Scan media bytes for generator fingerprints. Returns deduplicated hits;
 * empty array means no signatures found (NOT evidence of being human-made).
 */
export function detectAiSignatures(bytes: Uint8Array): AiSignatureHit[] {
  const hits: AiSignatureHit[] = [];
  scanPng(bytes, hits);
  scanBlobText(bytes, hits);
  const seen = new Set<string>();
  return hits.filter((h) => (seen.has(h.generator) ? false : (seen.add(h.generator), true)));
}
