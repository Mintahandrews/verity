import type { MediaDescriptor, MediaKind, Verdict } from '@checkverity/core';

export const OFFSCREEN_URL = 'src/offscreen/index.html';
export const VERDICT_PAGE_URL = 'src/verdict/index.html';
export const verdictKey = (id: string): string => `verdict:${id}`;

/** Raw-byte ceiling for the content-script transfer path (base64 inflates ~33%). */
export const MAX_TRANSFER_BYTES = 32 * 1024 * 1024;

export type RuntimeMessage =
  // background -> content: user picked "Verify with Verity" on this media
  | { type: 'verity:verify-one'; media: MediaDescriptor }
  // background -> content: same, but Chrome gave no srcUrl (e.g. <video>
  // with <source> children) - content resolves the context-menu target itself
  | { type: 'verity:verify-target'; kind: MediaKind }
  // popup -> content: collect candidate media on the page and verify each
  | { type: 'verity:scan-page' }
  // content -> background: route an analysis request (background ensures offscreen).
  // bulk=true means a page scan - background must not open tabs for missing
  // site permissions, it reports 'needs-permission' so the scan can continue.
  | { type: 'verity:analyze'; media: MediaDescriptor; bulk?: boolean }
  // content -> background: same, but bytes were extracted in page context
  // (blob:/data: URLs the extension origin cannot fetch)
  | { type: 'verity:analyze-bytes'; media: MediaDescriptor; dataB64: string; mime?: string }
  // content -> background: a local failure that should still produce a card
  | { type: 'verity:report-error'; media: MediaDescriptor; error: string }
  // background -> offscreen: run the signal engine (dataB64 when transferred)
  | { type: 'verity:offscreen-analyze'; media: MediaDescriptor; dataB64?: string; mime?: string };

export type AnalyzeResponse =
  | { ok: true; verdictId: string; verdict: Verdict }
  | { ok: false; error: string };

/** Fixed path of the self-contained content bundle emitted by the build. */
export const CONTENT_SCRIPT_FILE = 'assets/content-loader.js';

/**
 * Inject the content script on demand. The bundle is a single IIFE file -
 * no dynamic imports - so page CSP cannot block it and the listener is
 * registered synchronously on execute.
 */
export async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [CONTENT_SCRIPT_FILE],
  });
}

/** Optional-host-permission pattern covering one media origin. */
export function mediaOriginPattern(url: string): string | null {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? `${u.origin}/*` : null;
  } catch {
    return null;
  }
}

/** True when the extension may fetch media from this URL's origin. */
export async function hasMediaAccess(url: string): Promise<boolean> {
  const origin = mediaOriginPattern(url);
  if (!origin || typeof chrome.permissions?.contains !== 'function') return true;
  try {
    return await chrome.permissions.contains({ origins: [origin] });
  } catch {
    return false;
  }
}
