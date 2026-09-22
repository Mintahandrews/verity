import type { VerdictState } from '@verity/core';

type BadgeState = VerdictState | 'error';

const GLYPHS: Record<BadgeState, string> = {
  verified: '✓',
  unverified: '?',
  suspicious: '!',
  error: '×',
};

// Palette from design/tokens.css - hardcoded because badges are injected into
// arbitrary pages where our CSS variables don't exist.
const PAINT: Record<BadgeState, { bg: string; fg: string; border: string }> = {
  verified: { bg: '#68ef3f', fg: '#122314', border: '#ffffff' }, // Electric Sprout
  unverified: { bg: '#f2f5eb', fg: '#30322a', border: '#b7bda5' }, // Bone White / Pale Fern
  suspicious: { bg: '#30322a', fg: '#ffffff', border: '#ffffff' }, // Onyx Olive
  error: { bg: '#d6d6d6', fg: '#222222', border: '#ffffff' }, // Cool Stone
};

const TITLES: Record<BadgeState, string> = {
  verified: 'Verity: verified provenance - click for details',
  unverified: 'Verity: unverified - click for details',
  suspicious: 'Verity: suspicious - click for details',
  error: 'Verity: check failed',
};

function sameUrl(a: string, b: string): boolean {
  try {
    return new URL(a, location.href).href === new URL(b, location.href).href;
  } catch {
    return a === b;
  }
}

export function findMediaElement(url: string): HTMLElement | null {
  for (const el of document.querySelectorAll('img, video, audio')) {
    const media = el as HTMLMediaElement;
    const src = media.currentSrc || el.getAttribute('src') || (el as HTMLVideoElement).poster;
    if (src && sameUrl(src, url)) return el as HTMLElement;
  }
  return null;
}

export function attachBadge(mediaUrl: string, verdictId: string | null, state: BadgeState): boolean {
  const target = findMediaElement(mediaUrl);
  if (!target || target.dataset.verityBadged) return false;
  // Skip icons/avatars/thumbnails - a 24px badge would cover them entirely.
  const rect = target.getBoundingClientRect();
  if (rect.width < 56 || rect.height < 56) return false;
  target.dataset.verityBadged = '1';

  const paint = PAINT[state];
  const badge = document.createElement('button');
  badge.textContent = GLYPHS[state];
  badge.title = TITLES[state];
  badge.setAttribute(
    'style',
    [
      'position:absolute', 'top:6px', 'left:6px', 'z-index:2147483647',
      'width:24px', 'height:24px', 'border-radius:9999px',
      `border:2px solid ${paint.border}`,
      `background:${paint.bg}`, `color:${paint.fg}`,
      'font:700 13px/20px Aeonik, Inter, system-ui, sans-serif',
      'cursor:pointer', 'padding:0', 'box-shadow:0 1px 5px rgba(0,0,0,.45)',
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
  if (!parent) return false;
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  parent.appendChild(badge);
  return true;
}
