# @checkverity/extension

> Verity Chrome & Firefox Browser Extension (Manifest V3) — Client-side media authenticity inspector with C2PA and WASM sandbox.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](../../LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-yellow.svg)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)

The Verity extension lets users inspect any image or video on the web via right-click context menu or toolbar popup. Analysis runs **100% client-side** inside an isolated offscreen WASM document. Raw media is never transmitted to any external server.

---

## Key Features

- 🛡️ **C2PA Manifest Inspector**: Parses JUMBF boxes and validates x509 cryptographic signing certificates directly in browser WASM.
- ⚡ **Local Perceptual Hashing**: Computes 64-bit dHash / DCT pHash to detect re-uploaded, cropped, or slightly altered imagery.
- 🔍 **Metadata Forensics**: Extracts EXIF data, software signatures (e.g. Photoshop, Stable Diffusion tags, Midjourney watermarks).
- 📰 **Local OCR (Tesseract.js)**: Reads text from memes and headlines to search fact-checking databases.
- 🤖 **Optional ONNX Classifier**: Client-side synthetic media classifier running via WebAssembly (`onnxruntime-web`).
- 🎨 **Neo-Botanical UI**: Styled with the Verity design system (Forest Depths, Electric Sprout, Bone White, and custom SVG cursors).

---

## Architecture & Permissions

### Offscreen Document Sandbox
Manifest V3 service workers do not have access to the DOM or WebAssembly threads required by `@contentauth/c2pa-web`, `tesseract.js`, and `onnxruntime-web`. Verity routes heavy analytical workloads to an offscreen document (`src/offscreen/index.html`) communicating over typed Chrome runtime messages.

### Permissions Justification
- `contextMenus`: Adds "Verify with Verity" to image context menus.
- `storage`: Persists user settings, toggle preferences, and local check counts.
- `offscreen`: Runs WASM and canvas operations in background execution.
- `host_permissions <all_urls>`: Allows fetching image bytes for analysis when the user explicitly triggers verification.

---

## Development

```bash
# Install dependencies
npm install

# Build extension for production
npm run build -w @checkverity/extension

# Watch mode during development
npm run watch -w @checkverity/extension

# Create packed upload zip for Chrome Web Store
npm run pack
# Output: release/verity-extension.zip
```

### Loading in Google Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right.
3. Click **Load unpacked** and select `packages/extension/dist/`.

---

## License

Apache-2.0 &copy; [Andrews Mintah](https://github.com/mintahandrews)
