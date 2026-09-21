import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pHash64, pHashHex } from '@verity/core';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';

const FRAME_TIMEOUT_MS = 15_000;

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

/**
 * Perceptual hash for video: decode one mid-frame, hash its luma plane.
 * Single-frame pHash is a coarse v1 — good enough to catch re-uploads of the
 * same clip; multi-frame/audio fingerprints are a later improvement.
 */
export async function videoPhash(buf: Buffer): Promise<string | null> {
  const dir = await mkdtemp(join(tmpdir(), 'verity-vid-'));
  const file = join(dir, 'in.bin');
  try {
    await writeFile(file, buf);
    // Try ~1.5s in to skip intros/slates; fall back to the first frame.
    const frame = await extractFrame(file, 1.5).catch(() => extractFrame(file, 0));
    const raw = await sharp(frame).resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer();
    const luma = new Float64Array(1024);
    for (let i = 0; i < 1024; i++) {
      luma[i] = 0.299 * raw[i * 3]! + 0.587 * raw[i * 3 + 1]! + 0.114 * raw[i * 3 + 2]!;
    }
    return pHashHex(pHash64(luma));
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
