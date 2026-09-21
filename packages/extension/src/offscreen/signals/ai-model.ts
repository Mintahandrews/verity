import type { Evidence, Signal, SignalResult } from '@verity/core';

/**
 * Probabilistic layer of the AI-detection ensemble: an ONNX image classifier
 * (e.g. a ViT ai-vs-real detector) run via onnxruntime-web, lazy-loaded so the
 * ~8MB WASM runtime only ships when a model is actually configured.
 *
 * Disabled unless chrome.storage.local.aiModelUrl is set to an ONNX model URL.
 * Optional aiLabelIndex (default 1) picks which output class means "AI".
 * Honest cap: confidence never exceeds 0.7 — these models decay.
 */

const MODEL_INPUT = 224;

async function toInput(blob: Blob): Promise<Float32Array> {
  const bmp = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(MODEL_INPUT, MODEL_INPUT);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, MODEL_INPUT, MODEL_INPUT);
  const { data } = ctx.getImageData(0, 0, MODEL_INPUT, MODEL_INPUT);
  const chw = new Float32Array(3 * MODEL_INPUT * MODEL_INPUT);
  const plane = MODEL_INPUT * MODEL_INPUT;
  for (let i = 0; i < plane; i++) {
    chw[i] = data[i * 4]! / 255;
    chw[plane + i] = data[i * 4 + 1]! / 255;
    chw[2 * plane + i] = data[i * 4 + 2]! / 255;
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

export const aiModelSignal: Signal = {
  id: 'ai-model',
  name: 'AI classifier (experimental)',
  supports: (m) => m.kind === 'image',
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };
    const { aiModelUrl, aiLabelIndex } = (await chrome.storage.local.get([
      'aiModelUrl',
      'aiLabelIndex',
    ])) as { aiModelUrl?: string; aiLabelIndex?: number };

    if (!aiModelUrl) {
      return {
        ...base,
        outcome: 'unsupported',
        confidence: 0,
        summary: 'No classifier configured.',
        evidence: [{ label: 'Set aiModelUrl in extension storage to enable' }],
      };
    }

    try {
      const ort = await import('onnxruntime-web');
      ort.env.wasm.wasmPaths = chrome.runtime.getURL('assets/ort/');
      const session = await ort.InferenceSession.create(aiModelUrl, {
        executionProviders: ['wasm'],
      });
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
        { label: 'Model', detail: aiModelUrl },
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
