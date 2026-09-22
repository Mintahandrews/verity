# @verity/bot

> High-throughput Telegram & Discord verification bot for Verity, powered by grammY and sharp.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](../../LICENSE)
[![Telegram Bot](https://img.shields.io/badge/Telegram-@CheckVerityBot-229ED9.svg)](https://t.me/CheckVerityBot)

`@verity/bot` brings instant media verification directly to chat apps where misinformation spreads fastest. Users forward viral images or videos to [`@CheckVerityBot`](https://t.me/CheckVerityBot) and receive an instant evidence-backed verdict.

---

## Capabilities

- 🤖 **Instant Forward Analysis**: Users forward images or video frames directly from private or group chats.
- ⚡ **Multi-Signal Extraction**: Extracts C2PA manifests (via `c2pa-node`), EXIF metadata, camera footprints, and perceptual hashes.
- 🔗 **Shareable Verdict Links**: Automatically generates public registry permalinks for newsroom distribution.
- 🛡️ **Sliding-Window Rate Limiting**: In-memory token bucket prevents spam while preserving high responsiveness.

---

## Configuration

Set the following environment variables:

```bash
# Telegram Bot Token from @BotFather
export TELEGRAM_BOT_TOKEN="your_bot_token_here"

# Registry API endpoint (optional, defaults to https://verity.dev)
export VERITY_REGISTRY_URL="http://localhost:8787"
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Start the bot
npm start -w @verity/bot
```

---

## License

Apache-2.0 &copy; [Andrews Mintah](https://github.com/mintahandrews)
