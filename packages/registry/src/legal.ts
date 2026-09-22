import { shell } from './layout.ts';

const CSS = `
  .legal { max-width: 720px; margin: 0 auto; padding: 8px 0 24px; }
  .legal h2 { font-size: 20px; margin: 32px 0 8px; color: var(--forest); }
  .legal p, .legal li { font-size: 15px; color: var(--onyx); }
  .legal ul { padding-left: 20px; }
  .legal .updated { color: var(--lichen); font-size: 13px; }
  .legal a { color: var(--verdant); }
`;

const UPDATED = 'Last updated: March 2025';

export function termsPage(publicUrl: string): string {
  return shell({
    title: 'Terms of Service - Verity',
    description: 'Terms of service for the Verity media authenticity platform.',
    canonicalUrl: `${publicUrl}/terms`,
    css: CSS,
    hero: `<header class="hero"><h1 style="font-size:clamp(30px,5vw,44px);margin:0">Terms of Service</h1></header>`,
    body: `<div class="wrap"><div class="legal">
<p class="updated">${UPDATED}</p>
<p>These terms govern use of the Verity registry website, public APIs, browser
extension, and the Telegram/Discord bots (together, "the service"), operated as
an open-source project at
<a href="https://github.com/mintahandrews/verity">github.com/mintahandrews/verity</a>.
By using the service you accept these terms.</p>

<h2>What the service is</h2>
<p>Verity evaluates what evidence exists about a piece of media: cryptographic
provenance (C2PA), metadata forensics, prior sightings, fact-check databases,
and contextual cross-checks. It outputs one of three verdicts &mdash;
<b>verified</b>, <b>unverified</b>, or <b>suspicious</b> &mdash; each with
per-signal, plain-language evidence.</p>

<h2>Verdicts are evidence, not adjudication</h2>
<ul>
  <li>A verdict is a summary of detectable evidence, <b>not a determination of
      truth</b>. "Unverified" means nothing conclusive was found &mdash; it does
      not mean content is false or misleading.</li>
  <li>Verity never labels media "fake". Do not present Verity verdicts as proof
      that content is genuine or fabricated.</li>
  <li>Do not rely on verdicts as the sole basis for legal, medical, financial,
      safety-critical, or editorial publication decisions.</li>
</ul>

<h2>Acceptable use</h2>
<ul>
  <li>Do not abuse the public API: respect rate limits, no bulk scraping, no
      attempts to poison the registry with fabricated verdicts.</li>
  <li>Do not submit URLs or content that is unlawful, or use the service to
      harass or defame.</li>
  <li>Public verdict pages are public by design &mdash; do not submit media
      hashes or URLs you are not comfortable being publicly listed.</li>
</ul>

<h2>Open source &amp; self-hosting</h2>
<p>The codebase is Apache-2.0 licensed. These terms apply to the hosted instance
at ${publicUrl}; self-hosted deployments are governed by the license and the
operator's own policies.</p>

<h2>Disclaimer &amp; liability</h2>
<p>The service is provided <b>as is</b>, without warranty of any kind. To the
maximum extent permitted by law, the maintainers are not liable for decisions
made based on verdicts, for third-party API data (fact-checks, weather,
geocoding, reverse-image results), or for service availability.</p>

<h2>Changes</h2>
<p>Terms may be updated; continued use after changes constitutes acceptance.
Questions or abuse reports: open an issue on GitHub.</p>
</div></div>`,
  });
}

export function privacyPage(publicUrl: string): string {
  return shell({
    title: 'Privacy Policy - Verity',
    description: 'Privacy policy for the Verity media authenticity platform.',
    canonicalUrl: `${publicUrl}/privacy`,
    css: CSS,
    hero: `<header class="hero"><h1 style="font-size:clamp(30px,5vw,44px);margin:0">Privacy Policy</h1></header>`,
    body: `<div class="wrap"><div class="legal">
<p class="updated">${UPDATED}</p>
<p>Verity is privacy-first by architecture: analysis runs locally wherever
possible and the registry is designed to work on hashes, not media. This page
describes exactly what leaves your device and what we store.</p>

<h2>Browser extension</h2>
<ul>
  <li><b>Media never leaves your device.</b> Decoding, C2PA validation, metadata
      forensics, ELA, OCR, and the optional AI model all run locally.</li>
  <li>Registry lookups and verdict submission send <b>content hashes only</b>:
      SHA-256, perceptual hash, and (only if you enable it) a CLIP embedding
      vector. No pixels, no filenames.</li>
  <li>Surrounding caption text may be sent to the registry's fact-check relay
      (which forwards to Google Fact Check Tools) and, when present, to fact-check
      sources directly.</li>
  <li>No analytics, no tracking pixels, no cookies, no accounts.</li>
  <li>Settings (feature toggles, optional API keys you paste) live in
      <code>chrome.storage.local</code> and never sync anywhere.</li>
</ul>

<h2>Telegram &amp; Discord bots</h2>
<ul>
  <li>Media you send is processed <b>in memory</b> and discarded; only the
      resulting hashes and verdict record are persisted.</li>
  <li>Your chat ID is used only for rate limiting and is not published.</li>
</ul>

<h2>Registry (this site)</h2>
<ul>
  <li>Stored per checked item: SHA-256, perceptual hash(es), optional embedding,
      source URL when provided, the verdict record, and an OpenTimestamps token.
      <b>No media bytes are ever stored.</b></li>
  <li>Client IPs are kept in memory only, for rate limiting, and are not
      persisted or logged beyond standard hosting logs.</li>
</ul>

<h2>Third-party requests</h2>
<p>Depending on enabled features, lookups may go to: Google Fact Check Tools
(caption text), BigDataCloud reverse geocoding (coordinates), Open-Meteo
(coordinates + date), Internet Archive Wayback (URL/hash), Wikimedia Commons
(SHA-1), RDAP (hostname), and OpenTimestamps calendars (SHA-256). Optional,
operator-enabled integrations (SauceNAO, Sightengine) upload media to those
providers and are off by default.</p>

<h2>Contact &amp; changes</h2>
<p>This policy may be updated alongside the code; the repository history is the
record of change. Questions:
<a href="https://github.com/mintahandrews/verity/issues">GitHub issues</a>.</p>
</div></div>`,
  });
}
