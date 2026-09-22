import type { VerdictState } from '@verity/core';

/** shields.io-style verdict badge - pure SVG, no font dependency at render. */
export function badgeSvg(state: VerdictState | 'failed', label?: string): string {
  const text = label ?? (state === 'failed' ? 'check failed' : state);
  const colors: Record<string, string> = {
    verified: '#26a200',
    unverified: '#7e8371',
    suspicious: '#d97706',
    failed: '#555555',
  };
  const color = colors[state] ?? '#555555';
  const lw = 44; // "verity" label width
  const vw = text.length * 7 + 14; // ~7px/char at 11px monospace-ish
  const total = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="verity: ${text}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#122314"/>
    <rect x="${lw}" width="${vw}" height="20" fill="${color}"/>
    <rect width="${total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14" fill="#68ef3f">verity</text>
    <text x="${lw + vw / 2}" y="14">${text}</text>
  </g>
</svg>`;
}
