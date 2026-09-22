# Verity - Multi-Signal Media Authenticity Engine

> Status: **Production Open-Source System**  
> Author: **Andrews Mintah** ([@mintahandrews](https://github.com/Mintahandrews))  
> Repository: [github.com/Mintahandrews/verity](https://github.com/Mintahandrews/verity)  
> License: **Apache-2.0** (matches C2PA SDK licensing)  

## The Core Insight

Every existing tool treats media authenticity as a **detection problem** ("is this AI-generated?"). That framing fails because:

1. **C2PA coverage is tiny** - most content has no manifest → tools "never find anything"
2. **AI detectors are unreliable** - 70-90% accuracy, decaying as generators improve; alone they're a coin flip
3. **Most viral misinformation isn't deepfakes** - it's *real media with fake context* (old footage labeled as today's event). Almost zero consumer tooling addresses this.

**Verity is a multi-signal authenticity verdict engine**: not "real/fake" but a transparent, confidence-scored verdict across every available signal.

### The three-state honesty principle

- ✅ **Verified** - cryptographically signed provenance, or multiple corroborating signals
- ❓ **Unverified** - insufficient signals to say anything (the most common verdict, and that's OK)
- ⚠️ **Suspicious** - signals contradict the claim (context mismatch, tampering indicators)

**Never say "fake."** "Unverified" protects users from false confidence and protects the project from liability.

---

## Personas & Pain

| Persona | Pain today |
|---|---|
| Ordinary people | See viral content, no way to check; don't know reverse image search exists |
| WhatsApp/Telegram users | Misinfo spreads via forwards in encrypted chats - biggest global vector, zero tooling |
| Journalists | Manual verification: reverse search + metadata + gut feel; no unified report |
| Insurance/legal | AI-generated damage photos, fake evidence - exploding problem, no intake tooling |
| Marketplaces/dating | AI rental listings, product photos, profile pics (romance scams) |
| Deepfake victims | Need to *prove* content isn't authentic - inverse use case |
| Creators | Want to prove work is real/human-made - signing UX is terrible |

---

## Gap Map

| Signal | Who does it | Gap |
|---|---|---|
| C2PA manifests | Digimarc ext, Adobe verifier | Chrome-only, raw JSON output, tiny coverage |
| Watermark recovery (Digimarc/SynthID) | Digimarc (partial) | Survives CDN stripping - underused |
| Metadata forensics (EXIF, JPEG structure) | Forensic suites (ancient UX) | Never integrated with provenance |
| AI-generation detection | Standalone detectors, unreliable | Nobody ensembles models + weighs honestly |
| **Reverse search / first-seen date** | Google Lens (manual) | **Nobody auto-checks context - the #1 misinfo pattern** |
| Fact-check DB lookup | Manual | Not linked to media |
| Crowd verdicts | Community Notes (text-focused) | No media-specific layer |
| Consumer signing ("prove real") | Adobe tools, clunky | No friendly OSS tool |

Existing tools surveyed: `digimarc-corp/c2pa-content-credentials-extension` (Chrome-only beta), `microsoft/c2pa-extension-validator` (dev preview, manual trust lists), Adobe `verify.contentauthenticity.org` (upload-only). None do multi-signal fusion, shareable verdicts, or context checking.

---

## Architecture

```
Clients: browser ext / web app / Telegram bot / mobile
        │
        ▼
   Verdict API
        │
   Signal engine (plugin-based - each returns {score, confidence, evidence}):
   ├─ c2pa-verifier        → signed manifest? valid chain? who signed?
   ├─ watermark-detector   → Digimarc/SynthID recovery
   ├─ metadata-forensics   → EXIF consistency, JPEG quantization, ELA
   ├─ ai-detector-ensemble → 3+ models, weighted, honestly reported
   ├─ provenance-tracker   → pHash → "first seen 2019, different country"
   ├─ context-checker      → claimed date/location vs shadows/weather/metadata
   └─ claim-checker        → extract text claims → fact-check DBs
        │
        ▼
   Fusion + explanation engine
   → verdict card: VERIFIED / UNVERIFIED / SUSPICIOUS
   → plain-language evidence per signal
        │
        ▼
   Public verdict registry (content hash → verdict → shareable link)
```

### Key technical decisions

- **Perceptual hashing (pHash)** - survives re-encoding/cropping; enables "first seen" tracking and dedupe
- **Privacy tiering** - C2PA + metadata + hashing run locally in the extension; only the hash leaves the device for registry lookup; deep analysis is opt-in upload
- **Plugin architecture** - each signal is isolated; C2PA spec churn can't break the whole system
- **Ensemble AI detection** - multiple open-source detectors (CNNDetection, DIRE for diffusion, HF models), weighted and honestly reported
- **Public verdict registry** - the moat. A crowdsourced hash-indexed verdict DB; every check enriches the network

---

## Killer Features (ranked by novelty)

1. **Shareable verdict links** - verify a viral image → card link to paste as a reply. Built-in viral loop.
2. **Miscontextualization detection** - "this image first appeared in 2019 in Syria" - highest-impact feature, nobody does it automatically.
3. **Telegram bot** - forward media → verdict. Reaches where misinfo actually spreads. (Telegram bot API is free; WhatsApp Business API costs money - Telegram first.)
4. **Three-state honesty** - see above.
5. **Explainable verdicts** - every signal shows evidence; what makes it credible to journalists.
6. **Privacy tiering** - local-first analysis, opt-in upload.
7. **"Prove real" signing** - consumer-friendly C2PA signing tool (Phase 4; closes the loop).
8. **Newsroom intake dashboard** - bulk pipeline + audit trail (the grant-fundable customer).

---

## Hard Problems (honest list)

- **AI detection decays** - ensemble helps; show confidence honestly, never binary
- **Reverse image search costs** - Google Lens unofficial, Bing Visual Search/TinEye paid. Options: self-hosted pHash registry (grows with usage), budget for one API, or partnership
- **"Unverified" UX problem** - most content scores unverified early. The registry is the mitigation: network effects compound
- **Spec churn** - C2PA evolving; plugin isolation + pin `c2pa-js` versions
- **CDN stripping** - most platforms strip manifests on upload. Watermark recovery partially compensates; honest verdicts handle the rest
- **Funding** - misinfo tooling has grant money (Knight Foundation, Google News Initiative, EU Horizon). OSS core + hosted API for orgs

---

## Roadmap

### Phase 1 - MVP ✅ shipped
Browser extension: C2PA verify + metadata forensics + three-state badge + verdict page with shareable link.
*Deliverable: extension + minimal verdict-page backend.*

### Phase 2 - Signal engine v1 ✅ shipped
pHash registry + reverse search + AI-detector ensemble → full verdict card.
*Deliverable: Verdict API + public registry.*

### Phase 3 - Reach ✅ shipped
Telegram bot + Discord bot + claim extraction + fact-check DBs.
*Deliverable: bot + claim-checker plugin.*

### Phase 4 - Ecosystem ✅ shipped
Newsroom dashboard + public API + "prove real" signing tool.
*Deliverable: dashboard + signing client.*

---

## Production Monorepo Stack

| Package | Role | Technology |
| :--- | :--- | :--- |
| **`@checkverity/core`** | Core Fusion Engine | Pure TypeScript, `exifr`, `suncalc`, zero-DOM |
| **`@checkverity/extension`** | Browser Inspector | Manifest V3, Vite, `@crxjs/vite-plugin`, `@contentauth/c2pa-web`, `tesseract.js`, `onnxruntime-web` |
| **`@checkverity/registry`** | Verdict & Hash Index | Node.js native HTTP, Burkhard-Keller metric tree (BK-Tree), OpenTimestamps |
| **`@checkverity/bot`** | Chat Verifier | `grammY` Telegram bot, `discord.js`, `sharp`, `c2pa-node` |
| **`@checkverity/signer`** | Creator Signing CLI | Node.js CLI, `c2pa-node`, standard x509 manifests |

