import { shell } from './layout.ts';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TELEGRAM_BOT = 'https://t.me/CheckVerityBot';
const DISCORD_INVITE =
  'https://discord.com/oauth2/authorize?client_id=1551787274570698762&permissions=84992&integration_type=0&scope=bot';

const CSS = `
  header.hero { padding: 40px 0 56px; }
  h1 { font-size: clamp(38px, 7vw, 64px); font-weight: 700; line-height: 1.05;
       letter-spacing: -0.03em; margin: 0 0 20px; }
  h1 .nl { white-space: nowrap; }
  h1 em { font-family: var(--accent); font-weight: 400; font-style: italic; color: var(--sprout); }
  .lede { font-size: 19px; color: var(--fern); max-width: 620px; margin: 0 0 32px; }
  .lede b { color: var(--white); font-weight: 600; }
  .cta { display: flex; gap: 12px; flex-wrap: wrap; }
  .btn { display: inline-block; border-radius: 40px; padding: 12px 26px; font-weight: 600;
         font-size: 15px; text-decoration: none; }
  .btn.primary { background: var(--sprout); color: var(--carbon); }
  .btn.primary:hover { background: var(--wash); }
  .btn.ghost { border: 1px solid var(--onyx); color: var(--fern); }
  .btn.ghost:hover { border-color: var(--sprout); color: var(--sprout); }
  .stats { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 28px; }
  .stat { background: var(--moss); border: 1px solid var(--onyx); border-radius: 40px;
          padding: 5px 16px; font-size: 13px; color: var(--fern); }
  .stat b { color: var(--sprout); font-weight: 600; }
  section.wrap { padding-top: 64px; padding-bottom: 64px; }
  section + section { border-top: 1px solid var(--mist); }
  h2 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 10px; color: var(--onyx); }
  .kicker { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
            color: var(--verdant); margin: 0 0 12px; }
  .verdicts { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 16px; margin-top: 32px; }
  .card { background: var(--white); border: 1px solid var(--mist); border-radius: 20px; padding: 22px; }
  .card .mark { width: 30px; height: 30px; border-radius: 40px; display: inline-flex;
                align-items: center; justify-content: center; font-weight: 700; margin-bottom: 12px; }
  .card h3 { margin: 0 0 6px; font-size: 17px; }
  .card p { margin: 0; font-size: 14px; color: #5a5f52; }
  .v-verified .mark { background: var(--sprout); color: var(--carbon); }
  .v-unverified .mark { background: var(--stone); color: var(--onyx); }
  .v-suspicious .mark { background: var(--onyx); color: var(--white); }
  .signals { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
             gap: 2px; margin-top: 32px; border-radius: 20px; overflow: hidden; }
  .sig { background: var(--forest); padding: 18px 20px; font-size: 14px; }
  .sig b { display: block; color: var(--white); font-weight: 600; margin-bottom: 4px; }
  .sig span { color: var(--fern); }
  .howto { background: var(--white); border: 1px solid var(--mist); border-radius: 24px;
           padding: 32px; margin-top: 32px; }
  .howto h3 { margin: 0 0 4px; font-size: 17px; }
  .howto p { margin: 0 0 20px; font-size: 14px; color: #5a5f52; }
  .howto p:last-child { margin-bottom: 0; }
  .howto a { color: var(--verdant); }
  .howto code { background: var(--wash); border-radius: 6px; padding: 1px 6px; font-size: 13px; }
  .faq-list { margin-top: 32px; display: flex; flex-direction: column; gap: 16px; }
  .faq-item { background: var(--white); border: 1px solid var(--mist); border-radius: 20px; padding: 24px 28px; }
  .faq-item h3 { margin: 0 0 8px; font-size: 18px; color: var(--onyx); font-weight: 600; }
  .faq-item p { margin: 0; font-size: 15px; color: #525749; line-height: 1.6; }
  .faq-item p + p { margin-top: 10px; }
  .faq-item strong { color: var(--onyx); }
  @media (max-width: 600px) {
    header.hero { padding: 24px 0 40px; }
    h1 .nl { white-space: normal; }
    .lede { font-size: 16px; }
    .cta .btn { flex: 1 1 auto; text-align: center; padding: 12px 18px; }
    section.wrap { padding-top: 40px; padding-bottom: 40px; }
    .verdicts, .signals, .faq-list, .howto { margin-top: 24px; }
    h2 { font-size: 24px; }
    .card, .howto, .faq-item { padding: 20px; border-radius: 18px; }
    .signals { border-radius: 16px; }
  }
`;

