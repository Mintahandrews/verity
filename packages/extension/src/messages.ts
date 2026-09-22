import type { MediaDescriptor, Verdict } from '@checkverity/core';

export const OFFSCREEN_URL = 'src/offscreen/index.html';
export const VERDICT_PAGE_URL = 'src/verdict/index.html';
export const verdictKey = (id: string): string => `verdict:${id}`;

/** Raw-byte ceiling for the content-script transfer path (base64 inflates ~33%). */
export const MAX_TRANSFER_BYTES = 32 * 1024 * 1024;

export type RuntimeMessage =
  // background -> content: user picked "Verify with Verity" on this media
  | { type: 'verity:verify-one'; media: MediaDescriptor }
  // popup -> content: collect candidate media on the page and verify each
  | { type: 'verity:scan-page' }
  // content -> background: route an analysis request (background ensures offscreen)
  | { type: 'verity:analyze'; media: MediaDescriptor }
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
