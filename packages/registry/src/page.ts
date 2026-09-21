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
  @media (max-width: 600px) {
    .card { padding: 20px; border-radius: 18px; margin-top: 8px; }
    h1 { font-size: 20px; }
    .signal { padding: 12px 0; }
    .signal ul { padding-left: 16px; font-size: 12px; }
  }
`;

/** Server-rendered shareable verdict page - same palette as the extension card. */
export function verdictPage(verdict: Verdict, sha256: string): string {
  const chipClass = verdict.error ? 'failed' : verdict.state;
  const chipLabel = verdict.error ? 'CHECK FAILED' : verdict.state.toUpperCase();
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
    title: `Verity - ${verdict.state} verdict`,
    ogTitle: `Verity verdict: ${verdict.state}`,
    ogDescription: verdict.headline,
    css: CSS,
    script:
      chipClass === 'failed'
        ? ''
        : `<script src="/anim/lottie.min.js"></script>
<script>lottie.loadAnimation({container:document.getElementById('anim'),renderer:'svg',loop:false,autoplay:true,path:'/anim/${chipClass}.json'})</script>`,
    body: `
<div class="wrap cardwrap">
  <div class="card">
    ${chipClass === 'failed' ? '' : '<div class="animbox" id="anim"></div>'}
    <span class="chip ${chipClass}">${chipLabel}</span>
    <h1>${esc(verdict.headline)}</h1>
    <p class="when">Checked ${esc(new Date(verdict.checkedAt).toLocaleString())}</p>
    ${signals || '<p class="summary">No checks could run on this media.</p>'}
    <p class="hash">sha256 ${esc(sha256)}</p>
  </div>
  <p class="checkcta">Check media yourself - forward it to
    <a href="https://t.me/CheckVerityBot">@CheckVerityBot</a> on Telegram.</p>
</div>`,
  });
}
