import { describe, expect, it } from 'vitest';
import { platformFor, platformSignal } from './platform.ts';

describe('platformFor', () => {
  it('matches known social CDNs', () => {
    expect(platformFor('https://i.ytimg.com/vi/abc/hq.jpg')).toBe('YouTube');
    expect(platformFor('https://pbs.twimg.com/media/x.jpg')).toBe('X (Twitter)');
    expect(platformFor('https://i.redd.it/abc.jpg')).toBe('Reddit');
    expect(platformFor('https://scontent.cdninstagram.com/v/x.jpg')).toBe(
      'Meta (Facebook/Instagram)',
    );
  });
  it('returns null for unknown hosts and bad URLs', () => {
    expect(platformFor('https://example.com/a.jpg')).toBeNull();
    expect(platformFor('not a url')).toBeNull();
  });
});

describe('platformSignal', () => {
  it('supports only platform-hosted media', () => {
    expect(platformSignal.supports({ url: 'https://i.ytimg.com/a.jpg', kind: 'image' })).toBe(true);
    expect(platformSignal.supports({ url: 'https://news.site/a.jpg', kind: 'image' })).toBe(false);
  });
  it('returns a neutral, explanatory result', async () => {
    const r = await platformSignal.analyze({
      url: 'https://pbs.twimg.com/media/x.jpg',
      kind: 'image',
      blob: new Blob(['x']),
    });
    expect(r.outcome).toBe('neutral');
    expect(r.summary).toContain('X (Twitter)');
    expect(r.evidence.length).toBeGreaterThan(0);
  });
});
