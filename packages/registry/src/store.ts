import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Verdict } from '@verity/core';

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

function hammingHex(a: string, b: string): number {
  let d = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (d) {
    n += Number(d & 1n);
    d >>= 1n;
  }
  return n;
}

/**
 * JSON-file store — zero dependencies, self-hostable anywhere. Scales to tens
 * of thousands of records; migrate to SQLite + a BK-tree pHash index when it
 * outgrows that (see docs/DESIGN.md Phase 2 notes).
 */
export class RegistryStore {
  private records = new Map<string, RegistryRecord>();
  private dirty = false;
  private file: string;

  constructor(file: string) {
    this.file = file;
    if (existsSync(file)) {
      const rows = JSON.parse(readFileSync(file, 'utf8')) as RegistryRecord[];
      for (const r of rows) this.records.set(r.sha256, r);
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
    this.dirty = true;
  }

  similar(phash: string, maxDist: number): SimilarHit[] {
    const hits: SimilarHit[] = [];
    for (const r of this.records.values()) {
      if (!r.phash) continue;
      const distance = hammingHex(phash, r.phash);
      if (distance <= maxDist) hits.push({ record: r, distance });
    }
    return hits.sort((a, b) => a.distance - b.distance).slice(0, 10);
  }

  count(): number {
    return this.records.size;
  }

  flush(): void {
    if (!this.dirty) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify([...this.records.values()]));
    this.dirty = false;
  }
}
