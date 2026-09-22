import {
  SignalRegistry,
  aiMetadataSignal,
  commonsSignal,
  createClaimBusterSignal,
  createSauceNaoSignal,
  createSightengineSignal,
  daylightSignal,
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
import type { MediaDescriptor, MediaKind, SignalResult, Verdict } from '@checkverity/core';
import sharp from 'sharp';
import { c2paSignal } from './c2pa.ts';
import { extractText } from './ocr.ts';
import { videoPhashes } from './videohash.ts';

const REGISTRY = (process.env.REGISTRY_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const TIMEOUT_MS = 4000;
const MAX_OCR_CHARS = 1000;

// onnxruntime-web and the Lens adapter stay extension-side (browser-bound).
// C2PA runs here via c2pa-node's native bindings.
const signals = new SignalRegistry()
  .register(c2paSignal)
  .register(aiMetadataSignal)
  .register(metadataSignal)
  .register(geolocationSignal)
  .register(daylightSignal)
  .register(weatherSignal)
  .register(waybackSignal)
  .register(commonsSignal)
  .register(gdeltSignal)
  .register(rdapSignal)
  .register(factCheckSignal);

// Key-gated third-party signals - active only when the operator provides
// API keys. All upload media/text to the provider, hence opt-in.
if (process.env.SAUCENAO_API_KEY) {
  signals.register(createSauceNaoSignal(process.env.SAUCENAO_API_KEY));
}
if (process.env.SIGHTENGINE_USER && process.env.SIGHTENGINE_SECRET) {
  signals.register(
    createSightengineSignal(process.env.SIGHTENGINE_USER, process.env.SIGHTENGINE_SECRET),
  );
}
if (process.env.CLAIMBUSTER_API_KEY) {
  signals.register(createClaimBusterSignal(process.env.CLAIMBUSTER_API_KEY));
}

interface RegistryHit {
  match: 'exact' | 'similar';
  verdict: Verdict;
  url?: string;
  createdAt?: string;
  distance?: number;
}

async function lookup(sha256: string, phashes: string[]): Promise<RegistryHit | null> {
  try {
    const res = await fetch(`${REGISTRY}/api/verdicts/${sha256}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return { match: 'exact', verdict: (await res.json()) as Verdict };
  } catch {
    /* optional */
  }
  // Multi-frame fingerprints: query each, keep the closest hit overall.
  let best: RegistryHit | null = null;
  for (const phash of phashes) {
    try {
      const res = await fetch(`${REGISTRY}/api/similar?phash=${phash}&maxdist=8`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const { results } = (await res.json()) as { results?: Array<Omit<RegistryHit, 'match'>> };
      const hit = results?.[0];
      if (hit && (!best || (hit.distance ?? 64) < (best.distance ?? 64))) {
        best = { match: 'similar', ...hit };
      }
    } catch {
      /* optional */
    }
  }
  return best;
}

interface NoteHit {
  id: string;
  summary: string;
}

/** Tweet IDs carrying misleading-rated Community Notes (empty when unsynced). */
async function lookupNotes(ids: string[]): Promise<NoteHit[]> {
  if (!ids.length) return [];
  try {
    const res = await fetch(`${REGISTRY}/api/notes?ids=${ids.slice(0, 50).join(',')}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { flagged?: NoteHit[] };
    return j.flagged ?? [];
  } catch {
    return [];
  }
}

function communityNotes(notes: NoteHit[]): SignalResult {
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

async function submit(body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(`${REGISTRY}/api/verdicts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Trusted submitter: the registry only accepts 'verified' verdicts
        // from key-bearing sources - anonymous posts can't mint trust.
        ...(process.env.VERITY_API_KEY
          ? { 'x-verity-key': process.env.VERITY_API_KEY }
          : {}),
      },
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
  const single = kind === 'image' ? await imagePhash(buf) : null;
  const phashes =
    kind === 'image' ? (single ? [single] : []) : kind === 'video' ? await videoPhashes(buf) : [];

  const hit = await lookup(sha256, phashes);
  if (hit?.match === 'exact') {
    hit.verdict.shareUrl ??= `${REGISTRY}/v/${sha256}`;
    return hit.verdict;
  }

  // Claims live in captions AND in pixels (memes, screenshots) - OCR feeds
  // both into the fact-check signal's context text.
  let contextText = caption ?? '';
  if (kind === 'image' && process.env.OCR !== '0') {
    const ocrText = await extractText(buf);
    if (ocrText) contextText = [contextText, ocrText.slice(0, MAX_OCR_CHARS)].filter(Boolean).join('\n');
  }

  const media: MediaDescriptor = {
    url: sourceUrl,
    kind,
    ...(contextText ? { contextText } : {}),
    // Opt-in: sends EXIF coordinates to a geocoder. Telegram strips GPS on
    // photos anyway; documents/originals may keep it.
    locationLookup: process.env.GEO_LOOKUP === '1',
  };
  const results = await signals.run({ ...media, blob });
  if (hit?.match === 'similar') results.unshift(priorSighting(hit));
  const flaggedNotes = await lookupNotes(tweetIdsFrom(sourceUrl, contextText));
  if (flaggedNotes.length) results.unshift(communityNotes(flaggedNotes));
  const verdict = fuse(results);

  // Never submit the source URL: Telegram file URLs embed the bot token
  // and expire anyway. Hashes + verdict only.
  const shareUrl = await submit({ sha256, phashes, verdict });
  if (shareUrl) verdict.shareUrl = shareUrl;
  return verdict;
}
