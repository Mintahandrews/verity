# @checkverity/registry

> Zero-media public verdict registry, BK-tree perceptual hash index, and newsroom dashboard for Verity.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](../../LICENSE)

`@checkverity/registry` is the public discovery and caching service for Verity. It stores **zero media bytes** — only cryptographic content digests (SHA-256), 64-bit perceptual hashes (pHash), and transparent verdict records.

---

## Architectural Principles

1. **Zero Media Storage**: Images and videos never touch the registry. The service only ingests hashes and verdict metadata.
2. **Perceptual Indexing (BK-Tree)**: Stores perceptual hashes in a Burkhard-Keller metric tree for sub-millisecond nearest-neighbor lookups across near-duplicate images.
3. **Open Access & Transparent Provenance**: Public verdict lookup pages (`/v/:sha256`) allow journalists and the public to inspect the evidence chain.
4. **Rate Limiting & Abuse Prevention**: Built-in sliding-window rate limiters prevent write floods while keeping reads open.

---

## API Endpoints

| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Neo-botanical landing page with platform overview and live stats. |
| `GET` | `/dashboard` | Newsroom lookup interface and recent check feed. |
| `GET` | `/v/:sha256` | Shareable, SEO-optimized verdict page with Schema.org JSON-LD. |
| `GET` | `/api/v1/verdicts/:sha256` | JSON API endpoint for exact hash lookup. |
| `POST` | `/api/v1/verdicts` | Submits a new verdict and indexes perceptual hashes. |
| `GET` | `/api/v1/search/phash?hash=...&maxDistance=...` | Perceptual BK-tree search for near-duplicates. |
| `GET` | `/sitemap.xml` | Dynamic XML sitemap for search engines. |
| `GET` | `/robots.txt` | Crawler policy directives. |
| `GET` | `/llms.txt` | Generative Engine Optimization (GEO/AEO) index for AI answer engines. |

---

## Running Locally

```bash
# Start the registry server (default port 8787)
npm start -w @checkverity/registry

# Or with custom port and database file:
PORT=3000 VERITY_DB=data/registry.json npm start -w @checkverity/registry
```

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8787` | HTTP port to listen on. |
| `PUBLIC_URL` | `http://localhost:${PORT}` | Canonical base URL for Open Graph and sitemaps. |
| `VERITY_DB` | `registry.json` | Path to JSON database file. |
| `RATE_LIMIT_POSTS`| `120` | Maximum write submissions per IP per hour. |

---

## License

Apache-2.0 &copy; [Andrews Mintah](https://github.com/mintahandrews)
