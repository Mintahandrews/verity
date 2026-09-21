import { createServer } from 'node:http';
import type { Verdict, VerdictState } from '@verity/core';
import { RegistryStore } from './store.ts';
import { verdictPage } from './page.ts';
import { dashboardPage } from './dashboard.ts';

const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, '');
const store = new RegistryStore(process.env.VERITY_DB ?? 'registry.json');
const MAX_BODY_BYTES = 256 * 1024; // verdicts are small; media never uploads
const POST_LIMIT = Number(process.env.RATE_LIMIT_POSTS ?? 120);
const POST_WINDOW_MS = 3_600_000;

interface SubmitBody {
  sha256?: string;
  phash?: string;
  url?: string;
  verdict?: Verdict;
}

// Per-IP sliding-window limiter on writes (reads stay open — it's a lookup API).
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

/** Minimal shape check — the registry stores untrusted client verdicts verbatim. */
function isVerdict(v: unknown): v is Verdict {
  const o = v as Verdict;
  return (
    typeof o === 'object' &&
    o !== null &&
    VALID_STATES.includes(o.state) &&
    typeof o.headline === 'string' &&
    Array.isArray(o.signals)
  );
}

const JSON_HEADERS = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };

function send(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

async function readBody(req: import('node:http').IncomingMessage): Promise<SubmitBody> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('body too large');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as SubmitBody;
}

createServer(async (req, res) => {
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

  if (path === '/healthz') {
    send(res, 200, { ok: true, records: store.count() });
    return;
  }

  // Public stats + the newsroom dashboard.
  if (path === '/api/stats' && req.method === 'GET') {
    send(res, 200, store.stats());
    return;
  }
  if (path === '/' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(dashboardPage(store.stats(), store.recent(20)));
    return;
  }

  // Submit a verdict: { sha256, phash?, url?, verdict } → { id, shareUrl }
  if (path === '/api/verdicts' && req.method === 'POST') {
    const ip = req.socket.remoteAddress ?? 'unknown';
    if (!postAllowed(ip)) {
      send(res, 429, { error: 'rate limited — too many submissions' });
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
    if (body.phash && !/^[0-9a-f]{16}$/i.test(body.phash)) {
      send(res, 400, { error: 'phash must be 16 hex chars' });
      return;
    }
    if (!store.peek(body.sha256)) {
      store.put({
        sha256: body.sha256,
        ...(body.phash ? { phash: body.phash } : {}),
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
    res.end(verdictPage(rec.verdict, rec.sha256));
    return;
  }

  send(res, 404, { error: 'not found' });
}).listen(PORT, () => {
  console.log(`verity registry listening on ${PUBLIC_URL}`);
});
