/**
 * Text-in-image extraction for the fact-check signal — same idea as the bot's
 * OCR: memes and screenshots carry claims in pixels, not captions.
 *
 * MV3 constraints: blob/CDN workers are blocked by extension CSP, so the
 * worker script and wasm core ship as extension assets (public/ocr/). Only
 * the SIMD-LSTM core is vendored — browsers without SIMD wasm (pre-2021) get
 * '' and OCR is skipped. Traineddata fetches from jsdelivr (connect-src is
 * open) and caches in the extension origin.
 */
type OcrWorker = { recognize(i: Blob): Promise<{ data: { text: string } }> };
let workerPromise: Promise<OcrWorker> | undefined;

async function getWorker(): Promise<OcrWorker> {
  workerPromise ??= (async () => {
    const { createWorker, OEM } = await import('tesseract.js');
    return (await createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: chrome.runtime.getURL('ocr/worker.min.js'),
      corePath: chrome.runtime.getURL('ocr'),
      workerBlobURL: false,
    })) as unknown as OcrWorker;
  })();
  return workerPromise;
}

export async function extractText(blob: Blob): Promise<string> {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(blob);
    return data.text.trim();
  } catch {
    return '';
  }
}
