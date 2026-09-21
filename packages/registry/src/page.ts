import type { Verdict } from '@verity/core';

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

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verity - ${esc(verdict.state)} verdict</title>
<meta property="og:title" content="Verity verdict: ${esc(verdict.state)}">
<meta property="og:description" content="${esc(verdict.headline)}">
<style>
  :root {
    --forest: #122314; --moss: #273f2b; --lichen: #7e8371; --fern: #b7bda5;
    --sprout: #68ef3f; --verdant: #26a200; --wash: #e7f9dd; --mist: #d9deca;
    --carbon: #222222; --onyx: #30322a; --stone: #d6d6d6; --soft: #dcdfe3;
    --bone: #f2f5eb; --white: #ffffff;
    --ui: 'Aeonik', 'Inter', ui-sans-serif, system-ui, sans-serif;
    --accent: 'Instrument Serif', ui-serif, Georgia, serif;
  }
  body { font-family: var(--ui); font-size: 16px; line-height: 1.5; letter-spacing: -0.031em;
         margin: 0; background: var(--white); color: var(--onyx); }
  main { max-width: 640px; margin: 40px auto; padding: 0 16px; }
  .card { background: var(--bone); border: 1px solid var(--fern); border-radius: 24px; padding: 32px; }
  .wordmark { font-size: 12px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase;
              color: var(--lichen); margin-bottom: 16px; }
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
  footer { max-width: 640px; margin: 16px auto; padding: 0 16px; font-family: var(--accent);
           font-size: 16px; color: var(--lichen); }
</style>
</head>
<body>
<main>
  <div class="card">
    <div class="wordmark">Verity</div>
    <span class="chip ${chipClass}">${chipLabel}</span>
    <h1>${esc(verdict.headline)}</h1>
    <p class="when">Checked ${esc(new Date(verdict.checkedAt).toLocaleString())}</p>
    ${signals || '<p class="summary">No checks could run on this media.</p>'}
    <p class="hash">sha256 ${esc(sha256)}</p>
  </div>
</main>
<footer>Verity never labels media “fake”. Unverified means provenance couldn’t be confirmed - not that the content is false.</footer>
</body>
</html>`;
}
