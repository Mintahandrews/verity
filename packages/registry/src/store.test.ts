import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Verdict } from '@verity/core';
import { RegistryStore } from './store.ts';
import { parseNotes } from './notes.ts';

const verdict = (state: Verdict['state']): Verdict => ({
  state,
  confidence: 0,
  headline: 'test',
  signals: [],
  checkedAt: new Date().toISOString(),
});

const rec = (sha256: string, embedding?: number[]) => ({
  sha256,
  verdict: verdict('unverified'),
  createdAt: new Date().toISOString(),
  hits: 0,
  ...(embedding ? { embedding } : {}),
});

function store(): RegistryStore {
  return new RegistryStore(join(mkdtempSync(join(tmpdir(), 'verity-')), 'db.json'));
}

describe('similarEmbedding', () => {
  it('ranks cosine-similar embeddings and applies the threshold', () => {
    const s = store();
    s.put(rec('a'.repeat(64), [1, 0, 0]));
    s.put(rec('b'.repeat(64), [0, 1, 0]));
    s.put(rec('c'.repeat(64), [0.9, 0.1, 0]));

    const hits = s.similarEmbedding([1, 0, 0], 0.8);
    expect(hits.map((h) => h.record.sha256)).toEqual(['a'.repeat(64), 'c'.repeat(64)]);
    expect(hits[0]!.similarity).toBeCloseTo(1);
    // orthogonal vector below threshold
    expect(s.similarEmbedding([0, 0, 1], 0.8)).toEqual([]);
  });

  it('drops embeddings when a record is removed', () => {
    const s = store();
    s.put(rec('a'.repeat(64), [1, 0]));
    s.remove('a'.repeat(64));
    expect(s.similarEmbedding([1, 0], 0.5)).toEqual([]);
  });
});

describe('parseNotes', () => {
  it('keeps only misleading-rated notes', async () => {
    const tsv = [
      'noteId\tcreatedAtMillis\ttweetId\tclassification\tsummary',
      'n1\t1\t111\tMISINFORMED_OR_POTENTIALLY_MISLEADING\told footage, wrong year',
      'n2\t2\t222\tNOT_MISLEADING\taccurate',
      'n3\t3\t333\tMISINFORMED_OR_POTENTIALLY_MISLEADING\tAI-generated',
    ].join('\n');
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(tsv));
        c.close();
      },
    });
    const m = await parseNotes(stream);
    expect(m.size).toBe(2);
    expect(m.get('111')).toBe('old footage, wrong year');
    expect(m.has('222')).toBe(false);
  });
});
