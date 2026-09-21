import type { RegistryRecord } from './store.ts';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STATE_ICON: Record<string, string> = {
  verified: '✓',
  unverified: '?',
  suspicious: '!',
};

/** Server-rendered index — the newsroom/journalist face of the registry. */
export function dashboardPage(stats: Record<string, number>, recent: RegistryRecord[]): string {
  const rows = recent
    .map(
      (r) => `
      <a class="row" href="/v/${esc(r.sha256)}">
        <span class="chip ${esc(r.verdict.state)}">${STATE_ICON[r.verdict.state] ?? '?'}</span>
        <span class="headline">${esc(r.verdict.headline)}</span>
        <span class="when">${esc(new Date(r.createdAt).toLocaleString())}</span>
        <span class="hits">${r.hits} lookup${r.hits === 1 ? '' : 's'}</span>
      </a>`,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Verity registry</title>
<style>
  :root {
    --forest: #122314; --moss: #273f2b; --lichen: #7e8371; --fern: #b7bda5;
    --sprout: #68ef3f; --verdant: #26a200; --wash: #e7f9dd; --mist: #d9deca;
    --carbon: #222222; --onyx: #30322a; --stone: #d6d6d6;
    --bone: #f2f5eb; --white: #ffffff;
    --ui: 'Aeonik', 'Inter', ui-sans-serif, system-ui, sans-serif;
    --accent: 'Instrument Serif', ui-serif, Georgia, serif;
  }
  body { font-family: var(--ui); margin: 0; background: var(--forest); color: var(--white);
         font-size: 16px; line-height: 1.5; letter-spacing: -0.031em; }
  header { max-width: 880px; margin: 0 auto; padding: 48px 16px 24px; }
  .wordmark { font-size: 12px; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase;
              color: var(--lichen); }
  h1 { font-size: 40px; font-weight: 700; line-height: 1.1; letter-spacing: -0.015em; margin: 12px 0 8px; }
  h1 .g { color: var(--sprout); }
  .sub { color: var(--fern); max-width: 560px; margin: 0; }
  .stats { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px; }
  .stat { background: var(--moss); border: 1px solid var(--onyx); border-radius: 40px;
          padding: 4px 16px; font-size: 13px; }
  .stat b { color: var(--sprout); font-weight: 600; }
  main { max-width: 880px; margin: 0 auto; padding: 0 16px 48px; }
  .panel { background: var(--bone); border-radius: 24px; padding: 24px; color: var(--onyx); }
  .panel h2 { font-size: 18px; font-weight: 600; margin: 0 0 12px; }
  form { display: flex; gap: 8px; margin-bottom: 16px; }
  input[type=text] { flex: 1; border: 1px solid var(--fern); border-radius: 24px;
                     padding: 8px 16px; font: inherit; font-size: 14px; background: var(--white);
                     color: var(--onyx); }
  button { background: var(--sprout); color: var(--carbon); border: 0; border-radius: 28px;
           padding: 8px 20px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
  .row { display: grid; grid-template-columns: 32px 1fr auto auto; gap: 12px; align-items: center;
         padding: 12px 8px; border-top: 1px solid var(--mist); text-decoration: none; color: inherit; }
  .row:hover { background: var(--wash); border-radius: 12px; }
  .chip { width: 24px; height: 24px; border-radius: 40px; display: inline-flex; align-items: center;
          justify-content: center; font-weight: 700; font-size: 13px; }
  .chip.verified { background: var(--sprout); color: var(--carbon); }
  .chip.unverified { background: var(--stone); color: var(--onyx); }
  .chip.suspicious { background: var(--onyx); color: var(--white); }
  .headline { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .when, .hits { font-size: 12px; color: var(--lichen); white-space: nowrap; }
  .empty { color: var(--lichen); font-size: 14px; padding: 16px 8px; }
  footer { max-width: 880px; margin: 0 auto; padding: 0 16px 40px; font-family: var(--accent);
           font-size: 16px; color: var(--lichen); }
</style>
</head>
<body>
<header>
  <div class="wordmark">Verity</div>
  <h1>The public verdict <span class="g">registry</span></h1>
  <p class="sub">Every check makes the network smarter. Verdicts are keyed by content hash — no media is ever stored here.</p>
  <div class="stats">
    <span class="stat"><b>${stats['total'] ?? 0}</b> verdicts</span>
    <span class="stat"><b>${stats['verified'] ?? 0}</b> verified</span>
    <span class="stat"><b>${stats['unverified'] ?? 0}</b> unverified</span>
    <span class="stat"><b>${stats['suspicious'] ?? 0}</b> suspicious</span>
  </div>
</header>
<main>
  <div class="panel">
    <h2>Look up a verdict</h2>
    <form onsubmit="location.href='/v/'+this.sha.value.trim();return false">
      <input type="text" name="sha" placeholder="sha256 hash (64 hex chars)" pattern="[0-9a-fA-F]{64}">
      <button type="submit">Look up</button>
    </form>
    <h2>Recent checks</h2>
    ${rows || '<p class="empty">Nothing checked yet — verdicts appear here as media is verified.</p>'}
  </div>
</main>
<footer>Verity never labels media “fake”. Unverified means provenance couldn’t be confirmed — not that the content is false.</footer>
</body>
</html>`;
}
