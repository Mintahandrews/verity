import exifr from 'exifr';
import type { Evidence, Signal, SignalResult } from '../types.ts';

const GEOCODE = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const TIMEOUT_MS = 6000;

/**
 * Countries that matter in viral-misinfo geography, with the aliases people
 * actually type in captions. Not exhaustive - a miss means no check, never
 * a wrong accusation.
 */
const COUNTRIES: Array<{ canonical: string; names: string[] }> = [
  { canonical: 'United States', names: ['united states', 'usa', 'u.s.', 'america', 'american'] },
  { canonical: 'United Kingdom', names: ['united kingdom', 'uk', 'britain', 'england', 'british'] },
  { canonical: 'Ukraine', names: ['ukraine', 'ukrainian', 'kyiv', 'kiev'] },
  { canonical: 'Russia', names: ['russia', 'russian', 'moscow'] },
  { canonical: 'Israel', names: ['israel', 'israeli', 'tel aviv', 'jerusalem'] },
  { canonical: 'Palestinian Territory', names: ['palestine', 'palestinian', 'gaza', 'west bank'] },
  { canonical: 'Iran', names: ['iran', 'iranian', 'tehran'] },
  { canonical: 'Iraq', names: ['iraq', 'iraqi', 'baghdad', 'mosul'] },
  { canonical: 'Syria', names: ['syria', 'syrian', 'damascus', 'aleppo'] },
  { canonical: 'Afghanistan', names: ['afghanistan', 'afghan', 'kabul'] },
  { canonical: 'China', names: ['china', 'chinese', 'beijing', 'shanghai', 'wuhan'] },
  { canonical: 'Taiwan', names: ['taiwan', 'taiwanese', 'taipei'] },
  { canonical: 'India', names: ['india', 'indian', 'delhi', 'mumbai'] },
  { canonical: 'Pakistan', names: ['pakistan', 'pakistani', 'karachi', 'lahore'] },
  { canonical: 'Turkey', names: ['turkey', 'turkiye', 'turkish', 'istanbul', 'ankara'] },
  { canonical: 'France', names: ['france', 'french', 'paris'] },
  { canonical: 'Germany', names: ['germany', 'german', 'berlin', 'munich'] },
  { canonical: 'Italy', names: ['italy', 'italian', 'rome', 'milan'] },
  { canonical: 'Spain', names: ['spain', 'spanish', 'madrid', 'barcelona'] },
  { canonical: 'Egypt', names: ['egypt', 'egyptian', 'cairo'] },
  { canonical: 'Nigeria', names: ['nigeria', 'nigerian', 'lagos', 'abuja'] },
  { canonical: 'Kenya', names: ['kenya', 'kenyan', 'nairobi'] },
  { canonical: 'South Africa', names: ['south africa', 'south african', 'johannesburg', 'cape town'] },
  { canonical: 'Brazil', names: ['brazil', 'brazilian', 'sao paulo', 'rio'] },
  { canonical: 'Mexico', names: ['mexico', 'mexican', 'mexico city'] },
  { canonical: 'Japan', names: ['japan', 'japanese', 'tokyo', 'osaka'] },
  { canonical: 'South Korea', names: ['south korea', 'korean', 'seoul'] },
  { canonical: 'North Korea', names: ['north korea', 'pyongyang'] },
  { canonical: 'Australia', names: ['australia', 'australian', 'sydney', 'melbourne'] },
  { canonical: 'Canada', names: ['canada', 'canadian', 'toronto', 'vancouver'] },
  { canonical: 'Venezuela', names: ['venezuela', 'venezuelan', 'caracas'] },
  { canonical: 'Lebanon', names: ['lebanon', 'lebanese', 'beirut'] },
  { canonical: 'Yemen', names: ['yemen', 'yemeni', 'sanaa'] },
  { canonical: 'Sudan', names: ['sudan', 'sudanese', 'khartoum'] },
  { canonical: 'Libya', names: ['libya', 'libyan', 'tripoli'] },
  { canonical: 'Somalia', names: ['somalia', 'somali', 'mogadishu'] },
  { canonical: 'Ethiopia', names: ['ethiopia', 'ethiopian', 'addis ababa'] },
  { canonical: 'Myanmar', names: ['myanmar', 'burma', 'burmese', 'yangon'] },
  { canonical: 'Bangladesh', names: ['bangladesh', 'bangladeshi', 'dhaka'] },
  { canonical: 'Indonesia', names: ['indonesia', 'indonesian', 'jakarta'] },
  { canonical: 'Philippines', names: ['philippines', 'philippine', 'manila'] },
  { canonical: 'Vietnam', names: ['vietnam', 'vietnamese', 'hanoi', 'saigon'] },
  { canonical: 'Thailand', names: ['thailand', 'thai', 'bangkok'] },
  { canonical: 'Saudi Arabia', names: ['saudi arabia', 'saudi', 'riyadh'] },
  { canonical: 'United Arab Emirates', names: ['uae', 'emirates', 'dubai', 'abu dhabi'] },
  { canonical: 'Qatar', names: ['qatar', 'qatari', 'doha'] },
  { canonical: 'Jordan', names: ['jordan', 'jordanian', 'amman'] },
  { canonical: 'Poland', names: ['poland', 'polish', 'warsaw'] },
  { canonical: 'Netherlands', names: ['netherlands', 'dutch', 'amsterdam', 'holland'] },
  { canonical: 'Greece', names: ['greece', 'greek', 'athens'] },
  { canonical: 'Argentina', names: ['argentina', 'argentinian', 'buenos aires'] },
  { canonical: 'Chile', names: ['chile', 'chilean', 'santiago'] },
  { canonical: 'Colombia', names: ['colombia', 'colombian', 'bogota'] },
  { canonical: 'Cuba', names: ['cuba', 'cuban', 'havana'] },
  { canonical: 'Haiti', names: ['haiti', 'haitian'] },
  { canonical: 'Sri Lanka', names: ['sri lanka', 'colombo'] },
  { canonical: 'Nepal', names: ['nepal', 'nepali', 'kathmandu'] },
  { canonical: 'New Zealand', names: ['new zealand', 'auckland', 'wellington'] },
  { canonical: 'Ireland', names: ['ireland', 'irish', 'dublin'] },
  { canonical: 'Norway', names: ['norway', 'norwegian', 'oslo'] },
  { canonical: 'Sweden', names: ['sweden', 'swedish', 'stockholm'] },
  { canonical: 'Finland', names: ['finland', 'finnish', 'helsinki'] },
  { canonical: 'Belarus', names: ['belarus', 'belarusian', 'minsk'] },
  // 'georgia' omitted: US state vs country ambiguity would create false conflicts.
  { canonical: 'Georgia', names: ['georgian', 'tbilisi'] },
  { canonical: 'Armenia', names: ['armenia', 'armenian', 'yerevan'] },
  { canonical: 'Azerbaijan', names: ['azerbaijan', 'baku'] },
  { canonical: 'Morocco', names: ['morocco', 'moroccan', 'casablanca'] },
  { canonical: 'Algeria', names: ['algeria', 'algerian', 'algiers'] },
  { canonical: 'Tunisia', names: ['tunisia', 'tunisian', 'tunis'] },
  { canonical: 'Democratic Republic of the Congo', names: ['congo', 'drc', 'kinshasa'] },
  { canonical: 'Zimbabwe', names: ['zimbabwe', 'harare'] },
  { canonical: 'Ghana', names: ['ghana', 'ghanaian', 'accra'] },
];

