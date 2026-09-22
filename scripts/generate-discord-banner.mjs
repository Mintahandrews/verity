import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ASSETS_DIR = join(ROOT, 'docs/assets');
mkdirSync(ASSETS_DIR, { recursive: true });

const HTML_APP_BANNER = join(ROOT, 'scripts/discord-banner-app.html');
const HTML_PROFILE_BANNER = join(ROOT, 'scripts/discord-banner-profile.html');

const OUT_APP_BANNER = join(ASSETS_DIR, 'discord-bot-banner.png');
const OUT_PROFILE_BANNER = join(ASSETS_DIR, 'discord-bot-profile-banner.png');

// --- 1. 16:9 App Directory / Showcase Banner (1280x720) ---
const APP_BANNER_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Instrument+Serif:ital@1&family=JetBrains+Mono:wght@400;500;600&display=swap');

  :root {
    --forest: #0d1a10;
    --forest-surface: #132417;
    --sprout: #68ef3f;
    --blurple: #5865F2;
    --wash: #e7f9dd;
    --fern: #b7bda5;
    --lichen: #7e8371;
    --white: #ffffff;
    --carbon: #080f0a;
    --discord-dark: #1e1f22;
    --discord-embed: #2b2d31;
    --discord-subtext: #949ba4;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    width: 1280px;
    height: 720px;
    background-color: var(--forest);
    background-image: 
      radial-gradient(circle at 80% 20%, rgba(88, 101, 242, 0.15), transparent 45%),
      radial-gradient(circle at 20% 80%, rgba(104, 239, 63, 0.14), transparent 50%),
      radial-gradient(ellipse 900px 400px at 50% 0%, rgba(104, 239, 63, 0.15), transparent 70%),
      linear-gradient(to right, rgba(104, 239, 63, 0.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(104, 239, 63, 0.04) 1px, transparent 1px);
    background-size: 100% 100%, 100% 100%, 100% 100%, 32px 32px, 32px 32px;
    color: var(--white);
    font-family: 'Inter', system-ui, sans-serif;
    padding: 48px 56px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    position: relative;
  }

  /* Top Bar */
  .top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 2;
  }

  .brand-group {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .avatar-wrap {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: linear-gradient(135deg, #18331d, #0d1d11);
    border: 1.5px solid var(--sprout);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 20px rgba(104, 239, 63, 0.3);
  }

  .avatar-wrap svg {
    width: 26px;
    height: 26px;
    stroke: var(--sprout);
    stroke-width: 2.5;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .title-area {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .title-text {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--white);
  }
  .title-text span { color: var(--sprout); }

  .bot-tag {
    background: var(--blurple);
    color: var(--white);
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    letter-spacing: 0.04em;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .tagline-badge {
    background: rgba(104, 239, 63, 0.08);
    border: 1px solid rgba(104, 239, 63, 0.28);
    padding: 6px 16px;
    border-radius: 30px;
    font-size: 13px;
    font-weight: 600;
    color: var(--sprout);
    letter-spacing: 0.02em;
  }

  /* Main Grid: Left Hero Pitch + Right Discord Mock Card */
  .content-grid {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 40px;
    align-items: center;
    margin: 16px 0;
    position: relative;
    z-index: 2;
  }

  .left-col h1 {
    font-size: 46px;
    font-weight: 800;
    line-height: 1.12;
    letter-spacing: -0.035em;
    margin-bottom: 14px;
  }

  .left-col h1 em {
    font-family: 'Instrument Serif', Georgia, serif;
    font-style: italic;
    color: var(--sprout);
    font-weight: 400;
  }

  .left-col p {
    font-size: 17px;
    line-height: 1.5;
    color: var(--fern);
    margin-bottom: 24px;
  }

  .verdict-pills {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
  }

  .v-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 30px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .v-pill.verified {
    background: rgba(104, 239, 63, 0.15);
    border: 1px solid var(--sprout);
    color: var(--sprout);
  }

  .v-pill.suspicious {
    background: rgba(255, 107, 107, 0.12);
    border: 1px solid #ff6b6b;
    color: #ff6b6b;
  }

  .v-pill.unverified {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: var(--fern);
  }

  .command-bar {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    background: rgba(18, 35, 20, 0.9);
    border: 1px solid rgba(104, 239, 63, 0.25);
    padding: 10px 18px;
    border-radius: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
  }

  .command-bar .cmd {
    color: var(--sprout);
    font-weight: 600;
  }
  .command-bar .desc {
    color: var(--lichen);
    font-size: 12px;
  }

  /* Right Column: Live Discord Chat Embed Replica */
  .discord-mock {
    background: var(--discord-dark);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(104, 239, 63, 0.08);
  }

  .discord-msg-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .msg-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #112214;
    border: 1px solid var(--sprout);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .msg-avatar svg {
    width: 20px;
    height: 20px;
    stroke: var(--sprout);
    stroke-width: 2.5;
    fill: none;
  }

  .msg-name {
    font-weight: 700;
    font-size: 15px;
    color: var(--white);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .msg-time {
    font-size: 11px;
    color: var(--discord-subtext);
    font-weight: 400;
  }

  .discord-embed-card {
    background: var(--discord-embed);
    border-left: 4px solid var(--sprout);
    border-radius: 4px 8px 8px 4px;
    padding: 16px;
  }

  .embed-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--sprout);
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .embed-desc {
    font-size: 13px;
    color: #dbdee1;
    line-height: 1.45;
    margin-bottom: 12px;
  }

  .embed-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    font-size: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 10px;
  }

  .field-name {
    color: var(--discord-subtext);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.05em;
    margin-bottom: 2px;
  }

  .field-val {
    color: #f2f3f5;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
  }

  .embed-footer {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 11px;
    color: var(--discord-subtext);
    display: flex;
    justify-content: space-between;
  }

  /* Bottom Feature Row */
  .footer-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(104, 239, 63, 0.15);
    padding-top: 18px;
    position: relative;
    z-index: 2;
  }

  .features {
    display: flex;
    gap: 24px;
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--fern);
    font-weight: 500;
  }

  .feature-item svg {
    width: 16px;
    height: 16px;
    stroke: var(--sprout);
    stroke-width: 2.2;
    fill: none;
  }

  .repo-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: var(--lichen);
  }
  .repo-tag span { color: var(--sprout); }
