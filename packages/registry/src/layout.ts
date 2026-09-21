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
  nav { display: flex; justify-content: space-between; align-items: center;
        gap: 12px; flex-wrap: wrap; padding: 18px 0; }
  .wordmark { font-size: 14px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
              color: var(--white); text-decoration: none; }
  .wordmark span { color: var(--sprout); }
  nav .links { display: flex; align-items: center; gap: 6px 22px; flex-wrap: wrap; }
  nav .links a { color: var(--fern); text-decoration: none; font-size: 14px; }
  nav .links a:hover { color: var(--sprout); }
  nav .links a.active { color: var(--sprout); border-bottom: 2px solid var(--sprout); padding-bottom: 2px; }
  nav .links a.cta { background: var(--sprout); color: var(--carbon); border-radius: 40px;
                     padding: 7px 18px; font-weight: 600; }
  nav .links a.cta:hover { background: var(--wash); }
  .wave { display: block; width: 100%; height: 64px; }
  @media (max-width: 600px) {
    .wrap { padding: 0 16px; }
    nav { padding: 14px 0; }
    nav .links { gap: 4px 16px; }
    nav .links a { font-size: 13px; }
    nav .links a.cta { padding: 6px 14px; }
    .wave { height: 40px; }
  }
  .backnav { display: inline-block; color: var(--fern); font-size: 13px; text-decoration: none;
             margin: -4px 0 10px; }
  .backnav:hover { color: var(--sprout); }
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
  description?: string | undefined;
  keywords?: string | undefined;
  canonicalUrl?: string | undefined;
  ogTitle?: string | undefined;
  ogDescription?: string | undefined;
  ogImage?: string | undefined;
  active?: 'home' | 'registry' | undefined;
  /** Back link rendered in the header band above the hero - for deep pages. */
  back?: { href: string; label: string } | undefined;
  /** Extra <style> content for page-specific rules. */
  css?: string | undefined;
  /** Content rendered inside the dark header band (above the wave). */
  hero?: string | undefined;
  /** Main content, rendered on the bone background. */
  body: string;
  /** Scripts appended before </body> (src or inline). */
  script?: string | undefined;
  /** Structured Data JSON-LD for AI answer engines (AEO/GEO) and rich snippets */
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>> | undefined;
}

const DEFAULT_KEYWORDS =
  'media authenticity, C2PA, content credentials, deepfake detection, digital provenance, image forensics, misinformation verification, perceptual hash, BK-tree, fake news checker, synthetic media';
const DEFAULT_OG_IMAGE = '/assets/og-image.jpg';

export function shell(o: ShellOpts): string {
  const ogImg = o.ogImage ?? DEFAULT_OG_IMAGE;
  const keywords = o.keywords ?? DEFAULT_KEYWORDS;
  const jsonLdScript = o.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(o.jsonLd)}</script>`
    : '';

  return `<!doctype html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(o.title)}</title>
${o.description ? `<meta name="description" content="${esc(o.description)}">` : ''}
<meta name="keywords" content="${esc(keywords)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<meta name="theme-color" content="#122314">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="format-detection" content="telephone=no">
${o.canonicalUrl ? `<link rel="canonical" href="${esc(o.canonicalUrl)}">` : ''}

<!-- Icons & PWA -->
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon.png">
<link rel="icon" type="image/png" sizes="16x16" href="/assets/icon16.png">
<link rel="apple-touch-icon" sizes="192x192" href="/assets/apple-touch-icon.png">

<!-- Open Graph / Facebook -->
<meta property="og:site_name" content="Verity">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(o.ogTitle ?? o.title)}">
<meta property="og:description" content="${esc(o.ogDescription ?? o.description ?? '')}">
<meta property="og:image" content="${esc(ogImg)}">
<meta property="og:image:alt" content="Verity - Multi-Signal Media Authenticity Engine">
${o.canonicalUrl ? `<meta property="og:url" content="${esc(o.canonicalUrl)}">` : ''}
<meta property="og:locale" content="en_US">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.ogTitle ?? o.title)}">
<meta name="twitter:description" content="${esc(o.ogDescription ?? o.description ?? '')}">
<meta name="twitter:image" content="${esc(ogImg)}">

<!-- Structured Data for Answer Engines (AEO) & Generative Search (GEO) -->
${jsonLdScript}

<style>${BASE_CSS}${o.css ?? ''}</style>
</head>
<body>
<div class="topband">
  <div class="wrap"><nav aria-label="Main Navigation">
    <a class="wordmark" href="/" aria-label="Verity Home">Verity<span>.</span></a>
    <div class="links">
      <a href="/" ${o.active === 'home' ? 'class="active" aria-current="page"' : ''}>Home</a>
      <a href="${esc(TELEGRAM_BOT)}" target="_blank" rel="noopener noreferrer">Telegram bot</a>
      <a class="cta" href="/dashboard" ${o.active === 'registry' ? 'aria-current="page"' : ''}>Registry</a>
    </div>
  </nav></div>
  ${o.back ? `<div class="wrap"><a class="backnav" href="${esc(o.back.href)}">&larr; ${esc(o.back.label)}</a></div>` : ''}
  ${o.hero ? `<div class="wrap">${o.hero}</div>` : ''}
  ${WAVE}
</div>
<main id="main-content">
${o.body}
</main>
<div class="wrap"><footer class="sitefoot" role="contentinfo">
  <div class="row">
    <span>Verity &bull; Open-source media verification engine. Zero media stored.</span>
    <span><a href="/dashboard">Registry</a> &middot; <a href="${esc(TELEGRAM_BOT)}" target="_blank" rel="noopener noreferrer">@CheckVerityBot</a> &middot; <a href="https://github.com/verity-project/verity" target="_blank" rel="noopener noreferrer">GitHub</a></span>
  </div>
  <p class="pledge">&ldquo;Unverified means we couldn't confirm provenance &mdash; not that the content is false.&rdquo;</p>
</footer></div>
${o.script ?? ''}
</body>
</html>`;
}
