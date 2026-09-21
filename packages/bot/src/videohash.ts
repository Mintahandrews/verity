import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pHash64, pHashHex } from '@verity/core';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';

const FRAME_TIMEOUT_MS = 15_000;
// Sampled offsets: early/mid/late. Catches trimmed re-uploads that a single
// mid-frame would miss (intro cut → mid hash unchanged; tail cut → still matched).
const SEEK_SECS = [0.5, 2.5, 6];

/** Extract one frame (at `seekSec`) as a PNG buffer via the bundled ffmpeg. */
function extractFrame(videoPath: string, seekSec: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bin = ffmpegPath;
    if (!bin) return reject(new Error('ffmpeg-static binary unavailable'));
    execFile(
      bin,
      [
        '-v', 'error',
        '-ss', String(seekSec),
        '-i', videoPath,
        '-frames:v', '1',
        '-f', 'image2pipe',
        '-vcodec', 'png',
        '-',
      ],
      { timeout: FRAME_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, encoding: 'buffer' },
      (err, stdout) => {
        if (err) return reject(err);
        if (stdout.length === 0) return reject(new Error('ffmpeg produced no frame'));
        resolve(stdout);
      },
    );
  });
}

async function framePhash(png: Buffer): Promise<string> {
  const raw = await sharp(png).resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const luma = new Float64Array(1024);
  for (let i = 0; i < 1024; i++) {
    luma[i] = 0.299 * raw[i * 3]! + 0.587 * raw[i * 3 + 1]! + 0.114 * raw[i * 3 + 2]!;
  }
  return pHashHex(pHash64(luma));
}

/**
 * Multi-frame fingerprint: pHash frames at several offsets so trimmed/short
 * clips still match. Returns deduplicated hex hashes, [] if undecodable.
 */
export async function videoPhashes(buf: Buffer): Promise<string[]> {
  const dir = await mkdtemp(join(tmpdir(), 'verity-vid-'));
  const file = join(dir, 'in.bin');
  try {
    await writeFile(file, buf);
    const hashes = new Set<string>();
    for (const seek of SEEK_SECS) {
      const frame = await extractFrame(file, seek).catch(() => null);
      if (frame) hashes.add(await framePhash(frame));
      // One success is enough for short clips - stop after first failure once
      // we already have a hash (likely ran past EOF).
      if (!frame && hashes.size > 0) break;
    }
    // Very short clips: every offset may be past EOF - grab the first frame.
    if (hashes.size === 0) {
      const first = await extractFrame(file, 0).catch(() => null);
      if (first) hashes.add(await framePhash(first));
    }
    return [...hashes];
  } catch {
    return [];
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
