import type { Evidence, Signal, SignalResult } from '../types.ts';
import { hasBreakingMarkers } from './claimtext.ts';

const RDAP = 'https://rdap.org/domain';
const TIMEOUT_MS = 6000;
const VERY_NEW_DAYS = 30;
const NEW_DAYS = 180;

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

/** Registration date from RDAP events, or null. Exported for tests. */
export function registrationDate(events: RdapEvent[] | undefined): Date | null {
  const e = events?.find((x) => x.eventAction === 'registration');
  const d = e?.eventDate ? new Date(e.eventDate) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

/**
 * Source-domain age check. Misinfo is frequently spread by throwaway domains -
 * a "news" site registered last week deserves scrutiny. Queries rdap.org's
 * aggregator (free, no key) for the page host - only the hostname is sent.
 * Fires only when a source page URL is known; age alone is weak, so it turns
 * negative only alongside breaking-claim context.
 */
export const rdapSignal: Signal = {
  id: 'rdap',
  name: 'Source domain age',
  supports: (m) => !!m.pageUrl && /^https?:\/\//.test(m.pageUrl),
  async analyze(media): Promise<SignalResult> {
    const base = { signalId: this.id, signalName: this.name };

    let host: string;
    try {
      host = new URL(media.pageUrl!).hostname.replace(/^www\./, '');
    } catch {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'Could not parse the source page URL.',
        evidence: [],
      };
    }
    if (!host.includes('.') || /\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i.test(host)) {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'No registrable source domain.',
        evidence: [],
      };
    }

    try {
      const res = await fetch(`${RDAP}/${host}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'application/rdap+json, application/json' },
      });
      if (!res.ok) throw new Error(`rdap ${res.status}`);
      const j = (await res.json()) as { events?: RdapEvent[] };
      const reg = registrationDate(j.events);
      if (!reg) {
        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary: `No registration record found for ${host}.`,
          evidence: [],
        };
      }

      const days = (Date.now() - reg.getTime()) / 86_400_000;
      const evidence: Evidence[] = [
        { label: 'Source domain', detail: host },
        { label: 'Registered', detail: reg.toISOString().slice(0, 10) },
      ];

      if (days < VERY_NEW_DAYS && hasBreakingMarkers(media.contextText)) {
        return {
          ...base,
          outcome: 'negative',
          confidence: 0.35,
          summary: `${host} was registered ${Math.floor(days)} days ago and is pushing breaking-claim media.`,
          evidence: [...evidence, { label: 'New domains are common - a flag, not proof' }],
        };
      }
      if (days < NEW_DAYS) {
        return {
          ...base,
          outcome: 'neutral',
          confidence: 0,
          summary: `${host} is a young domain (registered ${Math.floor(days)} days ago).`,
          evidence,
        };
      }
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: `${host} has been registered since ${reg.toISOString().slice(0, 10)}.`,
        evidence,
      };
    } catch {
      return {
        ...base,
        outcome: 'neutral',
        confidence: 0,
        summary: 'Domain registration lookup unavailable.',
        evidence: [],
      };
    }
  },
};
