// Generate per-state verdict og-cards (1200×630 PNG) into the registry's
// public assets. Run once locally: node scripts/gen-og-cards.mjs
// Committed static PNGs - no runtime font/render dependency on the server.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const OUT = fileURLToPath(new URL('../packages/registry/public/assets', import.meta.url));

const STATES = [
  { key: 'verified', label: 'VERIFIED', color: '#26a200', sub: 'Cryptographic provenance confirmed' },
  { key: 'unverified', label: 'UNVERIFIED', color: '#7e8371', sub: 'Unproven - not false' },
  { key: 'suspicious', label: 'SUSPICIOUS', color: '#d97706', sub: 'Evidence contradicts the claims' },
];

for (const s of STATES) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#122314"/>
  <circle cx="1080" cy="90" r="260" fill="#273f2b" opacity="0.55"/>
  <circle cx="90" cy="560" r="200" fill="#273f2b" opacity="0.4"/>
  <text x="80" y="140" font-family="Verdana,Geneva,sans-serif" font-size="34" font-weight="bold" fill="#68ef3f" letter-spacing="6">VERITY.</text>
  <rect x="80" y="200" width="${s.label.length * 34 + 70}" height="86" rx="43" fill="${s.color}"/>
  <text x="115" y="258" font-family="Verdana,Geneva,sans-serif" font-size="44" font-weight="bold" fill="#f2f5eb" letter-spacing="3">${s.label}</text>
  <text x="80" y="360" font-family="Georgia,serif" font-style="italic" font-size="52" fill="#f2f5eb">${s.sub}</text>
  <text x="80" y="470" font-family="Verdana,Geneva,sans-serif" font-size="26" fill="#b7bda5">Is it real? Better question: what can we verify?</text>
  <text x="80" y="560" font-family="Verdana,Geneva,sans-serif" font-size="22" fill="#7e8371">verity.codemintah.dev · open-source media authenticity</text>
</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(join(OUT, `og-${s.key}.png`), png);
  console.log(`og-${s.key}.png ${Math.round(png.length / 1024)}KB`);
}
