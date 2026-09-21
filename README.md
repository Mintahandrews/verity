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

## Signing ("prove real")

Creators can sign media so Verity (and any C2PA verifier) returns `verified`:

```bash
npm run sign -- input.jpg signed.jpg --cert cert.pem --key key.pem
npm run sign -- input.jpg signed.jpg --test   # ephemeral test cert, dev only
```

Test certs aren't on the C2PA trust list — production signing needs a real
certificate. Signing is fully local; nothing leaves the machine.

## Registry dashboard

`npm run registry` also serves a dashboard at `/` — verdict stats, recent
checks, and hash lookup. `GET /api/stats` returns the same numbers as JSON.

## Deployment (Railway)

A public registry runs at `https://registry-production-73c0.up.railway.app`
(dashboard at `/`) and the Telegram bot is live at
[`@CheckVerityBot`](https://t.me/CheckVerityBot). The Railway project deploys
from the repo root; each service runs `npm start` which dispatches on env vars:

| Service  | VERITY_PKG | VERITY_ENTRY | Extra vars |
|----------|-----------|--------------|------------|
| registry | registry  | server.ts    | `PUBLIC_URL`, `VERITY_DB=/data/registry.json` (volume at `/data`) |
| bot      | bot       | bot.ts       | `TELEGRAM_BOT_TOKEN` (required), `REGISTRY_URL`, `FACT_CHECK_API_KEY` |

Deploy a service: `railway up -s <service> -d`. The registry writes to
`VERITY_DB` — mount a volume at `/data` or every redeploy resets it.

## Newsroom bulk intake

```bash
node packages/bot/src/scan.ts <folder> --out report   # → report.csv + report.json
```

Recursively analyzes a directory of images/videos through the same pipeline
as the bot — one row per file, shareable links included when a registry is up.

## Repo layout

```
packages/core       Pure TS: types, signal registry, fusion engine, shared
                    signals (metadata, AI signatures, fact-check)
packages/extension  MV3 extension: background router, offscreen WASM analysis,
                    content-script badges, popup, verdict page
packages/registry   Zero-dep verdict API: hash lookup, BK-tree pHash index,
                    shareable /v/:sha pages
packages/bot        Telegram bot (grammY + sharp) reusing the core pipeline
packages/signer     "Prove real" CLI — embeds C2PA signed manifests locally
docs/DESIGN.md      Full product vision, gap map, roadmap
scripts/gen-icons.mjs  Dependency-free icon generator
```

## License

Apache-2.0
