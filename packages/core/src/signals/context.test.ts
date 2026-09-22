import { describe, expect, it } from 'vitest';
import { daylightClaim, classifySun, estimatedUtc } from './daylight.ts';
import { weatherClaim, wmoLabel } from './weather.ts';
import { firstUpload } from './commons.ts';
import { registrationDate } from './rdap.ts';
import { elaStats } from './ela.ts';
import { bestSauceSimilarity } from './external-apis.ts';
import { tweetIdsFrom } from './claimtext.ts';
import { sha1Hex } from '../hash.ts';

describe('daylight helpers', () => {
  it('detects daylight claims', () => {
    expect(daylightClaim('photo taken this afternoon in Berlin')).toBe(true);
    expect(daylightClaim('shot at midday')).toBe(true);
    expect(daylightClaim('a cat')).toBe(false);
  });

  it('classifies sun altitude into day/twilight/night', () => {
    expect(classifySun(0.5)).toBe('day');
    expect(classifySun(-0.05)).toBe('twilight'); // just below horizon - inconclusive
    expect(classifySun(-0.5)).toBe('night');
  });

  it('estimates UTC from longitude', () => {
    const local = new Date('2024-06-01T14:00:00Z');
    // lon +30 -> UTC+2 -> local 14:00 == 12:00Z
    expect(estimatedUtc(30, local).toISOString()).toBe('2024-06-01T12:00:00.000Z');
  });
});

describe('weather helpers', () => {
  it('extracts weather claims', () => {
    expect(weatherClaim('sunny protest in Paris')?.kind).toBe('sunny');
    expect(weatherClaim('heavy rain flooded the street')?.kind).toBe('rain');
    expect(weatherClaim('snowing in Oslo')?.kind).toBe('snow');
    expect(weatherClaim('just a photo')).toBeNull();
  });

  it('maps WMO codes to labels', () => {
    expect(wmoLabel(0)).toBe('clear');
    expect(wmoLabel(3)).toBe('cloudy');
    expect(wmoLabel(45)).toBe('fog');
    expect(wmoLabel(61)).toBe('rain/storm');
    expect(wmoLabel(71)).toBe('snow');
  });
});

describe('commons helpers', () => {
  it('reads first upload from the API response', () => {
    const hit = firstUpload({
      query: { allimages: [{ name: 'File:Cat.jpg', timestamp: '2020-01-02T03:04:05Z' }] },
    });
    expect(hit?.name).toBe('File:Cat.jpg');
    expect(hit?.ts.toISOString()).toBe('2020-01-02T03:04:05.000Z');
    expect(firstUpload({ query: { allimages: [] } })).toBeNull();
  });
});

describe('rdap helpers', () => {
  it('parses registration date from events', () => {
    const d = registrationDate([
      { eventAction: 'last changed', eventDate: '2021-05-05T00:00:00Z' },
      { eventAction: 'registration', eventDate: '2020-01-01T00:00:00Z' },
    ]);
    expect(d?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
    expect(registrationDate([])).toBeNull();
    expect(registrationDate(undefined)).toBeNull();
  });
});

describe('elaStats', () => {
  // 64x64 gray image, one 8x8 block heavily corrupted in the "re-encode".
  const w = 64;
  const h = 64;
  const mk = (): Uint8ClampedArray => {
    const a = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < a.length; i += 4) {
      a[i] = 128; a[i + 1] = 128; a[i + 2] = 128; a[i + 3] = 255;
    }
    return a;
  };

  it('flags a localized hot block', () => {
    const orig = mk();
    const recon = mk();
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const i = (y * w + x) * 4;
        recon[i] = 20; recon[i + 1] = 240; recon[i + 2] = 20;
      }
    }
    const s = elaStats(orig, recon, w, h)!;
    expect(s.max).toBeGreaterThan(100);
    expect(s.hotFraction).toBeGreaterThan(0);
    expect(s.hotFraction).toBeLessThan(0.2);
    expect(s.max).toBeGreaterThan(4 * s.mean);
  });

  it('uniform error has no hotspot fraction', () => {
    const orig = mk();
    const recon = mk();
    for (let i = 0; i < recon.length; i += 4) {
      recon[i] = 130; recon[i + 1] = 130; recon[i + 2] = 130;
    }
    const s = elaStats(orig, recon, w, h)!;
    expect(s.hotFraction).toBe(0);
  });

  it('returns null for tiny images', () => {
    expect(elaStats(new Uint8ClampedArray(16 * 16 * 4), new Uint8ClampedArray(16 * 16 * 4), 16, 16)).toBeNull();
  });
});

describe('bestSauceSimilarity', () => {
  it('returns the max similarity', () => {
    expect(
      bestSauceSimilarity([
        { header: { similarity: '62.5' } },
        { header: { similarity: '91.2' } },
      ]),
    ).toBe(91.2);
    expect(bestSauceSimilarity([])).toBe(0);
    expect(bestSauceSimilarity(undefined)).toBe(0);
  });
});

describe('tweetIdsFrom', () => {
  it('extracts status ids from twitter/x urls', () => {
    expect(
      tweetIdsFrom(
        'see https://twitter.com/someone/status/1840000000000000001?s=20',
        'also https://x.com/other/status/1840000000000000002',
      ),
    ).toEqual(['1840000000000000001', '1840000000000000002']);
    expect(tweetIdsFrom('no links')).toEqual([]);
    expect(tweetIdsFrom('https://x.com/a/status/1234')).toEqual([]); // too short
  });
});

describe('sha1Hex', () => {
  it('computes the SHA-1 hex digest', async () => {
    expect(await sha1Hex(new TextEncoder().encode('abc').buffer as ArrayBuffer)).toBe(
      'a9993e364706816aba3e25717850c26c9cd0d89d',
    );
  });
});
