# Verity

**Multi-signal media authenticity engine.** Verity doesn't ask "is this fake?" — it asks
"what can we *verify*?" and answers with a transparent, evidence-backed verdict:

- ✅ **Verified** — cryptographically signed provenance (C2PA Content Credentials)
- ❓ **Unverified** — not enough evidence to confirm or refute
- ⚠️ **Suspicious** — evidence contradicts the content's claims

Most viral misinformation isn't deepfakes — it's real media with false context. Verity
treats authenticity as a multi-signal problem, not a detection problem.

## Status

Phase 3 in progress: extension (C2PA + metadata + badges), the verdict
registry — a zero-dep, self-hostable API (`npm run registry`) with hash lookup,
perceptual near-dupe matching, and shareable verdict pages at `/v/:sha` — and a
Telegram bot (`npm run bot`). The extension works fully offline; the registry
adds caching + share links.
Override the registry URL via `chrome.storage.local.set({registryUrl: '…'})`.
See [`docs/DESIGN.md`](docs/DESIGN.md) for the full vision.

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

## Telegram bot

```bash
TELEGRAM_BOT_TOKEN=… npm run bot
```

Forward the bot a photo or video → it replies with a verdict + shareable link.
Media is analyzed in-process; only hashes and verdict metadata go to the registry.

Environment variables:

- `TELEGRAM_BOT_TOKEN` (required) — from [@BotFather](https://t.me/BotFather)
- `REGISTRY_URL` — defaults to `http://localhost:8787`
- `FACT_CHECK_API_KEY` (optional) — Google Fact Check Tools API key; without it
  the fact-check signal reports `unsupported` and degrades gracefully
- `OCR` — set to `0` to disable text-in-image extraction (default: on; feeds
  the fact-check signal so memes/screenshots get claim-checked)
- `OCR_LANGS` — tesseract language codes, defaults to `eng`
- `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` — per-user check limit, defaults
  to 30 per hour

## Repo layout

```
packages/core       Pure TS: types, signal registry, fusion engine, shared
                    signals (metadata, AI signatures, fact-check)
packages/extension  MV3 extension: background router, offscreen WASM analysis,
                    content-script badges, popup, verdict page
packages/registry   Zero-dep verdict API: hash lookup, BK-tree pHash index,
                    shareable /v/:sha pages
packages/bot        Telegram bot (grammY + sharp) reusing the core pipeline
docs/DESIGN.md      Full product vision, gap map, roadmap
scripts/gen-icons.mjs  Dependency-free icon generator
```

## License

Apache-2.0
