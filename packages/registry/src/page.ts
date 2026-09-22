import type { Verdict } from '@verity/core';
import { shell } from './layout.ts';

const GLYPH: Record<string, string> = {
  positive: '✓',
  negative: '✗',
  neutral: '-',
  unsupported: '-',
  error: '×',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CSS = `
  .cardwrap { max-width: 640px; margin: 0 auto; }
  .card { background: var(--white); border: 1px solid var(--fern); border-radius: 24px;
          padding: 32px; margin-top: 24px; }
  .animbox { width: 96px; height: 96px; margin: 0 0 8px; }
  .chip { display: inline-block; padding: 4px 14px; border-radius: 40px; font-weight: 600;
          font-size: 12px; letter-spacing: 0.03em; }
  .chip.verified { background: var(--sprout); color: var(--carbon); }
  .chip.unverified { background: var(--stone); color: var(--onyx); }
  .chip.suspicious { background: var(--onyx); color: var(--white); }
  .chip.failed { background: var(--soft); color: var(--carbon); }
  h1 { font-size: 24px; font-weight: 700; line-height: 1.33; letter-spacing: -0.015em; margin: 16px 0 4px; }
  .when { color: var(--lichen); font-size: 12px; }
  .signal { border-top: 1px solid var(--mist); padding: 16px 0; }
  .signal h2 { font-size: 14px; font-weight: 600; margin: 0 0 2px; }
  .signal .summary { margin: 0 0 6px; color: var(--moss); }
  .signal ul { margin: 0; padding-left: 18px; color: var(--lichen); font-size: 13px; }
  .outcome { font-weight: 700; margin-right: 6px; }
  .outcome.positive { color: var(--verdant); }
  .outcome.negative, .outcome.error { color: var(--carbon); }
  .outcome.neutral, .outcome.unsupported { color: var(--lichen); }
  .hash { font-size: 11px; color: var(--lichen); word-break: break-all; margin-top: 16px; }
  .checkcta { text-align: center; margin: 28px 0 0; font-size: 14px; color: var(--lichen); }
  .checkcta a { color: var(--verdant); font-weight: 600; text-decoration: none; }
  .sharerow { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 22px; }
  .sharerow a { font-size: 13px; font-weight: 600; color: var(--forest); text-decoration: none;
                border: 1px solid var(--fern); border-radius: 40px; padding: 7px 16px; }
  .sharerow a:hover { background: var(--wash); }
  .embedbox { margin-top: 20px; background: var(--bone); border: 1px solid var(--mist);
              border-radius: 12px; padding: 12px 16px; font-size: 12px; }
  .embedbox p { margin: 0 0 6px; color: var(--lichen); font-weight: 600; }
  .embedbox code { display: block; word-break: break-all; color: var(--moss);
                   font-size: 11px; user-select: all; }
  @media (max-width: 600px) {
    .card { padding: 20px; border-radius: 18px; margin-top: 8px; }
    h1 { font-size: 20px; }
    .signal { padding: 12px 0; }
    .signal ul { padding-left: 16px; font-size: 12px; }
  }
`;

/** Server-rendered shareable verdict page - same palette as the extension card. */
export function verdictPage(verdict: Verdict, sha256: string, publicUrl = '', ots?: string): string {
  const chipClass = verdict.error ? 'failed' : verdict.state;
  const chipLabel = verdict.error ? 'CHECK FAILED' : verdict.state.toUpperCase();
  const canonical = publicUrl ? `${publicUrl}/v/${sha256}` : undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: `Verity Verification Verdict: ${verdict.headline}`,
    description: `Media authenticity evidence report for SHA-256 ${sha256}. State: ${verdict.state}.`,
    datePublished: verdict.checkedAt,
    author: {
      '@type': 'Organization',
      name: 'Verity Provenance Engine',
      url: publicUrl || 'https://github.com/mintahandrews/verity',
    },
    about: {
      '@type': 'MediaObject',
      sha256: sha256,
      name: verdict.headline,
    },
  };

  const hasC2pa = verdict.signals.some(
    (s) => s.signalId === 'c2pa' && s.outcome === 'positive',
  );

  // Growth loop: every shared verdict is a distribution channel.
  const pageUrl = `${publicUrl}/v/${sha256}`;
  const shareText = encodeURIComponent(`Verity verdict: ${chipLabel} - ${verdict.headline}`);
  const shareLink = encodeURIComponent(pageUrl);
  const ogCard =
    chipClass === 'verified' || chipClass === 'unverified' || chipClass === 'suspicious'
      ? `${publicUrl}/assets/og-${chipClass}.png`
      : `${publicUrl}/assets/og-image.jpg`;
  const badgeSnippet = `<a href="${pageUrl}"><img src="${publicUrl}/badge/${sha256}.svg" alt="Verity verdict: ${chipLabel.toLowerCase()}"></a>`;
  const signals = verdict.signals
    .filter((s) => s.outcome !== 'unsupported')
    .map(
      (s) => `
      <div class="signal">
        <h2><span class="outcome ${s.outcome}">${GLYPH[s.outcome] ?? '-'}</span>${esc(s.signalName)}</h2>
        <p class="summary">${esc(s.summary)}</p>
        <ul>
          ${s.evidence.map((e) => `<li>${esc(e.label)}${e.detail ? ` - <span>${esc(e.detail)}</span>` : ''}</li>`).join('')}
        </ul>
      </div>`,
    )
    .join('');

  return shell({
    title: `Verity Verdict: ${verdict.state.toUpperCase()} - ${verdict.headline}`,
    description: `Authenticity evidence for SHA-256 ${sha256}: ${verdict.headline}. Verified C2PA provenance and metadata forensics.`,
    canonicalUrl: canonical,
    ogTitle: `Verity Verdict: ${verdict.state.toUpperCase()} - ${verdict.headline}`,
    ogDescription: verdict.headline,
    ogImage: publicUrl ? ogCard : undefined,
    jsonLd,
    back: { href: '/dashboard', label: 'Registry' },
    css: CSS,
    script:
      chipClass === 'failed'
        ? ''
        : `<script src="/anim/lottie.min.js"></script>
<script>(function(){if(!window.lottie)return;var box=document.createElement('div');box.className='animbox';box.style.display='none';box.setAttribute('aria-hidden','true');var card=document.querySelector('.card');card.insertBefore(box,card.firstChild);var a=lottie.loadAnimation({container:box,renderer:'svg',loop:false,autoplay:true,path:'/anim/${chipClass}.json?v=5'});a.addEventListener('data_ready',function(){box.style.display=''})})()</script>`,
    body: `
<div class="wrap cardwrap">
  <article class="card">
    <span class="chip ${chipClass}">${chipLabel}</span>
    <h1>${esc(verdict.headline)}</h1>
    <p class="when">Checked <time datetime="${esc(verdict.checkedAt)}">${esc(new Date(verdict.checkedAt).toLocaleString())}</time></p>
    ${signals || '<p class="summary">No checks could run on this media.</p>'}
    ${hasC2pa ? '<p class="checkcta" style="margin-top:12px"><a href="https://verify.contentauthenticity.org" target="_blank" rel="noopener noreferrer">Independently verify the C2PA credential</a></p>' : ''}
    <p class="hash">SHA-256: <code>${esc(sha256)}</code>${ots ? `<br>Timestamp anchored via OpenTimestamps (${ots.slice(0, 16)}&hellip;)` : ''}</p>
  </article>
  <div class="sharerow">
    <a href="https://x.com/intent/post?text=${shareText}%20${shareLink}" target="_blank" rel="noopener noreferrer">Post on X</a>
    <a href="https://t.me/share/url?url=${shareLink}&amp;text=${shareText}" target="_blank" rel="noopener noreferrer">Share on Telegram</a>
    <a href="https://wa.me/?text=${shareText}%20${shareLink}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
    <a href="https://t.me/CheckVerityBot" target="_blank" rel="noopener noreferrer">Check media via bot</a>
  </div>
  <div class="embedbox">
    <p>Embed this verdict on your site:</p>
    <code>${esc(badgeSnippet)}</code>
  </div>
</div>`,
  });
}
