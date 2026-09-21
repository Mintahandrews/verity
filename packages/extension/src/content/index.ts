import type { MediaDescriptor } from '@verity/core';
import type { AnalyzeResponse, RuntimeMessage } from '../messages';
import { attachBadge } from './badge';

chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  if (msg.type === 'verity:verify-one') void verify(msg.media);
  if (msg.type === 'verity:scan-page') void scanPage();
});

async function verify(media: MediaDescriptor): Promise<void> {
  try {
    const res = (await chrome.runtime.sendMessage({
      type: 'verity:analyze',
      media,
    } satisfies RuntimeMessage)) as AnalyzeResponse;
    if (res.ok) attachBadge(media.url, res.verdictId, res.verdict.state);
    else attachBadge(media.url, null, 'error');
  } catch {
    attachBadge(media.url, null, 'error');
  }
}

const MIN_SIZE = 128;
const SCAN_LIMIT = 25;

function scanPage(): void {
  const imgs = [...document.querySelectorAll('img')]
    .filter((i) => i.naturalWidth >= MIN_SIZE && /^https?:/.test(i.currentSrc || i.src))
    .slice(0, SCAN_LIMIT);
  for (const img of imgs) void verify({ url: img.currentSrc || img.src, kind: 'image' });
}
