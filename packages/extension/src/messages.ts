import type { MediaDescriptor, Verdict } from '@verity/core';

export const OFFSCREEN_URL = 'src/offscreen/index.html';
export const VERDICT_PAGE_URL = 'src/verdict/index.html';
export const verdictKey = (id: string): string => `verdict:${id}`;

export type RuntimeMessage =
  // background -> content: user picked "Verify with Verity" on this media
  | { type: 'verity:verify-one'; media: MediaDescriptor }
  // popup -> content: collect candidate media on the page and verify each
  | { type: 'verity:scan-page' }
  // content -> background: route an analysis request (background ensures offscreen)
  | { type: 'verity:analyze'; media: MediaDescriptor }
  // background -> offscreen: run the signal engine
  | { type: 'verity:offscreen-analyze'; media: MediaDescriptor }
  // badge -> background: open the verdict page
  | { type: 'verity:open'; verdictId: string };

export type AnalyzeResponse =
  | { ok: true; verdictId: string; verdict: Verdict }
  | { ok: false; error: string };
