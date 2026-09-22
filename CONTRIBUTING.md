# Contributing to Verity

Thank you for your interest in contributing to **Verity**! Verity is an open-source, multi-signal media authenticity engine designed to restore epistemic clarity to digital media through transparent cryptographic provenance and metadata forensics.

---

## The Verity Philosophy

Before writing code or proposing features, please review our core architectural invariants:

1. **Only cryptographic provenance (C2PA) can verify.** No AI model, heuristic, or metadata scan can prove an asset is genuine.
2. **Never call anything "fake".** Real media is routinely shared with fabricated captions (cheapfakes). We report three transparent verdicts:
   - **`verified`**: Cryptographically signed provenance confirmed.
   - **`unverified`**: Provenance absent or unconfirmed. This is the baseline state of digital media, not proof of falsity.
   - **`suspicious`**: Explicit counter-evidence discovered (signature tampering, prior sightings under contradictory contexts, known debunked debunks).
3. **Privacy by design.** User media bytes **never** leave the local device. The registry API handles only SHA-256 content hashes and perceptual hashes.

---

## Monorepo Architecture

Verity is organized as an npm workspaces monorepo:

| Package | Path | Description |
| :--- | :--- | :--- |
| **`@checkverity/core`** | `packages/core` | Pure TypeScript types, signal registry, multi-signal fusion engine, and shared analysis rules. Zero DOM dependencies. |
| **`@checkverity/extension`** | `packages/extension` | Manifest V3 Chrome/Firefox extension. Offscreen WASM analyzer for C2PA, OCR, and ONNX models. |
| **`@checkverity/registry`** | `packages/registry` | Zero-dependency verdict caching server, BK-tree perceptual hash index, and shareable verdict pages. |
| **`@checkverity/bot`** | `packages/bot` | High-throughput Telegram verification bot powered by grammY and sharp. |
| **`@checkverity/signer`** | `packages/signer` | Local C2PA signing CLI for digital creators and journalists to cryptographically stamp their original media. |

---

## Getting Started

### Prerequisites

- **Node.js**: 24.x (required - the registry and bot run TypeScript via Node strip-types)
- **npm**: >= 10.x
- **Google Chrome** (for testing the Manifest V3 browser extension)

### Setup

1. Fork the repository on GitHub and clone your fork:
   ```bash
   git clone https://github.com/Mintahandrews/verity.git
   cd verity
   ```

2. Install all workspace dependencies:
   ```bash
   npm install
   ```

3. Validate the installation:
   ```bash
   npm run typecheck
   npm test
   ```

---

## Development Workflows

### 1. Developing the Chrome Extension
```bash
npm run dev -w @checkverity/extension
```
- Open Chrome and navigate to `chrome://extensions/`.
- Toggle **Developer mode** on in the top-right corner.
- Click **Load unpacked** and select `packages/extension/dist`.
- Any code changes trigger Vite Hot Module Replacement (HMR).

### 2. Running the Verdict Registry
```bash
npm run registry
```
- Starts the local registry server at `http://localhost:8787`.
- Visit `http://localhost:8787/` for the landing page or `http://localhost:8787/dashboard` for live newsroom inspection.

### 3. Running the Telegram Bot
```bash
TELEGRAM_BOT_TOKEN="<your-token-from-BotFather>" npm run bot
```

---

## Adding a New Verification Signal

New signals should be implemented in `packages/core/src/signals/` or `packages/extension/src/signals/`:

1. Implement the `Signal` interface from `@checkverity/core`:
   ```typescript
   export interface Signal {
     name: string;
     run(context: MediaContext): Promise<SignalResult>;
   }
   ```
2. Ensure outcomes conform to standard states:
   - `positive`: Confirms cryptographic provenance (reserved for C2PA)
   - `negative`: Contradicts claims or detects tampering
   - `neutral`: Inconclusive or baseline
   - `unsupported`: Media type or file missing required metadata
   - `error`: Analysis failed gracefully
3. Write thorough unit tests using Vitest in a corresponding `*.test.ts` file.

---

## Code Quality & Testing Guidelines

- **Zero Unhandled Rejections**: Analysis of corrupt or unusual media files must never crash the service worker or server.
- **Strict Typing**: All packages run with strict TypeScript mode (`tsc --noEmit`).
- **Zero Heavy External Runtimes on Registry**: The registry is intentionally zero-dependency (native `node:http`) to ensure instant deployment anywhere.

---

## Submitting a Pull Request

1. Create a feature branch:
   ```bash
   git checkout -b feat/my-signal-or-fix
   ```
2. Commit your changes using descriptive commit messages:
   ```bash
   git commit -m "feat(core): add EXIF camera model timestamp validator"
   ```
3. Ensure all tests pass:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
4. Push to your fork and open a Pull Request against the `main` branch.
5. Fill out the PR template checklist completely.
