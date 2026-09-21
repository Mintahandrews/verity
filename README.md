# Verity

**Multi-signal media authenticity engine.** Verity doesn't ask "is this fake?" — it asks
"what can we *verify*?" and answers with a transparent, evidence-backed verdict:

- ✅ **Verified** — cryptographically signed provenance (C2PA Content Credentials)
- ❓ **Unverified** — not enough evidence to confirm or refute
- ⚠️ **Suspicious** — evidence contradicts the content's claims

Most viral misinformation isn't deepfakes — it's real media with false context. Verity
treats authenticity as a multi-signal problem, not a detection problem.

## Status

Phase 1 scaffold: browser extension with C2PA verification + metadata forensics +
three-state badge + verdict page. See [`docs/DESIGN.md`](docs/DESIGN.md) for the full
vision (verdict registry, reverse search, Telegram bot, newsroom tooling).

## Quickstart

```bash
npm install
npm run dev        # dev build with HMR
# or: npm run build
```

Then load `packages/extension/dist` at `chrome://extensions` (Developer mode →
"Load unpacked").

**Verify media:** right-click any image/video → "Verify with Verity", or use the
toolbar popup → "Scan this page".

## Repo layout

```
packages/core       Pure TS: types, signal registry, fusion engine (unit tested)
packages/extension  MV3 extension: background router, offscreen WASM analysis,
                    content-script badges, popup, verdict page
docs/DESIGN.md      Full product vision, gap map, roadmap
scripts/gen-icons.mjs  Dependency-free icon generator
```

## License

Apache-2.0
