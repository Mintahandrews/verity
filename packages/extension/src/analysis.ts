import { SignalRegistry, fuse, pHash64, pHashHex, sha256Hex } from '@verity/core';
import type { MediaDescriptor, SignalResult, Verdict } from '@verity/core';
import { c2paSignal } from './offscreen/signals/c2pa';
import { metadataSignal } from './offscreen/signals/metadata';
import { lookupVerdict, submitVerdict, type RegistryHit } from './registry-client';

const registry = new SignalRegistry().register(c2paSignal).register(metadataSignal);

export async function fetchMedia(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`);
  return res.blob();
}

export function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** 32×32 luminance grid for pHash — canvas exists in offscreen docs and pages. */
async function imagePhash(blob: Blob): Promise<string | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(32, 32);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, 32, 32);
    const { data } = ctx.getImageData(0, 0, 32, 32);
    const luma = new Float64Array(1024);
    for (let i = 0; i < 1024; i++) {
      luma[i] = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
    }
    bmp.close();
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

/**
 * Full Phase-2 pipeline: hash → registry lookup → signal analysis → submit.
 * Exact hash hit returns the cached verdict; near-dupes inject a prior-sighting
 * signal (the seed of the miscontextualization detector).
 */
export async function runPipeline(media: MediaDescriptor, blob: Blob): Promise<Verdict> {
  const sha256 = await sha256Hex(await blob.arrayBuffer());
  const phash = media.kind === 'image' ? await imagePhash(blob) : null;

  const hit = await lookupVerdict(sha256, phash);
  if (hit?.match === 'exact') return hit.verdict;

  const signals = await registry.run({ ...media, blob });
  if (hit?.match === 'similar') signals.unshift(priorSighting(hit));
  const verdict = fuse(signals);

  const shareUrl = await submitVerdict({
    sha256,
    phash,
    ...(/^https?:/.test(media.url) ? { url: media.url } : {}),
    verdict,
  });
  if (shareUrl) verdict.shareUrl = shareUrl;
  return verdict;
}
