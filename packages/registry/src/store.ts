import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Verdict } from '@verity/core';
import { BKTree } from './bktree.ts';

export interface RegistryRecord {
  sha256: string;
  phash?: string;
  /** Multi-frame fingerprints (video) - phash stays as the first for compat. */
  phashes?: string[];
  url?: string;
  verdict: Verdict;
  /** OpenTimestamps token (hex) anchoring sha256 to a public calendar. */
  ots?: string;
  /** CLIP image embedding (L2-normalized), for semantic near-duplicate search. */
  embedding?: number[];
  createdAt: string;
  hits: number;
}

export interface SimilarHit {
  record: RegistryRecord;
  distance: number;
}

export interface EmbeddingHit {
  record: RegistryRecord;
  similarity: number;
}

type MaybePromise<T> = T | Promise<T>;

/**
 * Storage seam: the JSON file and Postgres backends share one interface so
 * server.ts never branches. Sync methods satisfy MaybePromise - callers
 * simply `await` every read/write.
 */
export interface Store {
  /** Connect/create schema + warm any caches. No-op for the JSON backend. */
  init?(): MaybePromise<void>;
  get(sha256: string): MaybePromise<RegistryRecord | undefined>;
  peek(sha256: string): MaybePromise<RegistryRecord | undefined>;
  put(rec: RegistryRecord): MaybePromise<void>;
  /** Moderation: drop a record + its index entries. Returns false if absent. */
  remove(sha256: string): MaybePromise<boolean>;
  similar(phash: string, maxDist: number): MaybePromise<SimilarHit[]>;
  similarEmbedding(vec: ArrayLike<number>, minCos: number): MaybePromise<EmbeddingHit[]>;
  count(): MaybePromise<number>;
  recent(limit?: number): MaybePromise<RegistryRecord[]>;
  stats(): MaybePromise<Record<string, number>>;
  flush?(): MaybePromise<void>;
}

/**
 * Shared in-memory index: every backend keeps the full record set + BK-tree
 * in RAM - reads never touch the persistence layer, and pHash similarity
 * search needs the tree regardless of where bytes live.
 */
export abstract class IndexedStore implements Store {
  protected records = new Map<string, RegistryRecord>();
  private phashIndex = new Map<string, RegistryRecord[]>();
  private tree = new BKTree();
  /** sha256 → unit vector; brute-force cosine is fine at registry scale. */
  private embIndex = new Map<string, Float32Array>();

  protected index(rec: RegistryRecord): void {
    // Idempotent: concurrent puts of the same sha256 must not double-append
    // the phash index (peek→put is not atomic in the server path).
    if (this.records.has(rec.sha256)) return;
    this.records.set(rec.sha256, rec);
    for (const phash of rec.phashes ?? (rec.phash ? [rec.phash] : [])) {
      this.tree.add(BigInt(`0x${phash}`));
      const list = this.phashIndex.get(phash) ?? [];
      list.push(rec);
      this.phashIndex.set(phash, list);
    }
    if (rec.embedding?.length) {
      const v = Float32Array.from(rec.embedding);
      const n = Math.hypot(...v);
      if (n > 0) this.embIndex.set(rec.sha256, v.map((x) => x / n));
    }
  }

  /** Drop from memory + rebuild the pHash index (BK-trees have no remove). */
  protected deindex(sha256: string): boolean {
    if (!this.records.delete(sha256)) return false;
    this.phashIndex.clear();
    this.embIndex.delete(sha256);
    this.tree = new BKTree();
    for (const r of this.records.values()) {
      for (const phash of r.phashes ?? (r.phash ? [r.phash] : [])) {
        this.tree.add(BigInt(`0x${phash}`));
        const list = this.phashIndex.get(phash) ?? [];
        list.push(r);
        this.phashIndex.set(phash, list);
      }
    }
    return true;
  }

  abstract get(sha256: string): MaybePromise<RegistryRecord | undefined>;

  peek(sha256: string): RegistryRecord | undefined {
    return this.records.get(sha256);
  }

  abstract put(rec: RegistryRecord): MaybePromise<void>;

  abstract remove(sha256: string): MaybePromise<boolean>;

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

  /** Cosine similarity over stored embeddings, descending. */
  similarEmbedding(vec: ArrayLike<number>, minCos: number): EmbeddingHit[] {
    const q = Float32Array.from(vec);
    const n = Math.hypot(...q);
    if (n === 0) return [];
    const qn = q.map((x) => x / n);
    const hits: EmbeddingHit[] = [];
    for (const [sha, v] of this.embIndex) {
      if (v.length !== qn.length) continue;
      let dot = 0;
      for (let i = 0; i < v.length; i++) dot += v[i]! * qn[i]!;
      if (dot >= minCos) {
        hits.push({ record: this.records.get(sha)!, similarity: dot });
      }
    }
    return hits.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
  }

  count(): number {
    return this.records.size;
  }

  /** Every record - used by the one-time JSON→Postgres migration. */
  all(): RegistryRecord[] {
    return [...this.records.values()];
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
}

/**
 * JSON-file store - zero dependencies, self-hostable anywhere. Writes are
 * batched and flushed to disk every 5s.
 */
export class RegistryStore extends IndexedStore {
  private dirty = false;
  private file: string;

  constructor(file: string) {
    super();
    this.file = file;
    if (existsSync(file)) {
      const rows = JSON.parse(readFileSync(file, 'utf8')) as RegistryRecord[];
      for (const r of rows) this.index(r);
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

  put(rec: RegistryRecord): void {
    this.index(rec);
    this.dirty = true;
  }

  remove(sha256: string): boolean {
    const gone = this.deindex(sha256);
    if (gone) this.dirty = true;
    return gone;
  }

  flush(): void {
    if (!this.dirty) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify([...this.records.values()]));
    this.dirty = false;
  }
}
