import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Verdict, VerdictState } from '@verity/core';
import { RegistryStore } from './store.ts';
import { verdictPage } from './page.ts';
import { dashboardPage } from './dashboard.ts';
import { landingPage } from './landing.ts';

const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, '');
const store = new RegistryStore(process.env.VERITY_DB ?? 'registry.json');
const MAX_BODY_BYTES = 256 * 1024; // verdicts are small; media never uploads
const POST_LIMIT = Number(process.env.RATE_LIMIT_POSTS ?? 120);
const POST_WINDOW_MS = 3_600_000;

interface SubmitBody {
  sha256?: string;
  phash?: string;
  phashes?: string[];
  url?: string;
  verdict?: Verdict;
}

// Per-IP sliding-window limiter on writes (reads stay open - it's a lookup API).
const postHits = new Map<string, number[]>();
function postAllowed(ip: string, now = Date.now()): boolean {
  const times = (postHits.get(ip) ?? []).filter((t) => now - t < POST_WINDOW_MS);
  if (times.length >= POST_LIMIT) {
    postHits.set(ip, times);
    return false;
  }
  times.push(now);
  postHits.set(ip, times);
  return true;
}

const VALID_STATES: VerdictState[] = ['verified', 'unverified', 'suspicious'];

/** Minimal shape check - the registry stores untrusted client verdicts verbatim. */
function isVerdict(v: unknown): v is Verdict {
  const o = v as Verdict;
  return (
    typeof o === 'object' &&
    o !== null &&
    VALID_STATES.includes(o.state) &&
    typeof o.headline === 'string' &&
    Array.isArray(o.signals) &&
    typeof o.checkedAt === 'string' &&
    typeof o.confidence === 'number' &&
    o.signals.every(
      (s) =>
        typeof s === 'object' &&
        s !== null &&
        typeof s.signalName === 'string' &&
        typeof s.summary === 'string' &&
        Array.isArray(s.evidence)
    )
  );
}

const JSON_HEADERS = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };

