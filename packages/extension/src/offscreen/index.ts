import type { RuntimeMessage } from '../messages';
import { base64ToBlob, fetchMedia, runPipeline } from '../analysis';

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender, sendResponse) => {
  if (msg.type !== 'verity:offscreen-analyze') return;
  void (async () => {
    try {
      const blob = msg.dataB64
        ? base64ToBlob(msg.dataB64, msg.mime ?? 'application/octet-stream')
        : await fetchMedia(msg.media.url);
      const verdict = await runPipeline(msg.media, blob);
      sendResponse({ ok: true, verdictId: crypto.randomUUID(), verdict });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  })();
  return true; // async response
});
