/**
 * X Community Notes index. X gated the public TSV downloads behind login
 * (401s as of late 2024), so this sync is opt-in: set NOTES_URL to any
 * reachable copy of the notes export (self-downloaded or mirrored) and the
 * pipeline activates. The registry then answers "does this tweet carry a
 * misleading-rated note?" in O(1).
 *
 * TSV columns (X public data schema):
 *   noteId, noteAuthorParticipantId, createdAtMillis, tweetId,
 *   classification, believable, harmful, validationDifficulty, summary, isMediaNote
 */
const DEFAULT_NOTES_URL = 'https://ton.twitter.com/i/communitynotes/notes-00000.tsv';
const SYNC_INTERVAL_MS = 24 * 3_600_000;
const FETCH_TIMEOUT_MS = 120_000; // large file, streamed line-by-line
const MISLEADING = 'MISINFORMED_OR_POTENTIALLY_MISLEADING';

export class NoteIndex {
  /** tweetId (string, not number - 19-digit ids exceed f64 precision) → summary. */
  private flagged = new Map<string, string>();
  private lastSync = 0;
  private syncing = false;

  get size(): number {
    return this.flagged.size;
  }

  /** Tweet ID → note summary, or undefined. */
  get(tweetId: string): string | undefined {
    return this.flagged.get(tweetId);
  }

  /** Fetch + parse the TSV. Safe to call repeatedly; rate-limited internally. */
  async sync(): Promise<void> {
    if (this.syncing || Date.now() - this.lastSync < SYNC_INTERVAL_MS) return;
    this.syncing = true;
    try {
      const url = process.env.NOTES_URL ?? DEFAULT_NOTES_URL;
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok || !res.body) {
        console.error(`notes sync: HTTP ${res.status} (X gated public downloads - set NOTES_URL to a reachable copy)`);
        return;
      }
      const next = await parseNotes(res.body);
      this.flagged = next;
      this.lastSync = Date.now();
      console.log(`notes sync: ${next.size} misleading-rated notes indexed`);
    } catch (e) {
      console.error('notes sync failed:', e instanceof Error ? e.message : e);
    } finally {
      this.syncing = false;
    }
  }
}

/** Stream-parse the TSV, keeping only misleading-rated notes. Exported for tests. */
export async function parseNotes(body: ReadableStream<Uint8Array>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let cols: Record<string, number> | null = null;

  const eat = (line: string): void => {
    const f = line.split('\t');
    if (!cols) {
      cols = {};
      f.forEach((c, i) => (cols![c.trim()] = i));
      return;
    }
    if (f[cols['classification']!] === MISLEADING) {
      const id = f[cols['tweetId']!];
      if (id) out.set(id, f[cols['summary']!] ?? '');
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      eat(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
  if (buf.trim()) eat(buf);
  return out;
}
