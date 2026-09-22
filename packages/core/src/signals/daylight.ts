import exifr from 'exifr';
import { getPosition } from 'suncalc';
import type { Evidence, Signal, SignalResult } from '../types.ts';

/** Sun altitude (radians) below this = civil twilight/dark at that spot. */
const NIGHT_ALTITUDE = -0.1047; // -6 degrees

const DAY_CLAIMS = [
  'daylight',
  'daytime',
  'in broad daylight',
  'this morning',
  'this afternoon',
  'at noon',
  'midday',
  'mid-day',
  'sunrise',
  'sunset',
  'golden hour',
  'sunny',
];

/** True when the context text claims daytime/bright conditions. Exported for tests. */
export function daylightClaim(contextText: string): boolean {
  const text = contextText.toLowerCase();
  return DAY_CLAIMS.some((p) => text.includes(p));
}

/**
 * 'day' | 'twilight' | 'night' from sun altitude in radians. Exported for tests.
 * The +-6deg twilight band is reported as its own class so borderline cases
 * never produce a confident contradiction.
 */
export function classifySun(altitudeRad: number): 'day' | 'twilight' | 'night' {
  if (altitudeRad > 0) return 'day';
  if (altitudeRad < NIGHT_ALTITUDE) return 'night';
  return 'twilight';
}

/**
 * EXIF timestamps carry no timezone - cameras store local time. Estimate the
 * local UTC offset from longitude (15deg per hour) so SunCalc gets a plausible
 * instant. Accuracy +-1h: fine for day-vs-night, and twilight results are
 * deliberately inconclusive. Exported for tests.
 */
export function estimatedUtc(lon: number, local: Date): Date {
  const offsetH = Math.max(-12, Math.min(14, Math.round(lon / 15)));
  return new Date(local.getTime() - offsetH * 3_600_000);
}

/**
 * Daylight plausibility: GPS + capture time → sun position. "Caption claims
 * this afternoon but the sun was below the horizon there" is a hard-to-argue
 * contradiction. Runs entirely on-device - no coordinates leave the machine.
 */
export const daylightSignal: Signal = {
  id: 'daylight',
  name: 'Daylight plausibility',
  supports: (m) => m.kind === 'image',
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };

    const data = (await exifr
      .parse(new Uint8Array(await media.blob.arrayBuffer()), {
        gps: true,
        pick: ['latitude', 'longitude', 'DateTimeOriginal', 'CreateDate'],
      })
      .catch(() => undefined)) as Record<string, unknown> | undefined;

    const lat = data?.latitude;
    const lon = data?.longitude;
    const taken = data?.DateTimeOriginal ?? data?.CreateDate;
    if (
      typeof lat !== 'number' ||
      typeof lon !== 'number' ||
      !(taken instanceof Date) ||
      Number.isNaN(taken.getTime())
    ) {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'Needs embedded GPS + capture time - not present.',
        evidence: [],
      };
    }

    const instant = estimatedUtc(lon, taken);
    const { altitude } = getPosition(instant, lat, lon);
    const phase = classifySun(altitude);
    const evidence: Evidence[] = [
      { label: 'Capture time', detail: taken.toISOString() },
      { label: 'Sun position at that spot/time', detail: phase === 'day' ? 'above horizon' : phase === 'twilight' ? 'near sunrise/sunset' : 'below horizon (night)' },
    ];
    const claimsDay = media.contextText ? daylightClaim(media.contextText) : false;

    if (phase === 'night' && claimsDay) {
      return {
        ...base,
        outcome: 'negative',
        confidence: 0.4,
        summary:
          'Context claims daylight, but the sun was below the horizon at the embedded location/time.',
        evidence: [
          ...evidence,
          { label: 'Location/time metadata is editable - treat as a flag, not proof' },
        ],
      };
    }

    if (phase === 'day' && claimsDay) {
      return {
        ...base,
        outcome: 'positive',
        confidence: 0.25,
        summary: 'Sun position matches the claimed daylight conditions.',
        evidence,
      };
    }

    return {
      ...base,
      outcome: 'neutral',
      confidence: 0,
      summary:
        phase === 'night'
          ? 'Sun was below the horizon at the embedded location/time (no daylight claim to contradict).'
          : 'Daylight check ran; nothing in the context contradicts it.',
      evidence,
    };
  },
};
