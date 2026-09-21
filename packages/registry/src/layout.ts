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

  /* Neo-Botanical Custom Cursors */
  :root {
    --cur-default: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M3 2L19 12L11 14L8 21L3 2Z' fill='%23122314' stroke='%2368ef3f' stroke-width='1.75' stroke-linejoin='round' stroke-linecap='round'/%3E%3Ccircle cx='4.5' cy='3.5' r='1.25' fill='%2368ef3f'/%3E%3C/svg%3E") 3 2, auto;
    --cur-pointer: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Ccircle cx='12' cy='12' r='8' fill='%23122314' fill-opacity='0.45' stroke='%2368ef3f' stroke-width='1.5'/%3E%3Ccircle cx='12' cy='12' r='2.5' fill='%2368ef3f'/%3E%3Cline x1='12' y1='1' x2='12' y2='5' stroke='%2368ef3f' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='12' y1='19' x2='12' y2='23' stroke='%2368ef3f' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='1' y1='12' x2='5' y2='12' stroke='%2368ef3f' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='19' y1='12' x2='23' y2='12' stroke='%2368ef3f' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") 12 12, pointer;
    --cur-text: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cline x1='8' y1='3' x2='16' y2='3' stroke='%2368ef3f' stroke-width='1.5' stroke-linecap='round'/%3E%3Cline x1='12' y1='3' x2='12' y2='21' stroke='%2368ef3f' stroke-width='1.75' stroke-linecap='round'/%3E%3Cline x1='8' y1='21' x2='16' y2='21' stroke='%2368ef3f' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E") 12 12, text;
  }

  html, body {
    cursor: var(--cur-default);
  }
  a, button, [role="button"], input[type="submit"], input[type="button"], label, select, .opt, .btn, .cta, .card, .row {
    cursor: var(--cur-pointer);
  }
  input[type="text"], input[type="search"], textarea {
    cursor: var(--cur-text);
  }

  /* Micro-interaction ambient trailing cursor ring (desktop fine pointer only) */
  #cur-dot {
    position: fixed; top: 0; left: 0; width: 8px; height: 8px; border-radius: 50%;
    background: var(--sprout); box-shadow: 0 0 10px rgba(104, 239, 63, 0.7);
    pointer-events: none; z-index: 99999; opacity: 0;
    transition: width 0.18s cubic-bezier(0.16, 1, 0.3, 1),
                height 0.18s cubic-bezier(0.16, 1, 0.3, 1),
                background 0.18s ease, border 0.18s ease, opacity 0.18s ease;
    will-change: transform;
  }
  #cur-dot.hovering {
    width: 32px; height: 32px;
    background: rgba(104, 239, 63, 0.14);
    border: 1.5px solid var(--sprout);
    box-shadow: 0 0 16px rgba(104, 239, 63, 0.4);
  }
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
    <span><a href="/dashboard">Registry</a> &middot; <a href="${esc(TELEGRAM_BOT)}" target="_blank" rel="noopener noreferrer">@CheckVerityBot</a> &middot; <a href="https://github.com/mintahandrews/verity" target="_blank" rel="noopener noreferrer">GitHub</a></span>
  </div>
  <p class="pledge">&ldquo;Unverified means we couldn't confirm provenance &mdash; not that the content is false.&rdquo;</p>
<script>
(() => {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const dot = document.createElement('div');
    dot.id = 'cur-dot';
    document.body.appendChild(dot);
    let x = -100, y = -100, cx = -100, cy = -100;
    window.addEventListener('mousemove', (e) => {
      x = e.clientX;
      y = e.clientY;
      dot.style.opacity = '1';
    }, { passive: true });
    window.addEventListener('mouseleave', () => { dot.style.opacity = '0'; });
    const tick = () => {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      dot.style.transform = 'translate3d(' + cx + 'px, ' + cy + 'px, 0) translate(-50%, -50%)';
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    document.addEventListener('mouseover', (e) => {
      if (e.target && e.target.closest('a, button, [role="button"], input, label, .btn, .cta, .card, .row, .sig, .faq-item')) {
        dot.classList.add('hovering');
      }
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target && e.target.closest('a, button, [role="button"], input, label, .btn, .cta, .card, .row, .sig, .faq-item')) {
        dot.classList.remove('hovering');
      }
    });
  }
})();
</script>
${o.script ?? ''}
</body>
</html>`;
}
