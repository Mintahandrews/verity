interface BKNode {
  hash: bigint;
  children: Map<number, BKNode>;
}

function hamming(a: bigint, b: bigint): number {
  let d = a ^ b;
  let n = 0;
  while (d) {
    n += Number(d & 1n);
    d >>= 1n;
  }
  return n;
}

/**
 * BK-tree: metric-space index over 64-bit perceptual hashes using hamming
 * distance. Query cost is ~O(log n) instead of linear scan — keeps
 * /api/similar fast once the registry holds thousands of records.
 */
export class BKTree {
  private root: BKNode | undefined;
  private size = 0;

  add(hash: bigint): void {
    if (!this.root) {
      this.root = { hash, children: new Map() };
      this.size++;
      return;
    }
    let node = this.root;
    for (;;) {
      const d = hamming(node.hash, hash);
      if (d === 0) return; // identical hash already indexed
      const child = node.children.get(d);
      if (!child) {
        node.children.set(d, { hash, children: new Map() });
        this.size++;
        return;
      }
      node = child;
    }
  }

  /** All hashes within maxDist of the query, sorted by distance. */
  query(hash: bigint, maxDist: number): Array<{ hash: bigint; distance: number }> {
    const hits: Array<{ hash: bigint; distance: number }> = [];
    const stack: BKNode[] = this.root ? [this.root] : [];
    while (stack.length) {
      const node = stack.pop()!;
      const d = hamming(node.hash, hash);
      if (d <= maxDist) hits.push({ hash: node.hash, distance: d });
      for (const [edge, child] of node.children) {
        // Triangle inequality: only edges within [d-maxDist, d+maxDist] can match.
        if (edge >= d - maxDist && edge <= d + maxDist) stack.push(child);
      }
    }
    return hits.sort((a, b) => a.distance - b.distance);
  }

  get count(): number {
    return this.size;
  }
}