</style>
</head>
<body>
  <!-- Top Bar -->
  <header class="top-bar">
    <div class="brand-group">
      <div class="avatar-wrap">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <div class="title-area">
        <div class="title-text">VERITY<span>.</span></div>
        <div class="bot-tag">BOT</div>
      </div>
    </div>
    <div class="tagline-badge">Discord Media Authenticity & Provenance Verifier</div>
  </header>

  <!-- Content Grid -->
  <div class="content-grid">
    <div class="left-col">
      <h1>Check before you share. <em>Instant media truth.</em></h1>
      <p>
        Attach any photo or video in Discord. Verity immediately parses C2PA Content Credentials, hardware forensics, and prior sightings &mdash; with zero media stored.
      </p>
      
      <div class="verdict-pills">
        <span class="v-pill verified">&check; Verified</span>
        <span class="v-pill suspicious">&excl; Suspicious</span>
        <span class="v-pill unverified">&quest; Unverified</span>
      </div>

      <div class="command-bar">
        <span class="cmd">!verity [attachment]</span>
        <span class="desc">&bull; or DM to analyze privately</span>
      </div>
    </div>

    <!-- Discord Live Embed Card -->
    <div class="discord-mock">
      <div class="discord-msg-header">
        <div class="msg-avatar">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div class="msg-name">
          Verity
          <span class="bot-tag">BOT</span>
          <span class="msg-time">Today at 3:14 PM</span>
        </div>
      </div>

      <div class="discord-embed-card">
        <div class="embed-title">
          <span>&check;</span>
          <span>Verified &mdash; Cryptographic Provenance Confirmed</span>
        </div>
        <div class="embed-desc">
          Valid C2PA Content Credentials manifest cryptographically confirmed by trusted certificate authority.
        </div>
        <div class="embed-fields">
          <div>
            <div class="field-name">C2PA Signer</div>
            <div class="field-val">Reuters News Wire</div>
          </div>
          <div>
            <div class="field-name">Capture Hardware</div>
            <div class="field-val">Nikon Z9 v4.01</div>
          </div>
          <div>
            <div class="field-name">Content SHA-256</div>
            <div class="field-val">e3b0c442...98fc</div>
          </div>
          <div>
            <div class="field-name">Perceptual Hash</div>
            <div class="field-val">8f0a3c2b1e4d5f6a</div>
          </div>
        </div>
        <div class="embed-footer">
          <span>Verity Authenticity Engine</span>
          <span>Zero Media Stored &bull; Open Source</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Bottom Bar -->
  <footer class="footer-row">
    <div class="features">
      <div class="feature-item">
        <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
        C2PA Manifest Verification
      </div>
      <div class="feature-item">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        Prior Sightings & Recycled Context
      </div>
      <div class="feature-item">
        <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        Client-Side Privacy / Hashes Only
      </div>
    </div>
    <div class="repo-tag">
      github.com/<span>mintahandrews</span>/verity
    </div>
  </footer>
