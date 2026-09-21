import '@fontsource/instrument-serif/400.css';
import '../design/tokens.css';
import type { Verdict } from '@verity/core';
import { verdictKey } from '../messages';

const OUTCOME_GLYPH: Record<string, string> = {
  positive: '✓',
  negative: '✗',
  neutral: '–',
  unsupported: '–',
  error: '×',
};

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function render(): Promise<void> {
  const card = document.getElementById('card')!;
  const id = new URLSearchParams(location.search).get('id');
  const key = id ? verdictKey(id) : '';
  const stored = (await chrome.storage.session.get(key)) as Record<string, Verdict>;
  const verdict = key ? stored[key] : undefined;

  if (!verdict) {
    card.innerHTML = '<p>Verdict not found — it may have expired (session storage).</p>';
    return;
  }

  const signals = verdict.signals
    .filter((s) => s.outcome !== 'unsupported')
    .map(
      (s) => `
      <div class="signal">
        <h2><span class="outcome ${s.outcome}">${OUTCOME_GLYPH[s.outcome] ?? '–'}</span>${escapeHtml(s.signalName)}</h2>
        <p class="summary">${escapeHtml(s.summary)}</p>
        <ul>
          ${s.evidence
            .map(
              (e) =>
                `<li>${escapeHtml(e.label)}${e.detail ? ` — <span>${escapeHtml(e.detail)}</span>` : ''}</li>`,
            )
            .join('')}
        </ul>
      </div>`,
    )
    .join('');

  card.innerHTML = `
    <div class="wordmark">Verity</div>
    <span class="chip ${verdict.state}">${verdict.state.toUpperCase()}</span>
    <h1>${escapeHtml(verdict.headline)}</h1>
    <p class="when">Checked ${new Date(verdict.checkedAt).toLocaleString()}</p>
    ${signals || '<p class="summary">No checks could run on this media.</p>'}
  `;
}

void render();
