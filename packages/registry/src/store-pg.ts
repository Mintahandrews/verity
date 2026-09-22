import pg from 'pg';
import type { Verdict } from '@checkverity/core';
import { IndexedStore, type RegistryRecord } from './store.ts';

interface VerdictRow {
  sha256: string;
  phash: string | null;
  phashes: string[] | null;
  url: string | null;
  verdict: Verdict;
  ots: string | null;
  embedding: number[] | null;
  created_at: Date;
  hits: number | string;
}

/**
 * Postgres backend - the durable store for multi-instance/public deployments.
 * Records are still mirrored into the shared in-memory index (BK-tree), so
 * reads/similarity stay identical to the JSON backend; Postgres owns truth
 * for writes and crash recovery. Selected when DATABASE_URL is set.
 */
export class PostgresStore extends IndexedStore {
  private pool: pg.Pool;

  constructor(databaseUrl: string) {
    super();
    this.pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
    });
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS verdicts (
        sha256 TEXT PRIMARY KEY,
        phash TEXT,
        phashes JSONB,
        url TEXT,
        verdict JSONB NOT NULL,
        ots TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        hits BIGINT NOT NULL DEFAULT 0
      )
    `);
    // Existing tables predate the ots column - idempotent upgrade.
    await this.pool.query('ALTER TABLE verdicts ADD COLUMN IF NOT EXISTS ots TEXT');
    await this.pool.query('ALTER TABLE verdicts ADD COLUMN IF NOT EXISTS embedding JSONB');
    await this.pool.query(
      'CREATE TABLE IF NOT EXISTS verity_meta (key TEXT PRIMARY KEY, value TEXT)',
    );
    const { rows } = await this.pool.query<VerdictRow>('SELECT * FROM verdicts');
    for (const r of rows) this.index(this.toRecord(r));
  }

  /**
   * Migration marker: the JSON import must run once ever, not "whenever the
   * table is empty" - otherwise records removed by moderation resurrect on
   * the next redeploy.
   */
  async migrationDone(): Promise<boolean> {
    const { rows } = await this.pool.query<{ value: string }>(
      "SELECT value FROM verity_meta WHERE key = 'json_migrated'",
    );
    return rows.length > 0;
  }

  async markMigrated(): Promise<void> {
    await this.pool.query(
      "INSERT INTO verity_meta (key, value) VALUES ('json_migrated', '1') ON CONFLICT DO NOTHING",
    );
  }

  private toRecord(r: VerdictRow): RegistryRecord {
    return {
      sha256: r.sha256,
      ...(r.phash ? { phash: r.phash } : {}),
      ...(r.phashes?.length ? { phashes: r.phashes } : {}),
      ...(r.url ? { url: r.url } : {}),
      verdict: r.verdict,
      ...(r.ots ? { ots: r.ots } : {}),
      ...(r.embedding?.length ? { embedding: r.embedding } : {}),
      createdAt: new Date(r.created_at).toISOString(),
      hits: Number(r.hits),
    };
  }

  async get(sha256: string): Promise<RegistryRecord | undefined> {
    const r = this.records.get(sha256);
    if (r) {
      r.hits++;
      // Read counters are non-critical - fire and forget.
      this.pool
        .query('UPDATE verdicts SET hits = hits + 1 WHERE sha256 = $1', [sha256])
        .catch((e: unknown) => console.error('pg hit increment failed:', e));
    }
    return r;
  }

  async put(rec: RegistryRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO verdicts (sha256, phash, phashes, url, verdict, ots, embedding, created_at, hits)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (sha256) DO NOTHING`,
      [
        rec.sha256,
        rec.phash ?? null,
        rec.phashes?.length ? JSON.stringify(rec.phashes) : null,
        rec.url ?? null,
        JSON.stringify(rec.verdict),
        rec.ots ?? null,
        rec.embedding?.length ? JSON.stringify(rec.embedding) : null,
        rec.createdAt,
        rec.hits,
      ],
    );
    this.index(rec);
  }

  async remove(sha256: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM verdicts WHERE sha256 = $1', [
      sha256,
    ]);
    this.deindex(sha256);
    return (rowCount ?? 0) > 0;
  }
}
