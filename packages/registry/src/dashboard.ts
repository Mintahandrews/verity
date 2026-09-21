import type { RegistryRecord } from './store.ts';
import { shell } from './layout.ts';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const STATE_ICON: Record<string, string> = {
  verified: '✓',
  unverified: '?',
  suspicious: '!',
};

const CSS = `
  .pagehead { padding: 24px 0 32px; }
  .pagehead h1 { font-size: clamp(30px, 5vw, 44px); font-weight: 700; line-height: 1.1;
                 letter-spacing: -0.015em; margin: 0 0 8px; }
  .pagehead h1 .g { color: var(--sprout); }
  .pagehead .sub { color: var(--fern); max-width: 560px; margin: 0; }
  .stats { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; }
  .stat { background: var(--moss); border: 1px solid var(--onyx); border-radius: 40px;
          padding: 4px 16px; font-size: 13px; color: var(--fern); }
  .stat b { color: var(--sprout); font-weight: 600; }
  .panel { background: var(--white); border: 1px solid var(--mist); border-radius: 24px;
           padding: 24px; color: var(--onyx); }
  .panel h2 { font-size: 18px; font-weight: 600; margin: 0 0 12px; }
  form { display: flex; gap: 8px; margin-bottom: 20px; }
  input[type=text] { flex: 1; border: 1px solid var(--fern); border-radius: 24px;
                     padding: 8px 16px; font: inherit; font-size: 14px; background: var(--bone);
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
  @media (max-width: 600px) {
    .pagehead { padding: 16px 0 24px; }
    .panel { padding: 16px; border-radius: 18px; }
    form { flex-direction: column; }
    .row { grid-template-columns: 28px 1fr auto; gap: 10px; padding: 10px 6px; }
    .row .when { display: none; }
    .headline { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2;
                -webkit-box-orient: vertical; }
  }
`;

/** Server-rendered registry dashboard - the newsroom/journalist face. */
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

  return shell({
    title: 'Verity - verdict registry',
    description: 'Public verdict registry: hash-keyed verdicts, recent checks, lookup.',
    active: 'registry',
    css: CSS,
    hero: `
  <header class="pagehead">
    <h1>The public verdict <span class="g">registry</span></h1>
    <p class="sub">Every check makes the network smarter. Verdicts are keyed by content hash - no media is ever stored here.</p>
    <div class="stats">
      <span class="stat"><b>${stats['total'] ?? 0}</b> verdicts</span>
      <span class="stat"><b>${stats['verified'] ?? 0}</b> verified</span>
      <span class="stat"><b>${stats['unverified'] ?? 0}</b> unverified</span>
      <span class="stat"><b>${stats['suspicious'] ?? 0}</b> suspicious</span>
    </div>
  </header>`,
    body: `
<div class="wrap">
  <div class="panel">
    <h2>Look up a verdict</h2>
    <form onsubmit="location.href='/v/'+this.sha.value.trim();return false">
      <input type="text" name="sha" placeholder="sha256 hash (64 hex chars)" pattern="[0-9a-fA-F]{64}">
      <button type="submit">Look up</button>
    </form>
    <h2>Recent checks</h2>
    ${rows || '<p class="empty">Nothing checked yet - verdicts appear here as media is verified.</p>'}
  </div>
</div>`,
  });
}
