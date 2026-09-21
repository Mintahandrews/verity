import { describe, expect, it } from 'vitest';
import { RateLimiter } from './ratelimit.ts';

describe('RateLimiter', () => {
  it('allows up to the limit then blocks', () => {
    const rl = new RateLimiter(3, 60_000);
    expect(rl.allow(1, 0)).toBe(true);
    expect(rl.allow(1, 1)).toBe(true);
    expect(rl.allow(1, 2)).toBe(true);
    expect(rl.allow(1, 3)).toBe(false);
  });

  it('tracks keys independently', () => {
    const rl = new RateLimiter(1, 60_000);
    expect(rl.allow(1, 0)).toBe(true);
    expect(rl.allow(2, 0)).toBe(true);
    expect(rl.allow(1, 1)).toBe(false);
  });

  it('opens back up after the window slides', () => {
    const rl = new RateLimiter(2, 60_000);
    rl.allow(1, 0);
    rl.allow(1, 1_000);
    expect(rl.allow(1, 2_000)).toBe(false);
    expect(rl.allow(1, 61_000)).toBe(true); // first hit expired
  });

  it('reports seconds until retry', () => {
    const rl = new RateLimiter(1, 60_000);
    rl.allow(1, 0);
    rl.allow(1, 10_000);
    expect(rl.retryAfterSeconds(1, 10_000)).toBe(50);
    expect(rl.retryAfterSeconds(9, 10_000)).toBe(0);
  });
});
