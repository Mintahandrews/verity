import { describe, expect, it } from 'vitest';
import { errorVerdict, fuse } from './fuse.ts';
import type { SignalResult } from './types.ts';

const r = (partial: Partial<SignalResult>): SignalResult => ({
  signalId: 'test',
  signalName: 'Test signal',
  outcome: 'neutral',
  confidence: 0,
  summary: '',
  evidence: [],
  ...partial,
});

describe('fuse', () => {
  it('is unverified with no signals', () => {
    expect(fuse([]).state).toBe('unverified');
  });

  it('is unverified when all results are neutral', () => {
    const v = fuse([r({ outcome: 'neutral' }), r({ outcome: 'neutral' })]);
    expect(v.state).toBe('unverified');
  });

  it('is unverified for positive but non-conclusive signals', () => {
    const v = fuse([r({ outcome: 'positive', confidence: 0.7 })]);
    expect(v.state).toBe('unverified');
  });

  it('is verified on a conclusive positive', () => {
    const v = fuse([r({ signalId: 'c2pa', outcome: 'positive', conclusive: true, confidence: 1 })]);
    expect(v.state).toBe('verified');
    expect(v.confidence).toBe(1);
  });

  it('ignores unsupported and error results', () => {
    const v = fuse([r({ outcome: 'unsupported' }), r({ outcome: 'error' })]);
    expect(v.state).toBe('unverified');
  });

  it('is suspicious when a negative exists even alongside a conclusive positive', () => {
    const v = fuse([
      r({ signalId: 'c2pa', outcome: 'positive', conclusive: true, confidence: 1 }),
      r({ signalId: 'provenance', outcome: 'negative', confidence: 0.8 }),
    ]);
    expect(v.state).toBe('suspicious');
    expect(v.confidence).toBe(0.8);
  });
});

describe('errorVerdict', () => {
  it('produces an unverified verdict carrying the failure message', () => {
    const v = errorVerdict('fetch failed: HTTP 403');
    expect(v.state).toBe('unverified');
    expect(v.error).toBe('fetch failed: HTTP 403');
    expect(v.signals[0]?.outcome).toBe('error');
  });
});
