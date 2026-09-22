import exifr from 'exifr';
import type { Evidence, Signal, SignalResult } from '../types.ts';

const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const TIMEOUT_MS = 8000;

/** Broad weather conditions a caption can claim, mapped to WMO code ranges. */
const CLAIMS: Array<{ kind: string; words: RegExp; codes: Set<number> }> = [
  { kind: 'sunny', words: /\b(sunny|sunshine|clear sky|bright day)\b/i, codes: new Set([0, 1, 2]) },
  {
    kind: 'rain',
    words: /\b(rain|raining|rainy|storm|stormy|downpour|thunderstorm)\b/i,
    codes: new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]),
  },
  { kind: 'snow', words: /\b(snow|snowing|snowy|blizzard|snowfall)\b/i, codes: new Set([71, 73, 75, 77, 85, 86]) },
  { kind: 'fog', words: /\b(fog|foggy|mist|misty|haze)\b/i, codes: new Set([45, 48]) },
  { kind: 'overcast', words: /\b(overcast|cloudy|grey sky|gray sky)\b/i, codes: new Set([2, 3]) },
];

/** First weather condition the context claims, or null. Exported for tests. */
export function weatherClaim(contextText: string): { kind: string; codes: Set<number> } | null {
  for (const c of CLAIMS) if (c.words.test(contextText)) return c;
  return null;
}

/** WMO weather code → coarse group label, for evidence text. Exported for tests. */
export function wmoLabel(code: number): string {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82) || code >= 95)
    return 'rain/storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return `code ${code}`;
}

interface ArchiveResponse {
  utc_offset_seconds?: number;
  hourly?: { time?: string[]; weather_code?: number[] };
}

/**
 * Historical-weather contradiction check. EXIF GPS + capture date → the actual
 * recorded weather at that spot (Open-Meteo archive, free, no key). "Caption
 * says sunny, recorded weather was rain" is direct false-context evidence.
 *
 * Privacy: sends only coordinates + a date - gated on media.locationLookup,
 * same as the geocoding call. No GPS or no weather claim = no check, never
 * a wrong accusation.
 */
export const weatherSignal: Signal = {
  id: 'weather',
  name: 'Weather cross-check',
  supports: (m) => m.kind === 'image',
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };

    const claim = media.contextText ? weatherClaim(media.contextText) : null;
    if (!claim) {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'No weather claim in the context to check.',
        evidence: [],
      };
    }

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
        summary: `Context claims "${claim.kind}" weather but no embedded location/time to check against.`,
        evidence: [],
      };
    }

    if (!media.locationLookup) {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: `Context claims "${claim.kind}" weather (enable location lookup to verify against records).`,
        evidence: [{ label: 'Location lookup is off - coordinates stay on your device' }],
      };
    }

    try {
      const day = taken.toISOString().slice(0, 10);
      const q = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        start_date: day,
        end_date: day,
        hourly: 'weather_code',
        timezone: 'auto',
      });
      const res = await fetch(`${ARCHIVE}?${q}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`open-meteo ${res.status}`);
      const wx = (await res.json()) as ArchiveResponse;

      const times = wx.hourly?.time ?? [];
      const codes = wx.hourly?.weather_code ?? [];
      // EXIF time is local; timezone=auto makes Open-Meteo return local times,
      // so match the hour prefix directly.
      const hourKey = `${day}T${String(taken.getHours()).padStart(2, '0')}`;
      let idx = times.findIndex((t) => t.startsWith(hourKey));
      if (idx < 0) idx = Math.min(Math.max(taken.getHours(), 0), codes.length - 1);
      const code = codes[idx];
      if (code === undefined) {
        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary: 'No recorded weather data for that date/place (archive gap or too recent).',
          evidence: [],
        };
      }

      const evidence: Evidence[] = [
        { label: 'Recorded weather at that spot/hour', detail: wmoLabel(code) },
        { label: 'Claimed in context', detail: claim.kind },
      ];

      if (!claim.codes.has(code)) {
        return {
          ...base,
          outcome: 'negative',
          confidence: 0.4,
          summary: `Context claims ${claim.kind} weather, but records show ${wmoLabel(code)} at that place/time.`,
          evidence: [
            ...evidence,
            { label: 'Location/time metadata is editable - treat as a flag, not proof' },
          ],
        };
      }

      return {
        ...base,
        outcome: 'positive',
        confidence: 0.25,
        summary: `Recorded weather (${wmoLabel(code)}) is consistent with the ${claim.kind} claim.`,
        evidence,
      };
    } catch {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'Weather archive check unavailable.',
        evidence: [],
      };
    }
  },
};
