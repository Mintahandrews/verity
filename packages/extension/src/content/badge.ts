import type { VerdictState } from '@verity/core';

type BadgeState = VerdictState | 'error';

const GLYPHS: Record<BadgeState, string> = {
  verified: '✓',
  unverified: '?',
  suspicious: '!',
  error: '×',
};

const COLORS: Record<BadgeState, string> = {
  verified: '#16a34a',
  unverified: '#64748b',
  suspicious: '#ea580c',
  error: '#dc2626',
};

const TITLES: Record<BadgeState, string> = {
  verified: 'Verity: verified provenance — click for details',
  unverified: 'Verity: unverified — click for details',
  suspicious: 'Verity: suspicious — click for details',
  error: 'Verity: check failed',
};

function sameUrl(a: string, b: string): boolean {
  try {
    return new URL(a, location.href).href === new URL(b, location.href).href;
  } catch {
    return a === b;
  }
}

function findMediaElement(url: string): HTMLElement | null {
  for (const el of document.querySelectorAll('img, video, audio')) {
    const media = el as HTMLMediaElement;
    const src = media.currentSrc || el.getAttribute('src') || (el as HTMLVideoElement).poster;
    if (src && sameUrl(src, url)) return el as HTMLElement;
  }
  return null;
}

export function attachBadge(mediaUrl: string, verdictId: string | null, state: BadgeState): void {
  const target = findMediaElement(mediaUrl);
  if (!target || target.dataset.verityBadged) return;
  target.dataset.verityBadged = '1';

  const badge = document.createElement('button');
  badge.textContent = GLYPHS[state];
  badge.title = TITLES[state];
  badge.setAttribute(
    'style',
    [
      'position:absolute', 'top:6px', 'left:6px', 'z-index:2147483647',
      'width:22px', 'height:22px', 'border-radius:50%', 'border:2px solid #fff',
      `background:${COLORS[state]}`, 'color:#fff', 'font:700 13px/18px system-ui',
      'cursor:pointer', 'padding:0', 'box-shadow:0 1px 4px rgba(0,0,0,.4)',
    ].join(';'),
  );
  if (verdictId) {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      void chrome.runtime.sendMessage({ type: 'verity:open', verdictId });
    });
  } else {
    badge.style.cursor = 'default';
  }

  const parent = target.parentElement;
  if (parent) {
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    parent.appendChild(badge);
  }
}
