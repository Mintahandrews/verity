export type {
  Evidence,
  MediaDescriptor,
  MediaInput,
  MediaKind,
  Signal,
  SignalOutcome,
  SignalResult,
  Verdict,
  VerdictState,
} from './types.ts';
export { SignalRegistry, errorResult } from './registry.ts';
export { fuse, errorVerdict } from './fuse.ts';
export { sha256Hex, pHash64, pHashHex, hamming64, hammingHex } from './hash.ts';
export { detectAiSignatures } from './aisignatures.ts';
export { sniffMime } from './mime.ts';
export type { AiSignatureHit } from './aisignatures.ts';
export { aiMetadataSignal } from './signals/ai-metadata.ts';
export { metadataSignal } from './signals/metadata.ts';
export { factCheckSignal, classifyRating, claimReviewMatches } from './signals/fact-check.ts';
export { waybackSignal } from './signals/wayback.ts';
export { gdeltSignal } from './signals/gdelt.ts';
export { geolocationSignal } from './signals/geolocation.ts';
export { hasBreakingMarkers, keywordsFrom } from './signals/claimtext.ts';
