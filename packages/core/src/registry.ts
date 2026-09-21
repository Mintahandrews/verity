import type { MediaDescriptor, MediaInput, Signal, SignalResult } from './types.ts';

export function errorResult(signal: Signal, cause: unknown): SignalResult {
  return {
    signalId: signal.id,
    signalName: signal.name,
    outcome: 'error',
    confidence: 0,
    summary: 'This check failed to run.',
    evidence: [{ label: 'Error', detail: cause instanceof Error ? cause.message : String(cause) }],
  };
}

export class SignalRegistry {
  private readonly signals = new Map<string, Signal>();

  register(signal: Signal): this {
    if (this.signals.has(signal.id)) throw new Error(`duplicate signal id: ${signal.id}`);
    this.signals.set(signal.id, signal);
    return this;
  }

  applicable(media: MediaDescriptor): Signal[] {
    return [...this.signals.values()].filter((s) => s.supports(media));
  }

  async run(media: MediaInput): Promise<SignalResult[]> {
    const signals = this.applicable(media);
    const settled = await Promise.allSettled(signals.map((s) => s.analyze(media)));
    return settled.map((r, i) =>
      r.status === 'fulfilled' ? r.value : errorResult(signals[i]!, r.reason),
    );
  }
}
