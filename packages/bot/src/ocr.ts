import { createWorker, type Worker } from 'tesseract.js';

/**
 * Text-in-image extraction for the fact-check signal. Memes and screenshots
 * carry their claims in the pixels, not the caption - without OCR the
 * fact-check signal has nothing to match on for most forwarded misinfo.
 *
 * One lazy worker per process; English only for now (tesseract.js supports
 * traineddata for ~100 languages - extend via OCR_LANGS env if needed).
 */
let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  workerPromise ??= createWorker(process.env.OCR_LANGS ?? 'eng');
  return workerPromise;
}

/** Extract visible text from an image buffer. Returns '' on failure - OCR is best-effort. */
export async function extractText(buf: Buffer): Promise<string> {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(buf);
    return data.text.trim();
  } catch {
    return '';
  }
}

export async function shutdownOcr(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise.catch(() => null);
    await worker?.terminate().catch(() => {});
    workerPromise = null;
  }
}
