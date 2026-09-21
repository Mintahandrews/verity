import type { Evidence, Signal, SignalResult } from '@verity/core';

/**
 * Probabilistic layer of the AI-detection ensemble: an ONNX image classifier
 * run via onnxruntime-web, lazy-loaded so the WASM runtime and model weights
 * only download when the user opts in.
 *
 * Default model: onnx-community/ai-image-detection-ONNX (ViT-Base, int8, ~85MB),
 * a CIFAKE-trained ai-vs-real classifier - honest about its limits: trained on
 * Stable-Diffusion-era data, so modern generators may evade it.
 * chrome.storage.local.aiModelUrl overrides the default; aiLabelIndex
 * (default 1) picks which output class means "AI". Honest cap: confidence
 * never exceeds 0.7 - these models decay.
 */

const MODEL_INPUT = 224;
const DEFAULT_MODEL_URL =
  'https://huggingface.co/onnx-community/ai-image-detection-ONNX/resolve/main/onnx/model_quantized.onnx';

// ViT normalization (mean=std=0.5): rescale pixels to [-1, 1].
async function toInput(blob: Blob): Promise<Float32Array> {
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(MODEL_INPUT, MODEL_INPUT);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, MODEL_INPUT, MODEL_INPUT);
  const { data } = ctx.getImageData(0, 0, MODEL_INPUT, MODEL_INPUT);
  const chw = new Float32Array(3 * MODEL_INPUT * MODEL_INPUT);
  const plane = MODEL_INPUT * MODEL_INPUT;
  for (let i = 0; i < plane; i++) {
    chw[i] = data[i * 4]! / 127.5 - 1;
    chw[plane + i] = data[i * 4 + 1]! / 127.5 - 1;
    chw[2 * plane + i] = data[i * 4 + 2]! / 127.5 - 1;
  }
  bmp.close();
  return chw;
}

function softmax(logits: Float32Array): number[] {
  const max = Math.max(...logits);
  const exps = [...logits].map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

// Sessions are expensive (model download + graph build) - cache per URL.
const sessions = new Map<string, Promise<import('onnxruntime-web').InferenceSession>>();
async function getSession(modelUrl: string) {
  let p = sessions.get(modelUrl);
  if (!p) {
    p = (async () => {
      const ort = await import('onnxruntime-web');
      ort.env.wasm.wasmPaths = chrome.runtime.getURL('assets/ort/');
      return ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] });
    })();
    sessions.set(modelUrl, p);
    p.catch(() => sessions.delete(modelUrl)); // retry next time on failure
  }
  return p;
}

export const aiModelSignal: Signal = {
  id: 'ai-model',
  name: 'AI classifier (experimental)',
  supports: (m) => m.kind === 'image',
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };
    const { aiModelEnabled, aiModelUrl, aiLabelIndex } = (await chrome.storage.local.get([
      'aiModelEnabled',
      'aiModelUrl',
      'aiLabelIndex',
    ])) as { aiModelEnabled?: boolean; aiModelUrl?: string; aiLabelIndex?: number };

    const modelUrl = aiModelUrl ?? DEFAULT_MODEL_URL;
    if (!aiModelEnabled && !aiModelUrl) {
      return {
        ...base,
        outcome: 'unsupported',
        confidence: 0,
        summary: 'AI classifier is off.',
        evidence: [{ label: 'Enable it in the popup - downloads an ~85MB model on first use' }],
      };
    }

    try {
      const ort = await import('onnxruntime-web');
      const session = await getSession(modelUrl);
      const input = new ort.Tensor(
        'float32',
        await toInput(media.blob),
        [1, 3, MODEL_INPUT, MODEL_INPUT],
      );
      const output = await session.run({ [session.inputNames[0]!]: input });
      const logits = output[session.outputNames[0]!]!.data as Float32Array;
      const probs = softmax(logits);
      const pAi = probs[aiLabelIndex ?? 1] ?? 0;

      const evidence: Evidence[] = [
        { label: `Classifier score: ${(pAi * 100).toFixed(0)}% synthetic` },
        { label: 'Model', detail: modelUrl },
        { label: 'Classifiers decay as generators improve - treat as one weak signal' },
      ];
      if (pAi > 0.7) {
        return {
          ...base,
          outcome: 'negative',
          confidence: Math.min(pAi, 0.7),
          summary: 'An AI classifier flags this image as likely synthetic.',
          evidence,
        };
      }
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'Classifier does not flag this image as synthetic.',
        evidence,
      };
    } catch (e) {
      return {
        ...base,
        outcome: 'error',
        confidence: 0,
        summary: 'Classifier failed to run.',
        evidence: [{ label: e instanceof Error ? e.message : String(e) }],
      };
    }
  },
};
