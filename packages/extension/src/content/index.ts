import type { MediaDescriptor } from '@verity/core';
import type { AnalyzeResponse, RuntimeMessage } from '../messages';
import { MAX_TRANSFER_BYTES } from '../messages';
import { attachBadge } from './badge';

chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  if (msg.type === 'verity:verify-one') void verify(msg.media);
  if (msg.type === 'verity:scan-page') void scanPage();
});

async function verify(media: MediaDescriptor): Promise<void> {
  const res = await analyze(media);
  // 'opened-in-tab' (Firefox, no offscreen API) → verdict opened directly, no badge.
  if (!res.ok) return;
  attachBadge(media.url, res.verdictId, res.verdict.error ? 'error' : res.verdict.state);
}

type Send = (m: RuntimeMessage) => Promise<AnalyzeResponse>;

const send: Send = (m) => chrome.runtime.sendMessage(m) as Promise<AnalyzeResponse>;

async function analyze(media: MediaDescriptor): Promise<AnalyzeResponse> {
  try {
    // blob:/data: URLs are bound to the page context — extract bytes here and
    // transfer them; the extension origin cannot fetch them.
    if (/^(blob|data):/.test(media.url)) return await sendBytes(media);
    return await send({ type: 'verity:analyze', media });
  } catch (e) {
    return send({
      type: 'verity:report-error',
      media,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

async function sendBytes(media: MediaDescriptor): Promise<AnalyzeResponse> {
  const blob = await fetch(media.url).then((r) => r.blob());
  if (blob.size > MAX_TRANSFER_BYTES) {
    const mb = Math.round(blob.size / 1048576);
    return send({
      type: 'verity:report-error',
      media,
      error: `Media is too large for local analysis (${mb} MB > 32 MB).`,
    });
  }
  return send({
    type: 'verity:analyze-bytes',
    media,
    dataB64: await blobToBase64(blob),
    mime: blob.type,
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',', 2)[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const MIN_SIZE = 128;
const SCAN_LIMIT = 25;

function scanPage(): void {
  const imgs = [...document.querySelectorAll('img')]
    .filter((i) => i.naturalWidth >= MIN_SIZE && /^https?:/.test(i.currentSrc || i.src))
    .slice(0, SCAN_LIMIT);
  for (const img of imgs) void verify({ url: img.currentSrc || img.src, kind: 'image' });
}
