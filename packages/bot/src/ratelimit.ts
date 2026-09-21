/**
 * Sliding-window rate limiter. In-memory, per key (Telegram user/chat id).
 * Deliberately simple — a single bot process is the deployment unit; swap for
 * Redis if it ever scales past one process.
 */
export class RateLimiter {
  private hits = new Map<number, number[]>();
  private lastSweep = Date.now();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** True if the key may proceed; records the hit. False when over the limit. */
  allow(key: number, now = Date.now()): boolean {
    this.sweep(now);
    const times = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (times.length >= this.limit) {
      this.hits.set(key, times);
      return false;
    }
    times.push(now);
    this.hits.set(key, times);
    return true;
  }

  /** Seconds until the oldest in-window hit expires, for the "slow down" reply. */
  retryAfterSeconds(key: number, now = Date.now()): number {
    const times = this.hits.get(key) ?? [];
    const oldest = times.filter((t) => now - t < this.windowMs)[0];
    if (oldest === undefined) return 0;
    return Math.max(1, Math.ceil((this.windowMs - (now - oldest)) / 1000));
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;
    for (const [k, times] of this.hits) {
      const live = times.filter((t) => now - t < this.windowMs);
      if (live.length === 0) this.hits.delete(k);
      else this.hits.set(k, live);
    }
  }
}
