import {
  SignalRegistry,
  aiMetadataSignal,
  commonsSignal,
  daylightSignal,
  elaSignal,
  factCheckSignal,
  fuse,
  gdeltSignal,
  geolocationSignal,
  metadataSignal,
  pHash64,
  pHashHex,
  rdapSignal,
  sha256Hex,
  tweetIdsFrom,
  waybackSignal,
  weatherSignal,
} from '@checkverity/core';
import type { MediaDescriptor, SignalResult, Verdict } from '@checkverity/core';
import { c2paSignal } from './offscreen/signals/c2pa';
import { aiModelSignal } from './offscreen/signals/ai-model';
import { reverseSearchSignal } from './offscreen/signals/reverse-search';
import { clipEmbedding } from './offscreen/embeddings';
import {
  lookupEmbedding,
  lookupNotes,
  lookupVerdict,
  submitVerdict,
  type RegistryHit,
} from './registry-client';
import { storageGet } from './storage';
import { extractText } from './ocr';

const MAX_OCR_CHARS = 1000;

const registry = new SignalRegistry()
  .register(c2paSignal)
  .register(aiMetadataSignal)
  .register(elaSignal)
  .register(metadataSignal)
  .register(geolocationSignal)
  .register(daylightSignal)
  .register(weatherSignal)
  .register(reverseSearchSignal)
  .register(waybackSignal)
  .register(commonsSignal)
  .register(gdeltSignal)
  .register(rdapSignal)
  .register(factCheckSignal)
  .register(aiModelSignal);

const MAX_ANALYSIS_BYTES = 32 * 1024 * 1024;

export async function fetchMedia(url: string): Promise<Blob> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`);
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_ANALYSIS_BYTES) {
    throw new Error(`media too large for analysis (${Math.round(len / 1048576)} MB)`);
  }
  const blob = await res.blob();
  if (blob.size > MAX_ANALYSIS_BYTES) {
    throw new Error(`media too large for analysis (${Math.round(blob.size / 1048576)} MB)`);
  }
  return blob;
}

export function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** 32×32 luminance grid for pHash - canvas exists in offscreen docs and pages. */
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

/** Semantic near-dupe hit - same evidentiary class as the pHash sighting. */
function semanticSighting(hit: RegistryHit): SignalResult {
  const evidence: SignalResult['evidence'] = [];
  if (hit.similarity !== undefined) {
    evidence.push({ label: 'Embedding similarity', detail: hit.similarity.toFixed(3) });
  }
  if (hit.url) evidence.push({ label: 'Earlier source', detail: hit.url });
  return {
    signalId: 'embedding-sighting',
    signalName: 'Semantic sightings',
    outcome: 'neutral',
    confidence: 0,
    summary: 'A semantically near-identical image was previously checked.',
    evidence,
  };
}

/** A flagged Community Note on the source tweet is direct misleading evidence. */
function communityNotes(notes: Array<{ id: string; summary: string }>): SignalResult {
  return {
    signalId: 'community-notes',
    signalName: 'Community Notes',
    outcome: 'negative',
    confidence: 0.5,
    summary:
      notes.length === 1
        ? 'This post carries a Community Note rated "misleading".'
        : `${notes.length} linked posts carry Community Notes rated "misleading".`,
    evidence: notes.slice(0, 3).map((n) => ({
      label: `Note on tweet ${n.id}`,
      detail: n.summary.slice(0, 280),
    })),
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

  // Claims live in pixels too (memes, screenshots) - OCR enriches the
  // fact-check signal's context text. Lazy-loaded; off via popup toggle.
  // locationLookup stays opt-in: coordinates are sent to a geocoder.
  const { ocrEnabled, geoLookup, clipEnabled } = await storageGet<{
    ocrEnabled?: boolean;
    geoLookup?: boolean;
    clipEnabled?: boolean;
  }>(['ocrEnabled', 'geoLookup', 'clipEnabled']);
  let enriched: MediaDescriptor = { ...media, locationLookup: geoLookup ?? false };
  if (media.kind === 'image' && ocrEnabled !== false) {
    const ocrText = await extractText(blob);
    if (ocrText) {
      const contextText = [media.contextText, ocrText.slice(0, MAX_OCR_CHARS)]
        .filter(Boolean)
        .join('\n');
      enriched = { ...enriched, contextText };
    }
  }

  const signals = await registry.run({ ...enriched, blob });
  if (hit?.match === 'similar') signals.unshift(priorSighting(hit));

  // Opt-in semantic similarity: CLIP embedding (model downloads on first
  // use) → cosine search. Catches near-dupes pHash misses.
  let embedding: Float32Array | null = null;
  if (clipEnabled && media.kind === 'image') {
    embedding = await clipEmbedding(blob);
    if (embedding) {
      const embHit = await lookupEmbedding(embedding);
      if (embHit) signals.unshift(semanticSighting(embHit));
    }
  }

  // Community Notes: any tweet URL in the media URL/page/context carrying
  // a misleading-rated note is direct false-context evidence.
  const tweetIds = tweetIdsFrom(media.url, media.pageUrl, enriched.contextText);
  const flaggedNotes = await lookupNotes(tweetIds);
  if (flaggedNotes.length) signals.unshift(communityNotes(flaggedNotes));

  const verdict = fuse(signals);

  const shareUrl = await submitVerdict({
    sha256,
    phash,
    ...(embedding ? { embedding: [...embedding] } : {}),
    ...(/^https?:/.test(media.url) ? { url: media.url } : {}),
    verdict,
  });
  if (shareUrl) verdict.shareUrl = shareUrl;
  return verdict;
}
