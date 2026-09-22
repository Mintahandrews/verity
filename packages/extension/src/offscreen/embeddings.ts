/**
 * CLIP vision embeddings (Xenova/clip-vit-base-patch32, int8 ~85MB) via
 * onnxruntime-web - lazy-loaded and opt-in (clipEnabled) since the weights
 * download on first use. Semantic embeddings catch near-duplicates the
 * 64-bit pHash misses (crops, edits, heavy recompression); the registry
 * stores them and answers cosine-similarity queries.
 */

const INPUT = 224;
const MODEL_URL =
  'https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/vision_model_quantized.onnx';

// CLIP normalization constants (not the ViT 0.5/0.5 used by the AI classifier).
const MEAN = [0.48145466, 0.4578275, 0.40821073];
const STD = [0.26862954, 0.26130258, 0.27577711];

async function toInput(blob: Blob): Promise<Float32Array> {
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(INPUT, INPUT);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, INPUT, INPUT);
  const { data } = ctx.getImageData(0, 0, INPUT, INPUT);
  const plane = INPUT * INPUT;
  const chw = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) {
      chw[c * plane + i] = (data[i * 4 + c]! / 255 - MEAN[c]!) / STD[c]!;
    }
  }
  bmp.close();
  return chw;
}

let session: Promise<import('onnxruntime-web').InferenceSession> | null = null;
async function getSession() {
  if (!session) {
    session = (async () => {
      const ort = await import('onnxruntime-web');
      ort.env.wasm.wasmPaths = chrome.runtime.getURL('assets/ort/');
      return ort.InferenceSession.create(MODEL_URL, { executionProviders: ['wasm'] });
    })();
    session.catch(() => (session = null)); // retry next time
  }
  return session;
}

/** L2-normalized CLIP image embedding, or null if anything fails. */
export async function clipEmbedding(blob: Blob): Promise<Float32Array | null> {
  try {
    const ort = await import('onnxruntime-web');
    const s = await getSession();
    const input = new ort.Tensor('float32', await toInput(blob), [1, 3, INPUT, INPUT]);
    const out = await s.run({ [s.inputNames[0]!]: input });
    const v = out[s.outputNames[0]!]!.data as Float32Array;
    const n = Math.hypot(...v);
    return n > 0 ? v.map((x) => x / n) : v;
  } catch {
    return null;
  }
}
