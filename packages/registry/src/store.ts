import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Verdict } from '@verity/core';
import { BKTree } from './bktree.ts';

export interface RegistryRecord {
  sha256: string;
  phash?: string;
  url?: string;
  verdict: Verdict;
  createdAt: string;
  hits: number;
}

export interface SimilarHit {
  record: RegistryRecord;
  distance: number;
}

/**
 * JSON-file store — zero dependencies, self-hostable anywhere. Similarity
 * search runs on an in-memory BK-tree over pHashes, rebuilt on load.
 */
export class RegistryStore {
  private records = new Map<string, RegistryRecord>();
  private phashIndex = new Map<string, RegistryRecord[]>();
  private tree = new BKTree();
  private dirty = false;
  private file: string;

  constructor(file: string) {
    this.file = file;
    if (existsSync(file)) {
      const rows = JSON.parse(readFileSync(file, 'utf8')) as RegistryRecord[];
      for (const r of rows) {
        this.records.set(r.sha256, r);
        this.indexPhash(r);
      }
    }
    const timer = setInterval(() => this.flush(), 5000);
    timer.unref();
    process.on('exit', () => this.flush());
  }

  get(sha256: string): RegistryRecord | undefined {
    const r = this.records.get(sha256);
    if (r) {
      r.hits++;
      this.dirty = true;
    }
    return r;
  }

  peek(sha256: string): RegistryRecord | undefined {
    return this.records.get(sha256);
  }

  put(rec: RegistryRecord): void {
    this.records.set(rec.sha256, rec);
    this.indexPhash(rec);
    this.dirty = true;
  }

  private indexPhash(rec: RegistryRecord): void {
    if (!rec.phash) return;
    this.tree.add(BigInt(`0x${rec.phash}`));
    const list = this.phashIndex.get(rec.phash) ?? [];
    list.push(rec);
    this.phashIndex.set(rec.phash, list);
  }

  similar(phash: string, maxDist: number): SimilarHit[] {
    return this.tree
      .query(BigInt(`0x${phash}`), maxDist)
      .flatMap(({ hash, distance }) =>
        (this.phashIndex.get(hash.toString(16).padStart(16, '0')) ?? []).map((record) => ({
          record,
          distance,
        })),
      )
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10);
  }

  count(): number {
    return this.records.size;
  }

  /** Newest records first, for the dashboard. */
  recent(limit = 20): RegistryRecord[] {
    return [...this.records.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  stats(): Record<string, number> {
    const by: Record<string, number> = { total: this.records.size };
    for (const r of this.records.values()) {
      by[r.verdict.state] = (by[r.verdict.state] ?? 0) + 1;
    }
    return by;
  }

  flush(): void {
    if (!this.dirty) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify([...this.records.values()]));
    this.dirty = false;
  }
}