</body>
</html>
`;

// --- 2. 5:2 Discord Bot Profile Banner (1360x544 @2x for 680x240) ---
const PROFILE_BANNER_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Instrument+Serif:ital@1&family=JetBrains+Mono:wght@400;500;600&display=swap');

  :root {
    --forest: #0d1a10;
    --sprout: #68ef3f;
    --blurple: #5865F2;
    --white: #ffffff;
    --fern: #b7bda5;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    width: 1360px;
    height: 544px;
    background-color: var(--forest);
    background-image: 
      radial-gradient(circle at 85% 30%, rgba(88, 101, 242, 0.2), transparent 45%),
      radial-gradient(circle at 15% 70%, rgba(104, 239, 63, 0.18), transparent 50%),
      radial-gradient(ellipse 800px 300px at 50% 0%, rgba(104, 239, 63, 0.18), transparent 70%),
      linear-gradient(to right, rgba(104, 239, 63, 0.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(104, 239, 63, 0.04) 1px, transparent 1px);
    background-size: 100% 100%, 100% 100%, 100% 100%, 28px 28px, 28px 28px;
    color: var(--white);
    font-family: 'Inter', system-ui, sans-serif;
    padding: 44px 56px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    overflow: hidden;
    position: relative;
  }

  .left-side {
    max-width: 680px;
    position: relative;
    z-index: 2;
  }

  .header-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(104, 239, 63, 0.1);
    border: 1px solid rgba(104, 239, 63, 0.3);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 700;
    color: var(--sprout);
    margin-bottom: 18px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  h1 {
    font-size: 50px;
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.035em;
    margin-bottom: 16px;
  }
  h1 em {
    font-family: 'Instrument Serif', Georgia, serif;
    font-style: italic;
    font-weight: 400;
    color: var(--sprout);
  }

  p {
    font-size: 18px;
    line-height: 1.45;
    color: var(--fern);
    margin-bottom: 24px;
  }

  .badges-row {
    display: flex;
    gap: 10px;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .badge.verified {
    background: var(--sprout);
    color: #0d1a10;
  }
  .badge.suspicious {
    background: #ff5252;
    color: #ffffff;
  }
  .badge.unverified {
    background: #364438;
    color: #cdd5c2;
  }

  /* Right Side Visual Graphic */
  .right-side {
    position: relative;
    z-index: 2;
  }

  .card-stack {
    width: 480px;
    background: rgba(22, 39, 26, 0.9);
    border: 1px solid rgba(104, 239, 63, 0.35);
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 25px rgba(104, 239, 63, 0.15);
  }

  .bot-identity {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .bot-icon {
    width: 44px;
    height: 44px;
    background: #112214;
    border: 1.5px solid var(--sprout);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .bot-icon svg {
    width: 24px;
    height: 24px;
    stroke: var(--sprout);
    stroke-width: 2.5;
    fill: none;
  }

  .bot-name-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bot-name {
    font-size: 20px;
    font-weight: 800;
  }
  .bot-pill {
    background: var(--blurple);
    color: #ffffff;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .card-cmd {
    background: #0d1810;
    border: 1px solid rgba(104, 239, 63, 0.2);
    border-radius: 10px;
    padding: 12px 16px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: var(--sprout);
    margin-bottom: 14px;
    display: flex;
    justify-content: space-between;
  }

  .card-cmd span:last-child {
    color: var(--fern);
    font-size: 11px;
  }

  .status-line {
    font-size: 14px;
    color: #e2e8db;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .status-line strong {
    color: var(--sprout);
  }
</style>
</head>
<body>
  <div class="left-side">
    <div class="header-tag">&bull; Official Discord Verifier &bull;</div>
    <h1>Don't guess. <em>Verify with Verity.</em></h1>
    <p>Multi-signal media authenticity, C2PA Content Credentials, and context forensics right inside your Discord channels and DMs.</p>
    <div class="badges-row">
      <span class="badge verified">&check; Verified</span>
      <span class="badge suspicious">&excl; Suspicious</span>
      <span class="badge unverified">&quest; Unverified</span>
    </div>
  </div>

  <div class="right-side">
    <div class="card-stack">
      <div class="bot-identity">
        <div class="bot-icon">
          <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div class="bot-name-wrap">
          <span class="bot-name">Verity</span>
          <span class="bot-pill">BOT</span>
        </div>
      </div>
      <div class="card-cmd">
        <span>!verity [photo/video]</span>
        <span>Zero Media Stored</span>
      </div>
      <div class="status-line">
        <span>&bull;</span>
        <span>Cryptographic C2PA &bull; EXIF &bull; Recycled Media Check</span>
      </div>
    </div>
  </div>
</body>
</html>
`;

writeFileSync(HTML_APP_BANNER, APP_BANNER_CONTENT, 'utf8');
writeFileSync(HTML_PROFILE_BANNER, PROFILE_BANNER_CONTENT, 'utf8');

async function renderScreenshot(htmlFile, outFile, width, height) {
  console.log(`Rendering banner ${htmlFile} (${width}x${height}) -> ${outFile}...`);
  return new Promise((resolve, reject) => {
    const proc = spawn(
      CHROME_PATH,
      [
        '--headless=new',
        '--hide-scrollbars',
        `--window-size=${width},${height}`,
        `--screenshot=${outFile}`,
        `file://${htmlFile}`
      ],
      { stdio: 'inherit' }
    );
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Chrome failed with code ${code}`));
    });
  });
}

try {
  await renderScreenshot(HTML_APP_BANNER, OUT_APP_BANNER, 1280, 720);
  await renderScreenshot(HTML_PROFILE_BANNER, OUT_PROFILE_BANNER, 1360, 544);
  console.log('✅ Both Discord bot banners rendered successfully!');
} catch (err) {
  console.error('Error rendering banners:', err);
  process.exit(1);
}
