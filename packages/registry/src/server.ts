import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Verdict, VerdictState } from '@checkverity/core';
import { RegistryStore, type Store } from './store.ts';
import { verdictPage } from './page.ts';
import { stampDigest } from './ots.ts';
import { NoteIndex } from './notes.ts';
import { dashboardPage } from './dashboard.ts';
import { landingPage } from './landing.ts';
import { privacyPage, termsPage } from './legal.ts';
import { badgeSvg } from './badge.ts';

const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, '');
// DATABASE_URL (Railway Postgres plugin) selects the durable backend;
// self-hosters without it keep the zero-dependency JSON file store.
async function createStore(): Promise<Store> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    try {
      const { PostgresStore } = await import('./store-pg.ts');
      const store = new PostgresStore(databaseUrl);
      await store.init();
      // One-time migration: first deploy with Postgres - import any records
      // the JSON volume file accumulated so nothing checked before is lost.
      // Gated on a meta marker, not table emptiness: an emptied table must
      // not re-import records that were deliberately deleted.
      const file = process.env.VERITY_DB ?? 'registry.json';
      if (!(await store.migrationDone())) {
        const legacy = new RegistryStore(file);
        for (const rec of legacy.all()) await store.put(rec);
        if (legacy.count() > 0) console.log(`migrated ${legacy.count()} records from JSON`);
        await store.markMigrated();
      }
      console.log('store: postgres');
      return store;
    } catch (e) {
      console.error('postgres unavailable - falling back to JSON store:', e);
    }
  }
  console.log('store: json file');
  return new RegistryStore(process.env.VERITY_DB ?? 'registry.json');
}

const store = await createStore();
// Community Notes lookup index: syncs daily from NOTES_URL when reachable
// (X gated the public TSV behind login - the endpoint stays live and just
// answers "no flagged notes" until a reachable source is configured).
const notes = new NoteIndex();
if (process.env.NOTES_SYNC !== '0') {
  void notes.sync();
  setInterval(() => void notes.sync(), 24 * 3_600_000).unref();
}
const MAX_BODY_BYTES = 256 * 1024; // verdicts are small; media never uploads
const POST_LIMIT = Number(process.env.RATE_LIMIT_POSTS ?? 120);
const POST_WINDOW_MS = 3_600_000;

interface SubmitBody {
  sha256?: string;
  phash?: string;
  phashes?: string[];
  url?: string;
  verdict?: Verdict;
  embedding?: number[];
  mincos?: number;
}

/** Array of <=1024 finite numbers = a valid embedding. */
function isEmbedding(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.length <= 1024 &&
    v.every((x) => typeof x === 'number' && Number.isFinite(x))
  );
}

// Per-IP sliding-window limiter on writes (reads stay open - it's a lookup API).
const postHits = new Map<string, number[]>();
let lastSweep = Date.now();

