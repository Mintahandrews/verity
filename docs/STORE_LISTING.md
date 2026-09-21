# Chrome Web Store submission kit

Build the upload artifact:

```bash
npm run pack   # → release/verity-extension.zip (manifest at zip root)
```

## Listing fields

**Name** (max 45): `Verity - check before you share`

**Short description** (max 132):
`Verifies what can be proven about web media - provenance, prior sightings, fact-checks - and shows the evidence. Never calls anything "fake".`

**Category**: Productivity (alt: News & Weather)

**Detailed description**:

```
Most misinformation isn't a deepfake - it's a real photo with a false caption.

Verity checks what evidence actually exists about an image or video, and gives
you a transparent verdict with the reasoning shown:

  ✓ VERIFIED - a valid C2PA cryptographic signature proves who produced it
  ? UNVERIFIED - no provenance found (the normal state of most media)
  ! SUSPICIOUS - evidence contradicts the media's story

Signals it checks, locally in your browser:
• C2PA Content Credentials (cryptographic provenance)
• Metadata forensics and AI-generator signatures
• Prior sightings - content-hash matching against the public verdict registry
• Optional reverse-image search (Google Lens, opt-in)
• Optional OCR + fact-check matching against professional databases
• Optional experimental AI classifier (opt-in download)

Privacy by design: analysis runs on your device. Only content hashes are sent
to the registry - never your media. Reverse search is off by default.

Verity never labels media "fake". Unverified means provenance couldn't be
confirmed - not that the content is false.
```

## Permission justifications (Privacy tab)

- **contextMenus**: adds the "Verify with Verity" item to the image context menu - the extension's primary entry point.
- **storage**: persists verdict history and user toggles (reverse search, OCR, AI model) locally via `chrome.storage`.
- **offscreen**: C2PA verification, hashing, OCR, and the optional ONNX classifier run in an offscreen document because they require WASM/DOM APIs unavailable in a service worker.
- **host_permissions `<all_urls>`**: the user can verify an image on any page - the extension must fetch the selected image's bytes to analyze them. Nothing is fetched or injected on pages the user doesn't act on.

## Data usage disclosures (Privacy tab)

- Collects: nothing by default beyond content hashes + verdicts sent to the configured registry on check.
- If reverse-search is enabled: the public image URL is sent to Google Lens.
- No accounts, no analytics, no ads, no sale of data.
- Media bytes never leave the device (registry API accepts hashes only).

## Screenshots needed (1280×800)

1. Context menu → "Verify with Verity" on a real page
2. Verdict page showing a verified result with evidence rows
3. Verdict page showing a suspicious result (use a flagged item from the registry)
4. Popup showing toggles + check count
5. The registry landing page (https://registry-production-73c0.up.railway.app)

Store icon: `packages/extension/public/icons/icon128.png`
Small promo tile (optional): generate 440×280 from `scripts/gen-icons.mjs` if desired.
