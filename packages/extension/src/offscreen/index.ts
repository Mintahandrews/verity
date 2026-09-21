import { SignalRegistry, fuse } from '@verity/core';
import type { RuntimeMessage } from '../messages';
import { c2paSignal } from './signals/c2pa';
import { metadataSignal } from './signals/metadata';

const registry = new SignalRegistry().register(c2paSignal).register(metadataSignal);

async function fetchMedia(url: string): Promise<Blob> {
  // TODO: blob:/data: URLs created in page context are not fetchable from the
  // extension origin — add a content-script fallback that transfers bytes.
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`);
  return res.blob();
}

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  if (msg.type !== 'verity:offscreen-analyze') return;
  void (async () => {
    try {
      const blob = await fetchMedia(msg.media.url);
      const signals = await registry.run({ ...msg.media, blob });
      sendResponse({ ok: true, verdictId: crypto.randomUUID(), verdict: fuse(signals) });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  })();
  return true; // async response
});