/** Real client IP behind Railway's edge proxy - remoteAddress is the proxy. */
function clientIp(req: import('node:http').IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

function postAllowed(ip: string, now = Date.now()): boolean {
  // Sweep stale buckets so the map can't grow without bound.
  if (now - lastSweep > POST_WINDOW_MS) {
    lastSweep = now;
    for (const [k, times] of postHits) {
      const live = times.filter((t) => now - t < POST_WINDOW_MS);
      if (live.length === 0) postHits.delete(k);
      else postHits.set(k, live);
    }
  }
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

const VALID_OUTCOMES = new Set(['positive', 'negative', 'neutral', 'unsupported', 'error']);

/** Full shape check - stored verdicts are untrusted input rendered into HTML.
 *  Length caps keep a max-size body from storing oversized strings that then
 *  render on public pages. */
function isVerdict(v: unknown): v is Verdict {
  const o = v as Verdict;
  const str = (s: unknown, max: number): s is string =>
    typeof s === 'string' && s.length <= max;
  if (
    typeof o !== 'object' ||
    o === null ||
    !VALID_STATES.includes(o.state) ||
    !str(o.headline, 300) ||
    !Array.isArray(o.signals) ||
    o.signals.length > 40 ||
    !str(o.checkedAt, 40) ||
    typeof o.confidence !== 'number' ||
    !Number.isFinite(o.confidence) ||
    (o.error !== undefined && !str(o.error, 300)) ||
    (o.shareUrl !== undefined &&
      (!str(o.shareUrl, 2048) || !/^https?:/.test(o.shareUrl)))
  ) {
    return false;
  }
  return o.signals.every(
    (s) =>
      typeof s === 'object' &&
      s !== null &&
      str(s.signalId, 80) &&
      str(s.signalName, 80) &&
      VALID_OUTCOMES.has(s.outcome) &&
      typeof s.confidence === 'number' &&
      Number.isFinite(s.confidence) &&
      str(s.summary, 500) &&
      (s.conclusive === undefined || typeof s.conclusive === 'boolean') &&
      Array.isArray(s.evidence) &&
      s.evidence.length <= 12 &&
      s.evidence.every(
        (e) =>
          typeof e === 'object' &&
          e !== null &&
          str(e.label, 300) &&
          (e.detail === undefined || str(e.detail, 500)),
      ),
  );
}

/**
 * Submission trust tier. The POST API is anonymous - anyone could otherwise
 * mint a "verified" verdict for any sha256 and poison shared lookups. Only
 * trusted submitters (bot, carrying VERITY_API_KEY) may publish 'verified';
 * unverified/suspicious stay open since they can only add caution, not trust.
 */
function trustedSubmit(req: import('node:http').IncomingMessage): boolean {
  const key = process.env.VERITY_API_KEY;
  const h = req.headers['x-verity-key'];
  if (!key || typeof h !== 'string') return false;
  // Constant-time compare - this key mints 'verified' verdicts and deletions.
  const a = Buffer.from(h);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

const JSON_HEADERS = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };

function send(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

async function readBody(req: import('node:stream').Readable): Promise<SubmitBody> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req as unknown as AsyncIterable<Buffer>) {
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
      'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    res.end();
    return;
  }

  // Link validators (Discord, crawlers) probe with HEAD - treat as GET;
  // Node suppresses the response body for HEAD automatically.
  if (req.method === 'HEAD') req.method = 'GET';

  const url = new URL(req.url ?? '/', PUBLIC_URL);
  const path = url.pathname;

  // Global security & caching headers
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'SAMEORIGIN');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');

  if (path === '/healthz') {
    send(res, 200, { ok: true, records: (await store.count()) });
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
    const recent = (await store.recent(50));
    const urls = [
      `  <url><loc>${PUBLIC_URL}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
      `  <url><loc>${PUBLIC_URL}/dashboard</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>`,
      `  <url><loc>${PUBLIC_URL}/terms</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>`,
      `  <url><loc>${PUBLIC_URL}/privacy</loc><changefreq>yearly</changefreq><priority>0.2</priority></url>`,
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
- Open-Source GitHub Repository: https://github.com/Mintahandrews/verity
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
    send(res, 200, (await store.stats()));
    return;
  }
  if (path === '/' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(landingPage((await store.stats()), PUBLIC_URL));
    return;
  }
  if (path === '/dashboard' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(dashboardPage((await store.stats()), (await store.recent(20)), PUBLIC_URL));
    return;
  }
  if ((path === '/terms' || path === '/privacy') && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(path === '/terms' ? termsPage(PUBLIC_URL) : privacyPage(PUBLIC_URL));
    return;
  }

  // Submit a verdict: { sha256, phash?, url?, verdict } → { id, shareUrl }
  if (path === '/api/verdicts' && req.method === 'POST') {
    const ip = clientIp(req);
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
    if (body.verdict.state === 'verified' && !trustedSubmit(req)) {
      send(res, 403, { error: 'verified verdicts require a trusted submitter key' });
      return;
    }
    const phashes = (body.phashes ?? (body.phash ? [body.phash] : []))
      .slice(0, 8)
      .map((p) => String(p).toLowerCase());
    if (phashes.some((p) => !/^[0-9a-f]{16}$/.test(p))) {
      send(res, 400, { error: 'phash/phashes must be 16 hex chars each (max 8)' });
      return;
    }
    if (!(await store.peek(body.sha256))) {
      // Anchor the content hash to a public timestamp calendar (hash-only,
      // ~3s worst case). Failure is non-fatal: records work without it.
      const ots = await stampDigest(body.sha256).catch(() => null);
      await store.put({
        sha256: body.sha256,
        ...(phashes[0] ? { phash: phashes[0] } : {}),
        ...(phashes.length ? { phashes } : {}),
        ...(typeof body.url === 'string' && body.url.length <= 2048 && /^https?:/.test(body.url)
          ? { url: body.url }
          : {}),
        verdict: body.verdict,
        ...(ots ? { ots } : {}),
        ...(isEmbedding(body.embedding) ? { embedding: body.embedding } : {}),
        createdAt: new Date().toISOString(),
        hits: 0,
      });
    }
    send(res, 201, { id: body.sha256, shareUrl: `${PUBLIC_URL}/v/${body.sha256}` });
    return;
  }

  // Moderation: trusted-key delete (removes poisoned/abuse records).
  const deleteMatch = path.match(/^\/api\/verdicts\/([0-9a-f]{64})$/);
  if (deleteMatch && req.method === 'DELETE') {
    if (!trustedSubmit(req)) {
      send(res, 403, { error: 'deletion requires a trusted submitter key' });
      return;
    }
    const gone = await store.remove(deleteMatch[1]!);
    send(res, gone ? 200 : 404, { ok: gone });
    return;
  }

  // Exact-hash lookup
  const verdictMatch = path.match(/^\/api\/verdicts\/([0-9a-f]{64})$/);
  if (verdictMatch && req.method === 'GET') {
    const rec = (await store.get(verdictMatch[1]!));
    if (!rec) {
      send(res, 404, { error: 'not found' });
      return;
    }
    send(res, 200, {
      ...rec.verdict,
      shareUrl: `${PUBLIC_URL}/v/${rec.sha256}`,
      ...(rec.ots ? { ots: rec.ots } : {}),
    });
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
    const hits = (await store.similar(phash.toLowerCase(), maxDist)).map(({ record, distance }) => ({
      sha256: record.sha256,
      url: record.url,
      createdAt: record.createdAt,
      distance,
      verdict: record.verdict,
    }));
    send(res, 200, { results: hits });
    return;
  }

  // Semantic near-dupes: POST /api/similar-embedding { embedding, mincos? }
  // (vectors are too large for a query string, hence POST for a read).
  if (path === '/api/similar-embedding' && req.method === 'POST') {
    // Cosine scan is O(records * dims) - same abuse surface as a write, so it
    // shares the per-IP post limiter.
    if (!postAllowed(clientIp(req))) {
      send(res, 429, { error: 'rate limited' });
      return;
    }
    const body = await readBody(req).catch(() => null);
    if (!body || !isEmbedding(body.embedding)) {
      send(res, 400, { error: 'embedding (array of <=1024 numbers) is required' });
      return;
    }
    const minCos = Math.min(Math.max(Number(body.mincos ?? 0.9), 0.5), 1);
    const hits = (await store.similarEmbedding(body.embedding, minCos)).map(
      ({ record, similarity }) => ({
        sha256: record.sha256,
        url: record.url,
        createdAt: record.createdAt,
        similarity,
        verdict: record.verdict,
      }),
    );
    send(res, 200, { results: hits });
    return;
  }

  // Community Notes: /api/notes?ids=<csv of tweet status ids>
  if (path === '/api/notes' && req.method === 'GET') {
    const ids = (url.searchParams.get('ids') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d{5,25}$/.test(s))
      .slice(0, 50);
    const flagged = ids.flatMap((id) => {
      const summary = notes.get(id);
      return summary !== undefined ? [{ id, summary }] : [];
    });
    send(res, 200, { flagged, indexed: notes.size });
    return;
  }

  // Fact-check relay: /api/factcheck?query=<caption text>. Keeps
  // FACT_CHECK_API_KEY server-side so extension installs don't each need a
  // key. Caption text relays to Google - same destination as a direct call.
  if (path === '/api/factcheck' && req.method === 'GET') {
    if (!postAllowed(clientIp(req))) {
      send(res, 429, { error: 'rate limited' });
      return;
    }
    const key = process.env.FACT_CHECK_API_KEY;
    if (!key) {
      send(res, 503, { error: 'fact-check relay not configured' });
      return;
    }
    const query = (url.searchParams.get('query') ?? '').trim().slice(0, 400);
    if (query.length < 10) {
      send(res, 400, { error: 'query (10+ chars) is required' });
      return;
    }
    try {
      const upstream = await fetch(
        `https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(query)}&languageCode=en&key=${key}`,
        { signal: AbortSignal.timeout(5000) },
      );
      send(res, upstream.ok ? 200 : 502, upstream.ok ? await upstream.json() : { error: 'upstream failed' });
    } catch {
      send(res, 502, { error: 'upstream unreachable' });
    }
    return;
  }

  // Embeddable verdict badge: /badge/<sha>.svg - shields-style, safe to
  // hotlink anywhere. Short cache since records can be deleted.
  const badgeMatch = path.match(/^\/badge\/([0-9a-f]{64})\.svg$/);
  if (badgeMatch && req.method === 'GET') {
    const rec = await store.peek(badgeMatch[1]!);
    const state = rec ? (rec.verdict.error ? 'failed' : rec.verdict.state) : 'failed';
    res.writeHead(200, {
      'content-type': 'image/svg+xml',
      'cache-control': 'public, max-age=300',
    });
    res.end(badgeSvg(state, rec ? undefined : 'not found'));
    return;
  }

  // Shareable human page
  const pageMatch = path.match(/^\/v\/([0-9a-f]{64})$/);
  if (pageMatch && req.method === 'GET') {
    const rec = (await store.peek(pageMatch[1]!));
    if (!rec) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('verdict not found');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(verdictPage(rec.verdict, rec.sha256, PUBLIC_URL, rec.ots));
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
