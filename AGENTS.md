# AGENTS.md - Verity

Multi-signal media authenticity engine. Monorepo: `packages/core` (pure verdict
logic + platform-neutral signals: metadata, AI signatures, fact-check - relative
imports use explicit `.ts` so Node strip-types mode can run it), `packages/extension`
(Manifest V3 browser extension), `packages/registry` (verdict API + dashboard),
`packages/bot` (Telegram bot + bulk scanner), `packages/signer` (C2PA signing CLI).
See `docs/DESIGN.md` for the full vision and roadmap.

## Commands

- `npm install` - install workspace deps
- `npm run dev` - vite dev build with HMR (load `packages/extension/dist` in `chrome://extensions`)
- `npm run build` - production build of the extension
- `npm run registry` - verdict API + dashboard at `/` (`PORT`, `PUBLIC_URL`, `VERITY_DB`, `RATE_LIMIT_POSTS` envs)
- `npm run bot` - Telegram bot (`TELEGRAM_BOT_TOKEN` required; `REGISTRY_URL`,
  `FACT_CHECK_API_KEY`, `OCR=0`, `OCR_LANGS`, `RATE_LIMIT_*` optional)
- `npm run sign -- <in> <out> --test` - C2PA-sign media (ephemeral dev cert;
  `--cert/--key` for real)
- `node packages/bot/src/scan.ts <dir> [--out report]` - newsroom bulk intake → CSV/JSON
- `npm run typecheck` - `tsc --noEmit` across workspaces
- `npm test` - vitest (all workspaces)

## Non-negotiable rules

1. Three-state verdicts only: `verified` / `unverified` / `suspicious`. NEVER label media "fake".
2. Negatives dominate in fusion - real media with false context is the #1 misinfo pattern.
3. Only conclusive (cryptographic) positives yield `verified`. AI-detection/ensemble signals never do.
4. Privacy tiering: analysis runs local-first; only content hashes may leave the device
   (Phase 2 registry); media upload is always opt-in.
5. Every verdict carries per-signal, plain-language evidence. No opaque scores.

## Architecture

- Signals implement `Signal` (`packages/core/src/types.ts`), registered in `SignalRegistry`.
- Extension flow: context menu / popup → background (router) → offscreen document
  (fetch + WASM + signal analysis) → `fuse()` → `storage.session` → badge + verdict page.
- `src/analysis.ts` `runPipeline()` is the Phase-2 path: sha256 + pHash → registry
  lookup (exact → cached verdict; similar → prior-sighting signal) → analyze → submit.
- The registry (`packages/registry`) is optional zero-dep infra: JSON store, `/api/*`
  JSON routes, shareable `/v/:sha` pages. Extension falls back gracefully when absent.
- Firefox has no `chrome.offscreen` - background detects and opens the verdict page
  in analyze mode (`?u=`) instead. That mode also serves as a standalone checker.
- c2pa (`@contentauth/c2pa-web`) runs in the offscreen document - MV3 WASM requires
  `'wasm-unsafe-eval'` CSP and a DOM-capable context for its web worker.
- Signals registered in `src/analysis.ts`: c2pa → ai-metadata (deterministic
  generator fingerprints) → metadata → geolocation (EXIF GPS vs claimed country;
  geocoding is opt-in via `locationLookup`/popup `geoLookup`) → reverse-search
  (Google Lens, opt-in via `chrome.storage.local.reverseSearch`, public URLs
  only) → wayback (archive.org first-sighting; skips telegram URLs) → gdelt
  (news coverage of claims, keyless) → fact-check → ai-model (ONNX
  classifier via onnxruntime-web, only when `aiModelUrl` is configured - lazy
  chunk, honest 0.7 confidence cap).
- Registry similarity search uses an in-memory BK-tree (`store.ts`/`bktree.ts`);
  records can carry `phashes[]` (multi-frame video fingerprints - the bot
  samples 3 offsets so trimmed re-uploads still match).
- Bot pipeline (`packages/bot/src/pipeline.ts`) mirrors the extension's:
  c2pa-node (native bindings, magic-byte MIME sniffing - mismatches throw) →
  ai-metadata → metadata → geolocation → wayback → gdelt → fact-check.
  OCR (tesseract.js) enriches contextText for images so claims in pixels
  reach fact-check. `GEO_LOOKUP=1` opts into coordinate geocoding.
- Fact-check signal has pluggable providers: Google Fact Check Tools API
  (keyed) + ClaimReview JSON-LD fetched from URLs in context/`pageUrl`
  (keyless - covers the "page itself is a fact-check" case).
- Extension OCR lives in `src/ocr.ts`: tesseract.js worker + wasm core are
  vendored in `public/ocr/` (CSP blocks blob/CDN workers); traineddata comes
  from jsdelivr at runtime. Popup toggle: `ocrEnabled` (default on).
- Registry hardening: per-IP write limit (120/h), 256KB body cap, verdict
  shape + phash validation.
- Signer (`packages/signer`): `sign.ts` embeds manifests via c2pa-node;
  `--test` uses ephemeral certs (not trust-listed).
- c2pa-node validates signatures cryptographically but NOT trust-list
  membership - the signal surfaces a "signer not accredited" evidence line
  when no cert chain is present.
- Current phase: **4** in progress (signer + hardened registry + dashboard +
  bulk intake done). Remaining: deployment, WhatsApp bridge, trust-list UX.

## Design language

Neo-botanical dark/light system (see `design/design-language.md`, tokens in
`packages/extension/src/design/tokens.css`). Key rules:

- Electric Sprout `#68ef3f` is the ONLY accent/action color - no second hue ever.
- Dark surfaces = Forest Depths `#122314`; light = Pure White / Bone White `#f2f5eb` cards.
- Pill radii: buttons 28px, badges/chips 40px, cards 24px. No shadows on flat components.
- Type: Ozik (display fallback stack) / Aeonik (UI, fallback stack) / Instrument Serif
  (accents only - bundled via `@fontsource/instrument-serif`).
- Verdict chips map to palette: verified=Sprout, unverified=Cool Stone, suspicious=Onyx Olive.
  No red/orange - severity is carried by weight and glyph, not hue.

## Code style

- TypeScript strict, ESM, no default exports in `core`, plain-language user-facing strings.
- Signal plugins are self-contained; shared types live in `@verity/core` only.
