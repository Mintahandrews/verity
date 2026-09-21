import { createServer } from 'node:http';
import type { Verdict } from '@verity/core';
import { RegistryStore } from './store.ts';
import { verdictPage } from './page.ts';

const PORT = Number(process.env.PORT ?? 8787);
const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/$/, '');
const store = new RegistryStore(process.env.VERITY_DB ?? 'registry.json');

interface SubmitBody {
  sha256?: string;
  phash?: string;
  url?: string;
  verdict?: Verdict;
}

const JSON_HEADERS = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };

function send(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

async function readBody(req: import('node:http').IncomingMessage): Promise<SubmitBody> {
  let data = '';
  for await (const chunk of req) data += chunk;
  return JSON.parse(data || '{}') as SubmitBody;
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

  // Submit a verdict: { sha256, phash?, url?, verdict } → { id, shareUrl }
  if (path === '/api/verdicts' && req.method === 'POST') {
    const body = await readBody(req).catch(() => ({} as SubmitBody));
    if (!body.sha256 || !/^[0-9a-f]{64}$/.test(body.sha256) || !body.verdict) {
      send(res, 400, { error: 'sha256 (hex, 64 chars) and verdict are required' });
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
