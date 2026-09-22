import '@fontsource/instrument-serif/400.css';
import '../design/tokens.css';
import { errorVerdict } from '@verity/core';
import type { MediaKind, Verdict } from '@verity/core';
import { fetchMedia, runPipeline } from '../analysis';
import { verdictKey } from '../messages';

// Vendored lottie-web (public/anim/lottie.min.js) loaded via script tag.
declare const lottie: {
  loadAnimation(opts: {
    container: HTMLElement;
    renderer: string;
    loop: boolean;
    autoplay: boolean;
    path: string;
  }): void;
};

function playVerdictAnim(card: HTMLElement, state: string): void {
  if (typeof lottie === 'undefined' || !['verified', 'unverified', 'suspicious'].includes(state))
    return;
  const box = document.createElement('div');
  box.className = 'animbox';
  card.prepend(box);
  lottie.loadAnimation({
    container: box,
    renderer: 'svg',
    loop: false,
    autoplay: true,
    // ?v= busts the extension-origin cache - anim JSON files keep fixed
    // names across builds, so a stale cached copy would crash lottie.
    path: `${chrome.runtime.getURL(`anim/${state}.json`)}?v=5`,
  });
}

const OUTCOME_GLYPH: Record<string, string> = {
  positive: '✓',
  negative: '✗',
  neutral: '-',
  unsupported: '-',
  error: '×',
};

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderVerdict(verdict: Verdict): void {
  const card = document.getElementById('card')!;
  const chipClass = verdict.error ? 'failed' : verdict.state;
  const chipLabel = verdict.error ? 'CHECK FAILED' : verdict.state.toUpperCase();

  const signals = verdict.signals
    .filter((s) => s.outcome !== 'unsupported')
    .map(
      (s) => `
      <div class="signal">
        <h2><span class="outcome ${s.outcome}">${OUTCOME_GLYPH[s.outcome] ?? '-'}</span>${escapeHtml(s.signalName)}</h2>
        <p class="summary">${escapeHtml(s.summary)}</p>
        <ul>
          ${s.evidence
            .map(
              (e) =>
                `<li>${escapeHtml(e.label)}${e.detail ? ` - <span>${escapeHtml(e.detail)}</span>` : ''}</li>`,
            )
            .join('')}
        </ul>
      </div>`,
    )
    .join('');

  card.innerHTML = `
    <div class="wordmark">Verity</div>
    <span class="chip ${chipClass}">${chipLabel}</span>
    <h1>${escapeHtml(verdict.headline)}</h1>
    <p class="when">Checked ${new Date(verdict.checkedAt).toLocaleString()}</p>
    ${signals || '<p class="summary">No checks could run on this media.</p>'}
    ${verdict.shareUrl && /^https?:/.test(verdict.shareUrl) ? `<p class="share"><a href="${escapeHtml(verdict.shareUrl)}" target="_blank" rel="noopener">Shareable verdict ↗</a></p>` : ''}
  `;
  playVerdictAnim(card, verdict.error ? 'failed' : verdict.state);
}

async function render(): Promise<void> {
  const card = document.getElementById('card')!;
  const params = new URLSearchParams(location.search);

  // Analyze mode: ?u=<media-url>&k=<kind> - used on Firefox (no offscreen API)
  // and as a standalone "check this URL" page.
  const analyzeUrl = params.get('u');
  if (analyzeUrl) {
    card.innerHTML = '<p>Analyzing…</p>';
    const kind = (params.get('k') ?? 'image') as MediaKind;
    let verdict: Verdict;
    try {
      const blob = await fetchMedia(analyzeUrl);
      verdict = await runPipeline({ url: analyzeUrl, kind }, blob);
    } catch (e) {
      verdict = errorVerdict(e instanceof Error ? e.message : String(e));
    }
    const id = crypto.randomUUID();
    await chrome.storage.session.set({ [verdictKey(id)]: verdict });
    history.replaceState(null, '', `?id=${id}`);
    renderVerdict(verdict);
    return;
  }

  const id = params.get('id');
  const key = id ? verdictKey(id) : '';
  const stored = (await chrome.storage.session.get(key)) as Record<string, Verdict>;
  const verdict = key ? stored[key] : undefined;

  if (!verdict) {
    card.innerHTML = '<p>Verdict not found - it may have expired (session storage).</p>';
    return;
  }
  renderVerdict(verdict);
}

void render();
