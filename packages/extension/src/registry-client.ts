import type { Verdict } from '@verity/core';
import { storageGet } from './storage';

export interface RegistryHit {
  match: 'exact' | 'similar';
  verdict: Verdict;
  url?: string;
  createdAt?: string;
  distance?: number;
  similarity?: number;
}

export interface NoteHit {
  id: string;
  summary: string;
}

// Public Verity registry (Railway). Self-hosters override via
// chrome.storage.local.registryUrl.
export const DEFAULT_REGISTRY = 'https://verity.codemintah.dev';
const TIMEOUT_MS = 3000;

async function base(): Promise<string> {
  const { registryUrl } = await storageGet<{ registryUrl?: string }>('registryUrl');
  return (registryUrl ?? DEFAULT_REGISTRY).replace(/\/$/, '');
}

/**
 * The registry is optional infrastructure - every failure path returns null and
 * analysis proceeds locally. Only hashes + verdicts ever leave the device.
 */
export async function lookupVerdict(
  sha256: string,
  phash: string | null,
): Promise<RegistryHit | null> {
  try {
    const res = await fetch(`${await base()}/api/verdicts/${sha256}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) {
      return { match: 'exact', verdict: (await res.json()) as Verdict };
    }
  } catch {
    /* registry unreachable - fine */
  }
  if (!phash) return null;
  try {
    const res = await fetch(`${await base()}/api/similar?phash=${phash}&maxdist=8`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const { results } = (await res.json()) as {
      results?: Array<{ verdict: Verdict; url?: string; createdAt?: string; distance?: number }>;
    };
    const hit = results?.[0];
    return hit ? { match: 'similar', ...hit } : null;
  } catch {
    return null;
  }
}

/** Semantic near-dupes via CLIP embedding cosine search. */
export async function lookupEmbedding(embedding: ArrayLike<number>): Promise<RegistryHit | null> {
  try {
    const res = await fetch(`${await base()}/api/similar-embedding`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ embedding: Array.from(embedding), mincos: 0.92 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const { results } = (await res.json()) as {
      results?: Array<{ verdict: Verdict; url?: string; createdAt?: string; similarity?: number }>;
    };
    const hit = results?.[0];
    return hit ? { match: 'similar', ...hit } : null;
  } catch {
    return null;
  }
}

/** Tweet IDs carrying misleading-rated Community Notes (empty when unsynced). */
export async function lookupNotes(ids: string[]): Promise<NoteHit[]> {
  if (!ids.length) return [];
  try {
    const res = await fetch(`${await base()}/api/notes?ids=${ids.slice(0, 50).join(',')}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { flagged?: NoteHit[] };
    return j.flagged ?? [];
  } catch {
    return [];
  }
}

export async function submitVerdict(input: {
  sha256: string;
  phash?: string | null;
  embedding?: number[] | null;
  url?: string;
  verdict: Verdict;
}): Promise<string | null> {
  try {
    const res = await fetch(`${await base()}/api/verdicts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { shareUrl?: string }).shareUrl ?? null;
  } catch {
    return null;
  }
}
