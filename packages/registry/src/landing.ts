function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TELEGRAM_BOT = 'https://t.me/CheckVerityBot';

/** Public landing page - what Verity is, how to use it, live registry stats. */
export function landingPage(stats: Record<string, number>, publicUrl: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verity - what can we verify</title>
<meta name="description" content="Verity checks media authenticity with cryptographic provenance, metadata forensics, reverse-image evidence and fact-checks - and tells you exactly what it found. It never calls anything &quot;fake&quot;.">
<meta property="og:title" content="Verity - check before you share">
<meta property="og:description" content="Forward a photo or video, get a transparent verdict with evidence. Verified, unverified, or suspicious - never &quot;fake&quot;.">
<meta property="og:type" content="website">
<style>
  :root {
    --forest: #122314; --moss: #273f2b; --lichen: #7e8371; --fern: #b7bda5;
    --sprout: #68ef3f; --verdant: #26a200; --wash: #e7f9dd; --mist: #d9deca;
    --carbon: #222222; --onyx: #30322a; --stone: #d6d6d6;
    --bone: #f2f5eb; --white: #ffffff;
    --ui: 'Aeonik', 'Inter', ui-sans-serif, system-ui, sans-serif;
    --accent: 'Instrument Serif', ui-serif, Georgia, serif;
  }
  * { box-sizing: border-box; }
  body { font-family: var(--ui); margin: 0; background: var(--forest); color: var(--white);
         font-size: 17px; line-height: 1.55; letter-spacing: -0.02em; }
  .wrap { max-width: 880px; margin: 0 auto; padding: 0 20px; }
  nav { display: flex; justify-content: space-between; align-items: center; padding: 24px 0; }
  .wordmark { font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .wordmark span { color: var(--sprout); }
  nav a { color: var(--fern); text-decoration: none; font-size: 14px; margin-left: 20px; }
  nav a:hover { color: var(--sprout); }
  header { padding: 72px 0 48px; }
  h1 { font-size: clamp(38px, 7vw, 64px); font-weight: 700; line-height: 1.05;
       letter-spacing: -0.03em; margin: 0 0 20px; }
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
  section { padding: 56px 0; }
  h2 { font-size: 30px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 8px; }
  .kicker { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
            color: var(--lichen); margin: 0 0 10px; }
  .verdicts { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; margin-top: 24px; }
  .card { background: var(--bone); color: var(--onyx); border-radius: 20px; padding: 22px; }
  .card .mark { width: 30px; height: 30px; border-radius: 40px; display: inline-flex;
                align-items: center; justify-content: center; font-weight: 700; margin-bottom: 12px; }
  .card h3 { margin: 0 0 6px; font-size: 17px; }
  .card p { margin: 0; font-size: 14px; color: #5a5f52; }
  .v-verified .mark { background: var(--sprout); color: var(--carbon); }
  .v-unverified .mark { background: var(--stone); color: var(--onyx); }
  .v-suspicious .mark { background: var(--onyx); color: var(--white); }
  .signals { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
             gap: 2px; margin-top: 24px; border-radius: 20px; overflow: hidden; }
  .sig { background: var(--moss); padding: 18px 20px; font-size: 14px; }
  .sig b { display: block; color: var(--white); font-weight: 600; margin-bottom: 4px; }
  .sig span { color: var(--fern); }
  .howto { background: var(--bone); color: var(--onyx); border-radius: 24px; padding: 32px; margin-top: 24px; }
  .howto h3 { margin: 0 0 4px; font-size: 17px; }
  .howto p { margin: 0 0 20px; font-size: 14px; color: #5a5f52; }
  .howto p:last-child { margin-bottom: 0; }
  .howto code { background: var(--mist); border-radius: 6px; padding: 1px 6px; font-size: 13px; }
  .pledge { font-family: var(--accent); font-size: 21px; font-style: italic; color: var(--fern);
            max-width: 640px; line-height: 1.5; }
  footer { border-top: 1px solid var(--onyx); padding: 28px 0 48px; font-size: 13px;
           color: var(--lichen); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  footer a { color: var(--fern); text-decoration: none; }
  footer a:hover { color: var(--sprout); }
</style>
</head>
<body>
<div class="wrap">
  <nav>
    <div class="wordmark">Verity<span>.</span></div>
    <div>
      <a href="/dashboard">Registry</a>
      <a href="#install">Install</a>
    </div>
  </nav>
</div>

<header class="wrap">
  <h1>Is it real? <em>Better question:</em><br>what can we verify?</h1>
  <p class="lede">Most misinformation isn't a deepfake - it's a <b>real photo with a false caption</b>.
     Verity checks what evidence actually exists about a piece of media, and shows you its work.
     Three verdicts, never the word "fake".</p>
  <div class="cta">
    <a class="btn primary" href="${esc(TELEGRAM_BOT)}">Check media on Telegram</a>
    <a class="btn ghost" href="#install">Get the browser extension</a>
  </div>
  <div class="stats">
    <span class="stat"><b>${stats['total'] ?? 0}</b> media checked</span>
    <span class="stat"><b>${stats['verified'] ?? 0}</b> verified</span>
    <span class="stat"><b>${stats['suspicious'] ?? 0}</b> suspicious</span>
  </div>
</header>

<div class="wrap"><section>
  <p class="kicker">The verdicts</p>
  <h2>Honest answers, not hot takes</h2>
  <div class="verdicts">
    <div class="card v-verified"><span class="mark">✓</span>
      <h3>Verified</h3>
      <p>A valid cryptographic signature (C2PA) proves who produced this file. Nothing else earns a check.</p></div>
    <div class="card v-unverified"><span class="mark">?</span>
      <h3>Unverified</h3>
      <p>No provenance found. That's the normal state of most media - it means we don't know, not that it's false.</p></div>
    <div class="card v-suspicious"><span class="mark">!</span>
      <h3>Suspicious</h3>
      <p>Evidence contradicts the media: a failed signature, prior sightings under different claims, fact-checked falsehoods.</p></div>
  </div>
</section></div>

<div class="wrap"><section>
  <p class="kicker">The evidence</p>
  <h2>Every verdict shows its work</h2>
  <div class="signals">
    <div class="sig"><b>Cryptographic provenance</b><span>C2PA Content Credentials - the only signal that can verify.</span></div>
    <div class="sig"><b>Prior sightings</b><span>Content hashes match against the public registry - real media reused with a new story gets caught.</span></div>
    <div class="sig"><b>Metadata forensics</b><span>Camera data, editing software traces, AI generator signatures.</span></div>
    <div class="sig"><b>Fact-checks</b><span>Captions and text-in-image checked against professional fact-check databases.</span></div>
    <div class="sig"><b>Near-duplicate matching</b><span>Perceptual hashing finds reposts, re-compressions, and trimmed clips.</span></div>
    <div class="sig"><b>Optional AI classifier</b><span>An experimental model can flag synthetic images - it can never verify anything.</span></div>
  </div>
</section></div>

<div class="wrap"><section id="install">
  <p class="kicker">Use it</p>
  <h2>Check media where it spreads</h2>
  <div class="howto">
    <h3>Telegram</h3>
    <p>Forward any photo or video to <a href="${esc(TELEGRAM_BOT)}">@CheckVerityBot</a> - get a verdict and a shareable link in seconds. Free, no install.</p>
    <h3>Browser extension</h3>
    <p>Right-click any image → "Verify with Verity". Build from source: <code>npm install &&amp; npm run build</code>, then load <code>packages/extension/dist</code> at <code>chrome://extensions</code>. Chrome Web Store listing coming soon.</p>
    <h3>Prove your own work is real</h3>
    <p>The signer CLI embeds a C2PA credential into your originals: <code>npm run sign -- photo.jpg signed.jpg --cert cert.pem --key key.pem</code></p>
    <h3>API</h3>
    <p><code>GET ${esc(publicUrl)}/api/verdicts/&lt;sha256&gt;</code> · <code>/api/similar?phash=&hellip;</code> · <code>/api/stats</code> - self-hostable, hashes only, no media ever stored.</p>
  </div>
</section></div>

<div class="wrap"><section>
  <p class="pledge">&ldquo;Absence of evidence is not evidence of absence. Unverified means
     we couldn't confirm provenance - not that the content is false.&rdquo;</p>
</section></div>

<div class="wrap"><footer>
  <span>Verity - open-source media verification. Only hashes leave your device.</span>
  <span><a href="/dashboard">Registry dashboard</a> · <a href="${esc(TELEGRAM_BOT)}">@CheckVerityBot</a></span>
</footer></div>
</body>
</html>`;
}
