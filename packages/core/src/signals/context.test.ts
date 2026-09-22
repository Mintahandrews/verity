import { describe, expect, it } from 'vitest';
import { daylightClaim, classifySun, estimatedUtc } from './daylight.ts';
import { weatherClaim, wmoLabel } from './weather.ts';
import { firstUpload } from './commons.ts';
import { registrationDate } from './rdap.ts';
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

describe('sha1Hex', () => {
  it('computes the SHA-1 hex digest', async () => {
    expect(await sha1Hex(new TextEncoder().encode('abc').buffer as ArrayBuffer)).toBe(
      'a9993e364706816aba3e25717850c26c9cd0d89d',
    );
  });
});
