/**
 * Minimal OpenTimestamps client: submit a 32-byte digest to public calendar
 * servers; the returned .ots token proves the digest existed at stamp time
 * and later upgrades to a Bitcoin-anchored proof. Hash-only - nothing about
 * the media or verdict content leaves this service, so privacy posture is
 * unchanged. Calendars are free public infrastructure, no key required.
 */
const CALENDARS = [
  'https://alice.btc.calendar.opentimestamps.org',
  'https://bob.btc.calendar.opentimestamps.org',
  'https://finney.calendar.eternitywall.com',
];

const TIMEOUT_MS = 3000;

/** Stamp a sha256 hex digest. Returns the first calendar's .ots token as hex, or null. */
export async function stampDigest(sha256Hex: string): Promise<string | null> {
  const digest = new Uint8Array(Buffer.from(sha256Hex, 'hex'));
  for (const cal of CALENDARS) {
    try {
      const res = await fetch(`${cal}/digest`, {
        method: 'POST',
        body: digest,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const token = await res.arrayBuffer();
      if (token.byteLength > 0) return Buffer.from(token).toString('hex');
    } catch {
      // calendar down or slow - try the next one
    }
  }
  return null;
}
