# @verity/core

> Pure TypeScript multi-signal media authenticity engine, C2PA manifest evaluator, perceptual hash BK-tree index, and forensic fusion core.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](../../LICENSE)
[![Standard: C2PA](https://img.shields.io/badge/Standard-C2PA%20Content%20Credentials-00c853.svg)](https://c2pa.org/)

`@verity/core` is the platform-agnostic analytical engine behind Verity. It contains zero DOM or Node-specific dependencies, running identically in browsers, Chrome Extension offscreen WASM workers, Node.js services, Cloudflare Workers, and serverless environments.

---

## The Verity Philosophy: "What can we verify?"

Traditional AI detectors attempt to answer *"is this fake?"* with fragile statistical models that frequently misclassify authentic smartphone photos as synthetic.

`@verity/core` reframes verification into **evidence fusion**:
- ✅ **`verified`**: Cryptographically signed provenance confirmed (valid C2PA x509 certificate chain).
- ❓ **`unverified`**: Insufficient provenance found. This is the natural baseline for most internet media — it does **not** imply the content is false.
- ⚠️ **`suspicious`**: Direct counter-evidence identified (tampered C2PA manifest, prior sightings under contradictory context, or debunked fact-checks).

---

## Signal Architecture

| Signal | Source | Role |
| :--- | :--- | :--- |
| **`c2pa`** | `@contentauth/c2pa-web` / `c2pa-node` | Validates signed provenance manifests and x509 certificate chains. |
| **`forensics`** | `exifr` | Camera EXIF, editing software history, GPS metadata, and AI-generator tags. |
| **`phash`** | 64-bit dHash / DCT pHash | Perceptual fingerprinting robust to crops, scaling, and compression. |
| **`bktree`** | Built-in Metric Tree | O(log N) nearest-neighbor search for perceptual near-duplicates. |
| **`factCheck`** | Google Fact Check Tools / ClaimReview | Newsroom debunks and journalist fact-check matches. |
| **`daylight`** | `suncalc` | Validates sun position against EXIF GPS and timestamp. |
| **`weather`** | Open-Meteo Archive | Cross-checks claimed weather against historical meteorological records. |
| **`domainAge`** | RDAP protocol | Evaluates publisher domain registration age. |

---

## Installation

```bash
npm install @verity/core
```

---

## Usage Example

```typescript
import { fuseSignals, computeHammingDistance, BKTree } from '@verity/core';
import type { SignalResult, Verdict } from '@verity/core';

// 1. Collect signals from available analyzers
const signals: SignalResult[] = [
  {
    type: 'c2pa',
    status: 'unsupported',
    summary: 'No C2PA manifest found in image container'
  },
  {
    type: 'forensics',
    status: 'positive',
    summary: 'Sony ILCE-7M4 camera metadata verified; Lightroom edit history consistent'
  }
];

// 2. Compute the multi-signal verdict
const verdict: Verdict = fuseSignals(signals);

console.log(verdict.state);    // 'unverified'
console.log(verdict.headline); // 'No cryptographic provenance found. Baseline state for web media.'
```

---

## Perceptual Hash BK-Tree

Fast near-duplicate retrieval with metric distance bounds:

```typescript
import { BKTree } from '@verity/core';

const tree = new BKTree();

// Add 16-character hex perceptual hashes
tree.add('d3c2a1b4e5f60718', 'sha256_record_1');
tree.add('d3c2a1b4e5f60719', 'sha256_record_2');

// Find all matches within Hamming distance <= 4
const matches = tree.search('d3c2a1b4e5f60718', 4);
console.log(matches);
```

---

## License

Apache-2.0 &copy; [Andrews Mintah](https://github.com/mintahandrews)
