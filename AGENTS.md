# AGENTS.md — Verity

Multi-signal media authenticity engine. Monorepo: `packages/core` (pure verdict logic)
and `packages/extension` (Manifest V3 browser extension). See `docs/DESIGN.md` for the
full vision and roadmap.

## Commands

- `npm install` — install workspace deps
- `npm run dev` — vite dev build with HMR (load `packages/extension/dist` in `chrome://extensions`)
- `npm run build` — production build of the extension
- `npm run typecheck` — `tsc --noEmit` across workspaces
- `npm test` — vitest (core fusion logic)

## Non-negotiable rules

1. Three-state verdicts only: `verified` / `unverified` / `suspicious`. NEVER label media "fake".
2. Negatives dominate in fusion — real media with false context is the #1 misinfo pattern.
3. Only conclusive (cryptographic) positives yield `verified`. AI-detection/ensemble signals never do.
4. Privacy tiering: analysis runs local-first; only content hashes may leave the device
   (Phase 2 registry); media upload is always opt-in.
5. Every verdict carries per-signal, plain-language evidence. No opaque scores.

## Architecture

- Signals implement `Signal` (`packages/core/src/types.ts`), registered in `SignalRegistry`.
- Extension flow: context menu / popup → background (router) → offscreen document
  (fetch + WASM + signal analysis) → `fuse()` → `storage.session` → badge + verdict page.
- c2pa-js runs in the offscreen document — MV3 WASM requires `'wasm-unsafe-eval'` CSP
  and a DOM-capable context for its web worker.
- Current phase: **1** (C2PA + metadata + badge + verdict page). See `docs/DESIGN.md`.

## Design language

Neo-botanical dark/light system (see `design/design-language.md`, tokens in
`packages/extension/src/design/tokens.css`). Key rules:

- Electric Sprout `#68ef3f` is the ONLY accent/action color — no second hue ever.
- Dark surfaces = Forest Depths `#122314`; light = Pure White / Bone White `#f2f5eb` cards.
- Pill radii: buttons 28px, badges/chips 40px, cards 24px. No shadows on flat components.
- Type: Ozik (display fallback stack) / Aeonik (UI, fallback stack) / Instrument Serif
  (accents only — bundled via `@fontsource/instrument-serif`).
- Verdict chips map to palette: verified=Sprout, unverified=Cool Stone, suspicious=Onyx Olive.
  No red/orange — severity is carried by weight and glyph, not hue.

## Code style

- TypeScript strict, ESM, no default exports in `core`, plain-language user-facing strings.
- Signal plugins are self-contained; shared types live in `@verity/core` only.
