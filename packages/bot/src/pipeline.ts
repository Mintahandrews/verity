import {
  SignalRegistry,
  aiMetadataSignal,
  factCheckSignal,
  fuse,
  metadataSignal,
  pHash64,
  pHashHex,
  sha256Hex,
} from '@verity/core';
import type { MediaDescriptor, MediaKind, SignalResult, Verdict } from '@verity/core';
import sharp from 'sharp';

const REGISTRY = (process.env.REGISTRY_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const TIMEOUT_MS = 4000;

// Browser-bound signals (c2pa WASM, onnxruntime, Lens) stay extension-side.
// TODO: wire in c2pa-node for signed-provenance checks server-side.
const signals = new SignalRegistry()
  .register(aiMetadataSignal)
  .register(metadataSignal)
  .register(factCheckSignal);

interface RegistryHit {
  match: 'exact' | 'similar';
  verdict: Verdict;
  url?: string;
  createdAt?: string;
  distance?: number;
}

async function lookup(sha256: string, phash: string | null): Promise<RegistryHit | null> {
  try {
    const res = await fetch(`${REGISTRY}/api/verdicts/${sha256}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { match: 'exact', verdict: (await res.json()) as Verdict };
  } catch {
    /* optional */
  }
  if (!phash) return null;
  try {
    const res = await fetch(`${REGISTRY}/api/similar?phash=${phash}&maxdist=8`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const { results } = (await res.json()) as { results?: Array<Omit<RegistryHit, 'match'>> };
    const hit = results?.[0];
    return hit ? { match: 'similar', ...hit } : null;
  } catch {
    return null;
  }
}

async function submit(body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(`${REGISTRY}/api/verdicts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { shareUrl?: string }).shareUrl ?? null;
  } catch {
    return null;
  }
}

async function imagePhash(buf: Buffer): Promise<string | null> {
  try {
    const raw = await sharp(buf).resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer();
    const luma = new Float64Array(1024);
    for (let i = 0; i < 1024; i++) {
      luma[i] = 0.299 * raw[i * 3]! + 0.587 * raw[i * 3 + 1]! + 0.114 * raw[i * 3 + 2]!;
    }
    return pHashHex(pHash64(luma));
  } catch {
    return null;
  }
}

function priorSighting(hit: RegistryHit): SignalResult {
  const evidence: SignalResult['evidence'] = [];
  if (hit.distance !== undefined) evidence.push({ label: `Match distance: ${hit.distance} bits` });
  if (hit.createdAt) {
    evidence.push({ label: 'First seen', detail: new Date(hit.createdAt).toLocaleDateString() });
  }
  if (hit.url) evidence.push({ label: 'Earlier source', detail: hit.url });
  return {
    signalId: 'registry',
    signalName: 'Prior sightings',
    outcome: 'neutral',
    confidence: 0,
    summary: 'A near-identical image was previously checked.',
    evidence,
  };
}

export async function analyzeBuffer(
  kind: MediaKind,
  sourceUrl: string,
  buf: Buffer,
  caption?: string,
): Promise<Verdict> {
  const blob = new Blob([new Uint8Array(buf)]);
  const sha256 = await sha256Hex(await blob.arrayBuffer());
  const phash = kind === 'image' ? await imagePhash(buf) : null;

  const hit = await lookup(sha256, phash);
  if (hit?.match === 'exact') {
    hit.verdict.shareUrl ??= `${REGISTRY}/v/${sha256}`;
    return hit.verdict;
  }

  const media: MediaDescriptor = {
    url: sourceUrl,
    kind,
    ...(caption ? { contextText: caption } : {}),
  };
  const results = await signals.run({ ...media, blob });
  if (hit?.match === 'similar') results.unshift(priorSighting(hit));
  const verdict = fuse(results);

  // Never submit the source URL: Telegram file URLs embed the bot token
  // and expire anyway. Hashes + verdict only.
  const shareUrl = await submit({ sha256, phash, verdict });
  if (shareUrl) verdict.shareUrl = shareUrl;
  return verdict;
}
