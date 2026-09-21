import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { sniffMime } from '@verity/core';
import type { MediaKind, Verdict } from '@verity/core';
import { analyzeBuffer } from './pipeline.ts';
import { shutdownOcr } from './ocr.ts';

/**
 * Newsroom bulk intake: analyze a folder of media → verdicts as JSON + CSV.
 *
 *   node src/scan.ts <dir-or-file> [--out report]
 *
 * Writes <out>.json (full verdicts) and <out>.csv (one row per file).
 * Concurrency is 2 — OCR + video frame extraction are CPU-heavy.
 */

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.m4v']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.m4a', '.ogg']);

function kindOf(file: string, buf: Buffer): MediaKind | null {
  const ext = extname(file).toLowerCase();
  if (IMAGE_EXT.has(ext)) return 'image';
  if (VIDEO_EXT.has(ext)) return 'video';
  if (AUDIO_EXT.has(ext)) return 'audio';
  // Unknown extension — trust the bytes.
  const mime = sniffMime(new Uint8Array(buf));
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('video/')) return 'video';
  if (mime?.startsWith('audio/')) return 'audio';
  return null;
}

async function collect(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collect(p)));
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

interface Row {
  file: string;
  state: string;
  confidence: number;
  headline: string;
  signals: string;
  shareUrl: string;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const target = args[0];
  if (!target) {
    console.log('usage: node src/scan.ts <dir-or-file> [--out report]');
    process.exit(1);
  }
  const outBase = process.argv.includes('--out')
    ? (process.argv[process.argv.indexOf('--out') + 1] ?? 'report')
    : null;

  const root = resolve(target);
  const files = (await stat(root)).isDirectory() ? await collect(root) : [root];
  console.error(`scanning ${files.length} files…`);

  const rows: Row[] = [];
  const verdicts: Record<string, Verdict> = {};
  let i = 0;
  const queue = [...files];
  const workers = Array.from({ length: 2 }, async () => {
    for (;;) {
      const file = queue.shift();
      if (!file) return;
      i++;
      try {
        const buf = await readFile(file);
        const kind = kindOf(file, buf);
        if (!kind) continue;
        const verdict = await analyzeBuffer(kind, `file://${file}`, buf);
        verdicts[file] = verdict;
        rows.push({
          file,
          state: verdict.state,
          confidence: verdict.confidence,
          headline: verdict.headline,
          signals: verdict.signals.map((s) => `${s.signalId}:${s.outcome}`).join(' '),
          shareUrl: verdict.shareUrl ?? '',
        });
      } catch (e) {
        rows.push({
          file,
          state: 'error',
          confidence: 0,
          headline: e instanceof Error ? e.message : String(e),
          signals: '',
          shareUrl: '',
        });
      }
      if (i % 10 === 0) console.error(`  ${i}/${files.length}`);
    }
  });
  await Promise.all(workers);
  await shutdownOcr();

  const csv = [
    'file,state,confidence,headline,signals,shareUrl',
    ...rows.map((r) =>
      [r.file, r.state, String(r.confidence), r.headline, r.signals, r.shareUrl]
        .map(csvCell)
        .join(','),
    ),
  ].join('\n');

  if (outBase) {
    await writeFile(`${outBase}.csv`, csv);
    await writeFile(`${outBase}.json`, JSON.stringify(verdicts, null, 2));
    console.error(`wrote ${outBase}.csv + ${outBase}.json`);
  } else {
    console.log(csv);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