/**
 * First country the context text claims, by alias match (word-boundary).
 * Exported for tests.
 */
export function claimedCountry(contextText: string): string | null {
  const text = ` ${contextText.toLowerCase()} `;
  for (const c of COUNTRIES) {
    for (const name of c.names) {
      if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
        return c.canonical;
      }
    }
  }
  return null;
}

/** Map a geocoder's countryName to our canonical set, or return it normalized. */
export function normalizeCountry(geocoded: string): string {
  const g = geocoded.toLowerCase();
  for (const c of COUNTRIES) {
    if (c.canonical.toLowerCase() === g) return c.canonical;
    if (c.names.some((n) => g === n || g.includes(c.canonical.toLowerCase()))) return c.canonical;
  }
  return geocoded;
}

interface GeoResult {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

/**
 * EXIF GPS vs claimed-location cross-check. "Caption says Paris, metadata
 * says Lagos" is the most direct false-context detector available.
 *
 * Privacy: the geocoding call sends coordinates to BigDataCloud's free
 * client API - opt-in via media.locationLookup (popup toggle / GEO_LOOKUP).
 * GPS presence itself is reported locally regardless.
 */
export const geolocationSignal: Signal = {
  id: 'geolocation',
  name: 'Location cross-check',
  supports: (m) => m.kind === 'image',
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };

    const data = (await exifr
      .parse(new Uint8Array(await media.blob.arrayBuffer()), { gps: true })
      .catch(() => undefined)) as Record<string, unknown> | undefined;

    const lat = data?.latitude;
    const lon = data?.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'No GPS location embedded.',
        evidence: [],
      };
    }

    if (!media.locationLookup) {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'GPS location embedded (enable location lookup to compare it with claims).',
        evidence: [{ label: 'Location lookup is off - coordinates stay on your device' }],
      };
    }

    try {
      const q = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        localityLanguage: 'en',
      });
      const res = await fetch(`${GEOCODE}?${q}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`geocode ${res.status}`);
      const geo = (await res.json()) as GeoResult;

      const place = [geo.city ?? geo.locality, geo.countryName].filter(Boolean).join(', ');
      const evidence: Evidence[] = [
        { label: 'Embedded GPS', detail: `${lat.toFixed(4)}, ${lon.toFixed(4)}` },
        { label: 'Resolves to', detail: place || 'unknown' },
      ];

      if (!geo.countryName) {
        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary: 'GPS embedded but could not be resolved to a place.',
          evidence,
        };
      }

      const actual = normalizeCountry(geo.countryName);
      const claimed = media.contextText ? claimedCountry(media.contextText) : null;

      if (claimed && claimed !== actual) {
        return {
          ...base,
          outcome: 'negative',
          confidence: 0.45,
          summary: `Context says ${claimed} but embedded GPS points to ${place}.`,
          evidence: [
            ...evidence,
            { label: 'Location metadata is editable - treat as a flag, not proof' },
          ],
        };
      }

      return {
        ...base,
        outcome: 'positive',
        confidence: 0.3,
        summary: claimed
          ? `GPS location (${place}) matches the claimed location.`
          : `GPS location resolves to ${place}.`,
        evidence,
      };
    } catch {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'GPS embedded; location lookup unavailable.',
        evidence: [{ label: 'Embedded GPS', detail: `${lat.toFixed(4)}, ${lon.toFixed(4)}` }],
      };
    }
  },
};
