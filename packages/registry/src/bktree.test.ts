import { describe, expect, it } from 'vitest';
import { BKTree } from './bktree.ts';

const h = (hex: string) => BigInt(`0x${hex}`);

describe('BKTree', () => {
  it('finds exact and near matches, sorted by distance', () => {
    const tree = new BKTree();
    tree.add(h('ff00ff00ff00ff00'));
    tree.add(h('ff00ff00ff00ff0f')); // distance 4
    tree.add(h('0000000000000000')); // distance 32

    const hits = tree.query(h('ff00ff00ff00ff00'), 8);
    expect(hits.map((x) => x.distance)).toEqual([0, 4]);
    expect(hits.some((x) => x.hash === h('0000000000000000'))).toBe(false);
  });

  it('respects the distance bound', () => {
    const tree = new BKTree();
    tree.add(h('0000000000000000'));
    tree.add(h('ffffffffffffffff')); // distance 64
    expect(tree.query(h('0000000000000000'), 10).map((x) => x.distance)).toEqual([0]);
  });

  it('ignores duplicate hashes', () => {
    const tree = new BKTree();
    tree.add(h('aaaa'));
    tree.add(h('aaaa'));
    expect(tree.count).toBe(1);
  });
});
