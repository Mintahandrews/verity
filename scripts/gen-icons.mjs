// Generates extension icons — no dependencies, writes minimal PNGs.
// Design: Electric Sprout checkmark on Forest Depths — neo-botanical system.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../packages/extension/public/icons',
);

// --- minimal PNG encoder (8-bit RGBA) -------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      row.set(pixel(x, y, size), 1 + x * 4);
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- drawing ---------------------------------------------------------------

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const BG = [0x12, 0x23, 0x14, 255]; // Forest Depths
const FG = [0x68, 0xef, 0x3f, 255]; // Electric Sprout
const CLEAR = [0, 0, 0, 0];

function pixel(x, y, size) {
  const u = x / size;
  const v = y / size;
  // rounded-ish corners: clear a small triangle in each corner
  const r = 0.18;
  const inCorner =
    (u < r && v < r && Math.hypot(u - r, v - r) > r) ||
    (u > 1 - r && v < r && Math.hypot(u - (1 - r), v - r) > r) ||
    (u < r && v > 1 - r && Math.hypot(u - r, v - (1 - r)) > r) ||
    (u > 1 - r && v > 1 - r && Math.hypot(u - (1 - r), v - (1 - r)) > r);
  if (inCorner) return CLEAR;
  // checkmark: two strokes
  const w = 0.07;
  const onCheck =
    distToSeg(u, v, 0.22, 0.55, 0.44, 0.75) < w ||
    distToSeg(u, v, 0.44, 0.75, 0.8, 0.3) < w;
  return onCheck ? FG : BG;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [16, 48, 128, 512]) {
  writeFileSync(join(OUT_DIR, `icon${size}.png`), png(size, pixel));
  console.log(`wrote icon${size}.png`);
}
// Telegram bot avatar (BotFather wants >=150px; 512 is the sweet spot).
writeFileSync(join(OUT_DIR, 'bot-avatar.png'), png(512, pixel));
console.log('wrote bot-avatar.png');