/** Public landing page - what Verity is, how to use it, live registry stats. */
export function landingPage(stats: Record<string, number>, publicUrl: string): string {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Verity',
      applicationCategory: 'SecurityApplication',
      operatingSystem: 'Any, Chrome, Firefox',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      description:
        'Multi-signal media authenticity engine verifying C2PA cryptographic provenance, metadata forensics, perceptual near-duplicates, and fact-checking.',
      license: 'https://www.apache.org/licenses/LICENSE-2.0',
      url: publicUrl,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is Verity and how does it verify media authenticity?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Verity is an open-source media authenticity engine. Instead of relying on unreliable probabilistic AI detectors that ask "is this fake?", Verity evaluates multi-signal deterministic evidence: C2PA Content Credentials cryptographic signatures, metadata forensics, perceptual hash (pHash) near-duplicate matching, and fact-check databases.',
          },
        },
        {
          '@type': 'Question',
          name: 'Why does Verity never label content as "fake"?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Most viral misinformation is real footage shared with a false caption or fabricated context ("cheapfakes"). Calling something "fake" obscures whether the pixels are manipulated or simply misattributed. Verity provides three transparent verdicts: Verified (cryptographically signed provenance), Unverified (no provenance found, the baseline for most media), or Suspicious (evidence contradicts claims).',
          },
        },
        {
          '@type': 'Question',
          name: 'What are C2PA Content Credentials?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'C2PA (Coalition for Content Provenance and Authenticity) is an open industry standard that embeds tamper-evident cryptographic manifests into photos and videos at capture or edit time. Verity validates these x509 certificate chains locally on your device.',
          },
        },
        {
          '@type': 'Question',
          name: 'Does Verity store or upload user photos and videos?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'No. Verity operates on a strict zero-media storage privacy architecture. All media decoding, C2PA signature validation, metadata forensics, and OCR run locally in your browser. Only 64-character SHA-256 cryptographic hashes and perceptual hashes are transmitted to the registry for deduplication.',
          },
        },
      ],
    },
  ];

  return shell({
    title: 'Verity - Multi-Signal Media Authenticity & Provenance Engine',
    description:
      'Open-source media authenticity engine. Verifies C2PA cryptographic provenance, metadata forensics, perceptual hash BK-trees, and newsroom fact-checking. Zero media stored.',
    canonicalUrl: publicUrl,
    ogTitle: 'Verity - Multi-Signal Media Authenticity Engine',
    ogDescription:
      'Don\'t ask "is it fake?" Ask "what can we verify?" Transparent C2PA provenance, forensic evidence, and perceptual hash matching.',
    ogImage: `${publicUrl}/assets/og-image.jpg`,
    active: 'home',
    jsonLd,
    css: CSS,
    hero: `
  <header class="hero">
    <h1><span class="nl">Is it real? <em>Better question:</em></span><br>what can we verify?</h1>
    <p class="lede">Most viral misinformation isn't a deepfake &mdash; it's a <b>real photo with a false caption</b>.
       Verity checks what evidence actually exists about a piece of media, and shows you its work.
       Three transparent verdicts, never the word &ldquo;fake&rdquo;.</p>
    <div class="cta">
      <a class="btn primary" href="${esc(TELEGRAM_BOT)}" target="_blank" rel="noopener noreferrer">Check media on Telegram</a>
      <a class="btn ghost" href="#install">Get the browser extension</a>
      <a class="btn ghost" href="https://github.com/Mintahandrews/verity" target="_blank" rel="noopener noreferrer">GitHub (Open Source)</a>
    </div>
    <div class="stats">
      <span class="stat"><b>${stats['total'] ?? 0}</b> media checked</span>
      <span class="stat"><b>${stats['verified'] ?? 0}</b> verified</span>
      <span class="stat"><b>${stats['suspicious'] ?? 0}</b> suspicious</span>
    </div>
  </header>`,
    body: `
<section class="wrap" aria-labelledby="verdicts-heading">
  <p class="kicker">The verdicts</p>
  <h2 id="verdicts-heading">Honest answers, not hot takes</h2>
  <div class="verdicts">
    <div class="card v-verified"><span class="mark" aria-hidden="true">&check;</span>
      <h3>Verified</h3>
      <p>A valid cryptographic signature (C2PA Content Credentials) proves who produced this file. Nothing else earns a check.</p></div>
    <div class="card v-unverified"><span class="mark" aria-hidden="true">?</span>
      <h3>Unverified</h3>
      <p>No provenance found. That's the normal baseline of most web media &mdash; it means we don't know, not that it's false.</p></div>
    <div class="card v-suspicious"><span class="mark" aria-hidden="true">!</span>
      <h3>Suspicious</h3>
      <p>Evidence contradicts the media: a tampered signature, prior sightings under contradictory claims, or debunked fact-checks.</p></div>
  </div>
</section>

<section class="wrap" aria-labelledby="evidence-heading">
  <p class="kicker">The evidence</p>
  <h2 id="evidence-heading">Every verdict shows its work</h2>
  <div class="signals">
    <div class="sig"><b>Cryptographic Provenance</b><span>C2PA Content Credentials &mdash; the only standard that can definitively verify origin.</span></div>
    <div class="sig"><b>Prior Sightings &amp; History</b><span>SHA-256 hashes and archive snapshots detect recycled footage repurposed with false narratives.</span></div>
    <div class="sig"><b>Metadata &amp; Forensics</b><span>Camera EXIF, editing history traces, AI generator signatures, and GPS vs claimed geolocation.</span></div>
    <div class="sig"><b>Fact-Checks &amp; News Coverage</b><span>Optical character recognition (OCR) cross-checked against ClaimReview databases and GDELT.</span></div>
    <div class="sig"><b>Perceptual Hash Index (BK-Tree)</b><span>64-bit pHash matching catches crop, re-encodes, resizes, and compression variations.</span></div>
    <div class="sig"><b>Optional Neural Classifier</b><span>Sandboxed ONNX model can flag synthetic AI artifacts &mdash; it can never verify provenance.</span></div>
  </div>
</section>

<section class="wrap" id="faq" aria-labelledby="faq-heading">
  <p class="kicker">Direct Answers &bull; AEO &amp; GEO</p>
  <h2 id="faq-heading">Frequently Asked Questions</h2>
  <div class="faq-list">
    <article class="faq-item">
      <h3>What is Verity and how does it differ from AI detectors?</h3>
      <p>Traditional AI detectors guess based on pixel statistics and suffer from extreme false-positive rates on real camera photos. Verity is a <strong>multi-signal provenance engine</strong>. It evaluates tamper-evident cryptographic credentials (C2PA), reverse-lookups historical sightings in a BK-tree index, inspects forensic metadata, and searches journalist fact-checks.</p>
    </article>
    <article class="faq-item">
      <h3>Why does Verity never label an image or video as "fake"?</h3>
      <p>The vast majority of viral online misinformation is not generative AI deepfakes &mdash; it is authentic, unaltered media presented with fabricated context, deceptive dates, or misleading captions (known as <em>cheapfakes</em>). Calling media "fake" is scientifically inaccurate and breeds cynicism. Verity reports transparent evidence: <strong>Verified</strong>, <strong>Unverified</strong>, or <strong>Suspicious</strong>.</p>
    </article>
    <article class="faq-item">
      <h3>What is C2PA and how does Verity verify Content Credentials?</h3>
      <p>C2PA (Coalition for Content Provenance and Authenticity) is the global open standard supported by Adobe, Microsoft, Google, BBC, and Nikon. It cryptographically binds author, camera, and editing details to the file with an x509 certificate chain. Verity decodes and verifies these claims entirely in your browser using WASM.</p>
    </article>
    <article class="faq-item">
      <h3>How does Verity protect user privacy?</h3>
      <p><strong>Zero media bytes are ever uploaded or retained.</strong> The browser extension and chat bots run media decoding and forensic parsing locally. Only mathematical SHA-256 digests and perceptual hashes are queried against the registry.</p>
    </article>
  </div>
</section>

<section class="wrap" id="install" aria-labelledby="install-heading">
  <p class="kicker">Integration &amp; Deployment</p>
  <h2 id="install-heading">Check media where it spreads</h2>
  <div class="howto">
    <h3>Telegram Bot</h3>
    <p>Forward any photo or video to <a href="${esc(TELEGRAM_BOT)}" target="_blank" rel="noopener noreferrer">@CheckVerityBot</a> &mdash; receive an evidence-backed verdict and a shareable verification link in seconds. Free, zero installation.</p>
    <h3>Discord Bot</h3>
    <p>Add <a href="${esc(DISCORD_INVITE)}" target="_blank" rel="noopener noreferrer">Verity to your Discord server</a> &mdash; it replies to image and video attachments (or <code>!verity</code>) with the same evidence-backed verdicts.</p>
    <h3>Chrome &amp; Firefox Extension (Manifest V3)</h3>
    <p>Right-click any web image &rarr; <em>"Verify with Verity"</em>. Build from source: <code>npm install &amp;&amp; npm run build</code>, then load <code>packages/extension/dist</code> at <code>chrome://extensions</code>. Chrome Web Store listing release in progress.</p>
    <h3>Prove Your Own Media (Signer CLI)</h3>
    <p>Content creators, photographers, and news organizations can stamp tamper-evident C2PA credentials directly into originals: <code>npm run sign -- photo.jpg signed.jpg --cert cert.pem --key key.pem</code></p>
    <h3>Self-Hostable Registry API</h3>
    <p><code>GET ${esc(publicUrl)}/api/verdicts/&lt;sha256&gt;</code> &middot; <code>GET /api/similar?phash=&hellip;</code> &middot; <code>GET /api/stats</code> &mdash; zero dependencies, lightning fast, privacy-preserving.</p>
  </div>
</section>`,
  });
}
