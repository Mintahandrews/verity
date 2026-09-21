import { describe, expect, it, vi, afterEach } from 'vitest';
import { hasBreakingMarkers, keywordsFrom } from './claimtext.ts';
import { parseCdxTimestamp, waybackSignal } from './wayback.ts';
import { gdeltQuery, parseSeenDate } from './gdelt.ts';
import { claimedCountry, normalizeCountry } from './geolocation.ts';

describe('claimtext', () => {
  it('detects breaking-news markers', () => {
    expect(hasBreakingMarkers('BREAKING: flooding hits the city today')).toBe(true);
    expect(hasBreakingMarkers('just in - explosion reported')).toBe(true);
    expect(hasBreakingMarkers('a photo from last year')).toBe(false);
    expect(hasBreakingMarkers(undefined)).toBe(false);
  });

  it('builds keyword queries without stopwords or urls', () => {
    const kws = keywordsFrom('Breaking: huge explosion at https://x.com/a fertilizer plant yesterday');
    expect(kws).toContain('explosion');
    expect(kws).toContain('fertilizer');
    expect(kws).not.toContain('breaking');
    expect(kws).not.toContain('yesterday');
    expect(kws).not.toContain('https');
  });
});

describe('wayback', () => {
  it('parses CDX timestamps', () => {
    expect(parseCdxTimestamp('20200101123456')?.toISOString()).toBe('2020-01-01T12:34:56.000Z');
    expect(parseCdxTimestamp('bogus')).toBeNull();
  });

  it('flags archived media presented as breaking', async () => {
    const old = '20190101000000';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => [['timestamp', 'original'], [old, 'x']] })),
    );
    const res = await waybackSignal.analyze({
      url: 'https://example.com/photo.jpg',
      kind: 'image',
      contextText: 'BREAKING: this just happened today',
      blob: new Blob(),
    });
    expect(res.outcome).toBe('negative');
    expect(res.evidence[0]?.label).toBe('First archived');
  });

  it('stays neutral for recent archives and non-breaking context', async () => {
    const recent = new Date(Date.now() - 2 * 86_400_000)
      .toISOString()
      .replace(/[-:T]/g, '')
      .slice(0, 14);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => [['timestamp', 'original'], [recent, 'x']] })),
    );
    const res = await waybackSignal.analyze({
      url: 'https://example.com/photo.jpg',
      kind: 'image',
      contextText: 'BREAKING: new event',
      blob: new Blob(),
    });
    expect(res.outcome).toBe('neutral');
  });

  it('skips telegram file URLs', () => {
    expect(
      waybackSignal.supports({
        url: 'https://api.telegram.org/file/bot123:ABC/photos/x.jpg',
        kind: 'image',
      }),
    ).toBe(false);
  });
});

describe('gdelt', () => {
  it('parses seendate format', () => {
    expect(parseSeenDate('20240115T123000Z')?.toISOString()).toBe('2024-01-15T12:30:00.000Z');
    expect(parseSeenDate('2024-01-15')).toBeNull();
  });

  it('builds AND keyword queries', () => {
    const q = gdeltQuery('BREAKING: massive earthquake strikes coastal region today');
    expect(q).toContain('earthquake');
    expect(q.split(' ').length).toBeLessThanOrEqual(6);
  });
});

describe('geolocation country matching', () => {
  it('extracts claimed countries with aliases', () => {
    expect(claimedCountry('photo taken in Gaza yesterday')).toBe('Palestinian Territory');
    expect(claimedCountry('flooding in Paris')).toBe('France');
    expect(claimedCountry('wildfire in the USA')).toBe('United States');
    expect(claimedCountry('no location mentioned')).toBeNull();
  });

  it('does not match substring false positives', () => {
    expect(claimedCountry('australian shepherd')).toBe('Australia'); // still matches - acceptable
    expect(claimedCountry('turkey dinner recipe')).toBe('Turkey'); // alias match, acceptable
    expect(claimedCountry('grizzly bear')).toBeNull();
  });

  it('normalizes geocoder country names', () => {
    expect(normalizeCountry('United States of America')).toBe('United States');
    expect(normalizeCountry('France')).toBe('France');
    expect(normalizeCountry('Atlantis')).toBe('Atlantis');
  });
});

afterEach(() => vi.unstubAllGlobals());