function send(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

async function readBody(req: import('node:stream').Readable): Promise<SubmitBody> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('body too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as SubmitBody;
}

const handle = async (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', PUBLIC_URL);
  const path = url.pathname;

  // Global security & caching headers
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'SAMEORIGIN');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');

  if (path === '/healthz') {
    send(res, 200, { ok: true, records: store.count() });
    return;
  }

  // SEO: robots.txt
  if (path === '/robots.txt' && req.method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    });
    res.end(`User-agent: *
Allow: /
Disallow: /api/verdicts$

Sitemap: ${PUBLIC_URL}/sitemap.xml
`);
    return;
  }

  // SEO: sitemap.xml
  if (path === '/sitemap.xml' && req.method === 'GET') {
    const recent = store.recent(50);
    const urls = [
      `  <url><loc>${PUBLIC_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      `  <url><loc>${PUBLIC_URL}/dashboard</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>`,
      ...recent.map(
        (r) =>
          `  <url><loc>${PUBLIC_URL}/v/${r.sha256}</loc><lastmod>${r.createdAt.split('T')[0]}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>`,
      ),
    ];
    res.writeHead(200, {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    });
    res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`);
    return;
  }

  // GEO: llms.txt (Generative Engine Optimization standard for AI search scrapers)
  if ((path === '/llms.txt' || path === '/.well-known/llms.txt') && req.method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    });
    res.end(`# Verity: Multi-Signal Media Authenticity Engine

> An open-source media verification engine evaluating cryptographic provenance (C2PA), perceptual near-duplicate matching, metadata forensics, and fact-checking.

## Philosophy & Core Invariants
- **Provenance, not AI guessing**: Only valid cryptographic signatures (C2PA) verify origin. Probabilistic AI detectors can never verify media.
- **Never calls media "fake"**: Most viral misinformation consists of authentic footage shared with fabricated contexts (cheapfakes). Verity outputs: Verified, Unverified, or Suspicious.
- **Strict Privacy**: Zero media bytes stored. Only SHA-256 and pHash fingerprints are queried.

## Available APIs
- \`GET /api/verdicts/:sha256\`: Look up an existing media verdict by hex SHA-256 digest.
- \`GET /api/similar?phash=:hex&maxdist=8\`: Query BK-tree index for perceptual near-duplicates (16-char hex pHash).
- \`GET /api/stats\`: Real-time counts of checked, verified, unverified, and suspicious media.
- \`POST /api/verdicts\`: Submit a locally computed verdict ({ sha256, phash?, verdict }).

## Human Interfaces
- Public Landing & FAQ: ${PUBLIC_URL}/
- Live Newsroom Registry: ${PUBLIC_URL}/dashboard
- Telegram Bot: https://t.me/CheckVerityBot
- Open-Source GitHub Repository: https://github.com/verity-project/verity
`);
    return;
  }

  // Favicon shortcut
  if (path === '/favicon.ico' && req.method === 'GET') {
    const iconFile = join(fileURLToPath(new URL('../public/assets/favicon.png', import.meta.url)));
    const body = await readFile(iconFile).catch(() => null);
    if (body) {
      res.writeHead(200, {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=604800',
      });
      res.end(body);
      return;
    }
  }

  // Static assets (images, icons, og-image)
  if (path.startsWith('/assets/') && req.method === 'GET') {
    const name = normalize(path.slice(8)).replace(/^(\.\.[/\\])+/, '');
    const file = join(fileURLToPath(new URL('../public/assets', import.meta.url)), name);
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.json': 'application/json',
      '.js': 'text/javascript',
      '.css': 'text/css',
    };
    const type = mimeMap[ext];
    const body = type ? await readFile(file).catch(() => null) : null;
    if (!type || !body) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'content-type': type,
      'cache-control': 'public, max-age=604800',
      'access-control-allow-origin': '*',
    });
    res.end(body);
    return;
  }

  // Static animation assets (lottie player + JSON anims) - self-hosted so
  // verdict pages make zero third-party requests.
  if (path.startsWith('/anim/') && req.method === 'GET') {
    const name = normalize(path.slice(6)).replace(/^(\.\.[/\\])+/, '');
    const file = join(fileURLToPath(new URL('../public/anim', import.meta.url)), name);
    const type = name.endsWith('.js')
      ? 'text/javascript'
      : name.endsWith('.json')
        ? 'application/json'
        : null;
    const body = type ? await readFile(file).catch(() => null) : null;
    if (!type || !body) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'content-type': type,
      'cache-control': 'public, max-age=86400',
      'access-control-allow-origin': '*',
    });
    res.end(body);
    return;
  }

  // Public stats + the newsroom dashboard.
  if (path === '/api/stats' && req.method === 'GET') {
    send(res, 200, store.stats());
    return;
  }
  if (path === '/' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(landingPage(store.stats(), PUBLIC_URL));
    return;
  }
  if (path === '/dashboard' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(dashboardPage(store.stats(), store.recent(20), PUBLIC_URL));
    return;
  }

  // Submit a verdict: { sha256, phash?, url?, verdict } → { id, shareUrl }
  if (path === '/api/verdicts' && req.method === 'POST') {
    const ip = req.socket.remoteAddress ?? 'unknown';
    if (!postAllowed(ip)) {
      send(res, 429, { error: 'rate limited - too many submissions' });
      return;
    }
    const body = await readBody(req).catch(() => null);
    if (
      !body ||
      !body.sha256 ||
      !/^[0-9a-f]{64}$/.test(body.sha256) ||
      !isVerdict(body.verdict)
    ) {
      send(res, 400, { error: 'sha256 (hex, 64 chars) and a valid verdict are required' });
      return;
    }
    const phashes = (body.phashes ?? (body.phash ? [body.phash] : [])).slice(0, 8);
    if (phashes.some((p) => !/^[0-9a-f]{16}$/i.test(p))) {
      send(res, 400, { error: 'phash/phashes must be 16 hex chars each (max 8)' });
      return;
    }
    if (!store.peek(body.sha256)) {
      store.put({
        sha256: body.sha256,
        ...(phashes[0] ? { phash: phashes[0] } : {}),
        ...(phashes.length ? { phashes } : {}),
        ...(body.url && /^https?:/.test(body.url) ? { url: body.url } : {}),
        verdict: body.verdict,
        createdAt: new Date().toISOString(),
        hits: 0,
      });
    }
    send(res, 201, { id: body.sha256, shareUrl: `${PUBLIC_URL}/v/${body.sha256}` });
    return;
  }

  // Exact-hash lookup
  const verdictMatch = path.match(/^\/api\/verdicts\/([0-9a-f]{64})$/);
  if (verdictMatch && req.method === 'GET') {
    const rec = store.get(verdictMatch[1]!);
    if (!rec) {
      send(res, 404, { error: 'not found' });
      return;
    }
    send(res, 200, { ...rec.verdict, shareUrl: `${PUBLIC_URL}/v/${rec.sha256}` });
    return;
  }

  // Perceptual near-dupes: /api/similar?phash=<hex>&maxdist=<n>
  if (path === '/api/similar' && req.method === 'GET') {
    const phash = url.searchParams.get('phash');
    const maxDist = Math.min(Number(url.searchParams.get('maxdist') ?? 8), 32);
    if (!phash || !/^[0-9a-f]{16}$/i.test(phash)) {
      send(res, 400, { error: 'phash (16 hex chars) is required' });
      return;
    }
    const hits = store.similar(phash.toLowerCase(), maxDist).map(({ record, distance }) => ({
      sha256: record.sha256,
      url: record.url,
      createdAt: record.createdAt,
      distance,
      verdict: record.verdict,
    }));
    send(res, 200, { results: hits });
    return;
  }

  // Shareable human page
  const pageMatch = path.match(/^\/v\/([0-9a-f]{64})$/);
  if (pageMatch && req.method === 'GET') {
    const rec = store.peek(pageMatch[1]!);
    if (!rec) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('verdict not found');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(verdictPage(rec.verdict, rec.sha256, PUBLIC_URL));
    return;
  }

  send(res, 404, { error: 'not found' });
};

// A handler bug or malformed stored record must never take down the process.
createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error('request failed:', err);
    if (!res.headersSent) send(res, 500, { error: 'internal error' });
    else res.end();
  });
}).listen(PORT, () => {
  console.log(`verity registry listening on ${PUBLIC_URL}`);
});
