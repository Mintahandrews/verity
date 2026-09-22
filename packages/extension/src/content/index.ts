import type { MediaDescriptor } from '@verity/core';
import type { AnalyzeResponse, RuntimeMessage } from '../messages';
import { MAX_TRANSFER_BYTES } from '../messages';
import { attachBadge, findMediaElement } from './badge';
import { openVerdictOverlay } from './overlay';

chrome.runtime.onMessage.addListener((msg: RuntimeMessage) => {
  if (msg.type === 'verity:verify-one') void verifyOne(msg.media).catch(() => {});
  if (msg.type === 'verity:scan-page') scanPage();
});

/** Pull caption context for the fact-check signal: alt, figcaption, enclosing article. */
function contextFor(el: HTMLElement | null): string | undefined {
  if (!el) return undefined;
  const parts = [
    el.getAttribute('alt'),
    el.closest('figure')?.querySelector('figcaption')?.textContent,
    el.closest('article')?.textContent,
  ].filter((s): s is string => Boolean(s?.trim()));
  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, 500) || undefined;
}

interface VerifyOutcome {
  res: AnalyzeResponse;
  attached: boolean;
}

async function verify(media: MediaDescriptor): Promise<VerifyOutcome | null> {
  const contextText = contextFor(findMediaElement(media.url));
  const desc: MediaDescriptor = {
    ...media,
    pageUrl: location.href,
    ...(contextText ? { contextText } : {}),
  };
  const res = await analyze(desc);
  // 'opened-in-tab' (Firefox, no offscreen API) → verdict opened directly, no badge.
  if (!res.ok) return null;
  const attached = attachBadge(
    media.url,
    res.verdictId,
    res.verdict.error ? 'error' : res.verdict.state,
  );
  return { res, attached };
}

/**
 * Right-click flow. Feedback is immediate (a toast while analysis runs), then
 * the badge lands on the media. If a badge can't attach - element vanished,
 * too small, or a non-DOM source - the verdict page opens instead of leaving
 * the user with silent nothing.
 */
async function verifyOne(media: MediaDescriptor): Promise<void> {
  const pending = toast('Verity is checking this media...');
  const out = await verify(media);
  pending.remove();
  if (out?.res.ok && !out.attached && out.res.verdictId) {
    openVerdictOverlay(out.res.verdictId);
  }
}

type Send = (m: RuntimeMessage) => Promise<AnalyzeResponse>;

const send: Send = (m) => chrome.runtime.sendMessage(m) as Promise<AnalyzeResponse>;

async function analyze(media: MediaDescriptor): Promise<AnalyzeResponse> {
  try {
    // blob:/data: URLs are bound to the page context - extract bytes here and
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

function toast(text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText =
    'position:fixed;bottom:20px;right:20px;z-index:2147483647;' +
    'background:#122314;color:#f2f5eb;font:13px/1.4 system-ui,sans-serif;' +
    'padding:10px 18px;border-radius:40px;border:1px solid #68ef3f;' +
    'box-shadow:0 4px 24px rgba(0,0,0,.4)';
  document.documentElement.appendChild(el);
  return el;
}

const RESULT_GLYPH: Record<string, string> = {
  verified: '✓', unverified: '?', suspicious: '!', error: '×',
};
const RESULT_COLOR: Record<string, string> = {
  verified: '#68ef3f', unverified: '#b7bda5', suspicious: '#ff8a5c', error: '#d6d6d6',
};

interface ScanPanel {
  setProgress(done: number): void;
  addResult(state: string, headline: string, verdictId: string | null): void;
  finish(): void;
}

function scanPanel(total: number): ScanPanel {
  const root = document.createElement('div');
  root.style.cssText =
    'position:fixed;bottom:20px;right:20px;z-index:2147483647;width:300px;max-height:55vh;' +
    'display:flex;flex-direction:column;background:#122314;color:#f2f5eb;' +
    'font:13px/1.45 system-ui,sans-serif;border:1px solid #68ef3f;border-radius:16px;' +
    'box-shadow:0 8px 32px rgba(0,0,0,.45);overflow:hidden';
  const head = document.createElement('div');
  head.style.cssText =
    'display:flex;justify-content:space-between;align-items:center;' +
    'padding:10px 14px;border-bottom:1px solid #273f2b;font-weight:600;flex-shrink:0';
  const title = document.createElement('span');
  title.textContent = `Verity: checking 0/${total}`;
  const close = document.createElement('button');
  close.textContent = '×';
  close.title = 'Close';
  close.style.cssText = 'background:none;border:0;color:#b7bda5;font-size:16px;cursor:pointer;padding:0 0 0 10px';
  close.addEventListener('click', () => root.remove());
  head.append(title, close);
  const list = document.createElement('div');
  list.style.cssText = 'overflow-y:auto;padding:6px';
  const foot = document.createElement('div');
  foot.style.cssText = 'padding:8px 14px;border-top:1px solid #273f2b;color:#b7bda5;font-size:11px;display:none;flex-shrink:0';
  foot.textContent = 'Click a result for the full evidence - or a badge on the page.';
  root.append(head, list, foot);
  document.documentElement.appendChild(root);
  return {
    setProgress(done) {
      title.textContent = done < total ? `Verity: checking ${done}/${total}` : `Verity: ${total} checked`;
    },
    addResult(state, headline, verdictId) {
      const item = document.createElement('button');
      item.style.cssText =
        'display:flex;gap:10px;align-items:flex-start;width:100%;text-align:left;' +
        'background:none;border:0;border-radius:10px;padding:8px;color:inherit;' +
        'font:inherit;cursor:pointer';
      item.innerHTML =
        `<span style="color:${RESULT_COLOR[state] ?? '#b7bda5'};font-weight:700;flex-shrink:0">${RESULT_GLYPH[state] ?? '?'}</span>` +
        `<span style="overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical"></span>`;
      (item.lastElementChild as HTMLElement).textContent = headline;
      item.addEventListener('mouseenter', () => { item.style.background = '#273f2b'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'none'; });
      if (verdictId) {
        item.addEventListener('click', () => openVerdictOverlay(verdictId));
      } else {
        item.style.cursor = 'default';
      }
      list.appendChild(item);
    },
    finish() {
      foot.style.display = 'block';
    },
  };
}

let scanActive = false;

function scanPage(): void {
  if (scanActive) {
    const el = toast('Verity: a scan is already running on this page.');
    setTimeout(() => el.remove(), 4000);
    return;
  }
  const imgs = [...document.querySelectorAll('img')]
    .filter((i) => i.naturalWidth >= MIN_SIZE && /^https?:/.test(i.currentSrc || i.src))
    .slice(0, SCAN_LIMIT);
  if (!imgs.length) {
    const el = toast('Verity: no checkable images on this page.');
    setTimeout(() => el.remove(), 4000);
    return;
  }
  scanActive = true;
  const panel = scanPanel(imgs.length);
  let done = 0;
  const finishOne = () => {
    done++;
    panel.setProgress(done);
    if (done === imgs.length) {
      panel.finish();
      scanActive = false;
    }
  };
  for (const img of imgs) {
    void verify({ url: img.currentSrc || img.src, kind: 'image' })
      .then((out) => {
        const res = out?.res;
        if (res?.ok && res.verdict) {
          panel.addResult(
            res.verdict.error ? 'error' : res.verdict.state,
            res.verdict.headline,
            res.verdictId,
          );
        }
      })
      .catch(() => panel.addResult('error', 'Check could not run on this media.', null))
      .finally(finishOne);
  }
}
