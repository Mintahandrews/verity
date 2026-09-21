import { SignalRegistry, fuse } from '@verity/core';
import type { MediaDescriptor, Verdict } from '@verity/core';
import { c2paSignal } from './offscreen/signals/c2pa';
import { metadataSignal } from './offscreen/signals/metadata';

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

export async function analyzeMedia(media: MediaDescriptor, blob: Blob): Promise<Verdict> {
  const signals = await registry.run({ ...media, blob });
  return fuse(signals);
}
