function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TELEGRAM_BOT = 'https://t.me/CheckVerityBot';

/** Shared palette + chrome for every server-rendered page. */
export const BASE_CSS = `
  :root {
    --forest: #122314; --moss: #273f2b; --lichen: #7e8371; --fern: #b7bda5;
    --sprout: #68ef3f; --verdant: #26a200; --wash: #e7f9dd; --mist: #d9deca;
    --carbon: #222222; --onyx: #30322a; --stone: #d6d6d6; --soft: #dcdfe3;
    --bone: #f2f5eb; --white: #ffffff;
    --ui: 'Aeonik', 'Inter', ui-sans-serif, system-ui, sans-serif;
    --accent: 'Instrument Serif', ui-serif, Georgia, serif;
  }
  * { box-sizing: border-box; }
  body { font-family: var(--ui); margin: 0; background: var(--bone); color: var(--onyx);
         font-size: 16px; line-height: 1.55; letter-spacing: -0.02em; }
  .wrap { max-width: 880px; margin: 0 auto; padding: 0 20px; }
  .topband { background: var(--forest); color: var(--white); }
  nav { display: flex; justify-content: space-between; align-items: center; padding: 22px 0; }
  .wordmark { font-size: 14px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
              color: var(--white); text-decoration: none; }
  .wordmark span { color: var(--sprout); }
  nav .links a { color: var(--fern); text-decoration: none; font-size: 14px; margin-left: 22px; }
  nav .links a:hover { color: var(--sprout); }
  nav .links a.active { color: var(--sprout); border-bottom: 2px solid var(--sprout); padding-bottom: 2px; }
  nav .links a.cta { background: var(--sprout); color: var(--carbon); border-radius: 40px;
                     padding: 7px 18px; font-weight: 600; }
  nav .links a.cta:hover { background: var(--wash); }
  .wave { display: block; width: 100%; height: 64px; }
  .sitefoot { border-top: 1px solid var(--mist); margin-top: 56px; padding: 28px 0 44px;
              font-size: 13px; color: var(--lichen); }
  .sitefoot .row { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
  .sitefoot a { color: var(--moss); text-decoration: none; }
  .sitefoot a:hover { color: var(--verdant); }
  .sitefoot .pledge { font-family: var(--accent); font-style: italic; font-size: 14px;
                      margin-top: 14px; }
`;

/** Organic wave divider: forest header bleeding into the bone content area. */
const WAVE = `<svg class="wave" viewBox="0 0 1440 64" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0,28 C240,60 480,4 720,22 C960,40 1200,8 1440,34 L1440,64 L0,64 Z" fill="#f2f5eb"/>
</svg>`;

export interface ShellOpts {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  active?: 'home' | 'registry';
  /** Extra <style> content for page-specific rules. */
  css?: string;
  /** Content rendered inside the dark header band (above the wave). */
  hero?: string;
  /** Main content, rendered on the bone background. */
  body: string;
}

export function shell(o: ShellOpts): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
${o.description ? `<meta name="description" content="${esc(o.description)}">` : ''}
${o.ogTitle ? `<meta property="og:title" content="${esc(o.ogTitle)}">` : ''}
${o.ogDescription ? `<meta property="og:description" content="${esc(o.ogDescription)}">` : ''}
<meta property="og:type" content="website">
<style>${BASE_CSS}${o.css ?? ''}</style>
</head>
<body>
<div class="topband">
  <div class="wrap"><nav>
    <a class="wordmark" href="/">Verity<span>.</span></a>
    <div class="links">
      <a href="/" ${o.active === 'home' ? 'class="active"' : ''}>Home</a>
      <a href="/dashboard" ${o.active === 'registry' ? 'class="active"' : ''}>Registry</a>
      <a class="cta" href="${esc(TELEGRAM_BOT)}">Check on Telegram</a>
    </div>
  </nav></div>
  ${o.hero ? `<div class="wrap">${o.hero}</div>` : ''}
  ${WAVE}
</div>
<main>
${o.body}
</main>
<div class="wrap"><footer class="sitefoot">
  <div class="row">
    <span>Verity - open-source media verification. Only hashes leave your device.</span>
    <span><a href="/dashboard">Registry</a> · <a href="${esc(TELEGRAM_BOT)}">@CheckVerityBot</a></span>
  </div>
  <p class="pledge">&ldquo;Unverified means we couldn't confirm provenance - not that the content is false.&rdquo;</p>
</footer></div>
</body>
</html>`;
}
