// Generates Verity's Lottie animations - no dependencies, theme-consistent.
// Emits JSON to packages/extension/public/anim/ and packages/registry/public/anim/,
// plus gzipped .tgs stickers for the Telegram bot (512x512, shapes only, <64KB).
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT_OUT = join(ROOT, 'packages/extension/public/anim');
const REG_OUT = join(ROOT, 'packages/registry/public/anim');
const TGS_OUT = join(ROOT, 'packages/bot/assets');

// Palette (normalized 0-1 for Lottie)
const SPROUT = [0.408, 0.937, 0.247, 1]; // #68ef3f
const FOREST = [0.071, 0.137, 0.078, 1]; // #122314
const ONYX = [0.188, 0.196, 0.165, 1];   // #30322a
const STONE = [0.839, 0.839, 0.839, 1];  // #d6d6d6
const VERDANT = [0.149, 0.635, 0.0, 1];  // #26a200
const WHITE = [1, 1, 1, 1];

const prop = (k) => ({ a: 0, k });
const ease = { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } };
const kf = (frames) => ({ a: 1, k: frames.map(([t, s]) => ({ ...ease, t, s: [s] })) });

const ident = (over = {}) => ({
  o: prop(100), r: prop(0), p: prop([256, 256, 0]), a: prop([0, 0, 0]),
  s: prop([100, 100, 0]), ...over,
});
const tr = (over = {}) => ({ ty: 'tr', p: prop([0, 0]), a: prop([0, 0]), s: prop([100, 100]), r: prop(0), o: prop(100), ...over });

const group = (name, it) => ({ ty: 'gr', nm: name, it });
const ellipse = (cx, cy, w, h) => ({ ty: 'el', p: prop([cx, cy]), s: prop([w, h]), d: 1 });
const fill = (c) => ({ ty: 'fl', c: prop(c), o: prop(100), r: 1 });
const stroke = (c, w) => ({ ty: 'st', c: prop(c), o: prop(100), w: prop(w), lc: 2, lj: 2 });
const trim = (endKf, startK = prop(0)) => ({ ty: 'tm', s: startK, e: endKf, o: prop(0), m: 1 });
const path = (v, i, o, closed = false) => ({
  ty: 'sh', ks: prop({ c: closed, v, i: i ?? v.map(() => [0, 0]), o: o ?? v.map(() => [0, 0]) }),
});
const shapeLayer = (ind, name, shapes, ks = ident()) => ({
  ddd: 0, ind, ty: 4, nm: name, sr: 1, ks, shapes, ao: 0, ip: 0, op: 120, st: 0,
});

const doc = (name, layers) => ({
  v: '5.7.4', fr: 60, ip: 0, op: 90, w: 512, h: 512, nm: name, layers, assets: [],
});

// Circle that pops 0 -> 108 -> 100.
const popLayer = (ind, name, color, size = 400) =>
  shapeLayer(ind, name, [group(name, [ellipse(0, 0, size, size), fill(color), tr()])],
    ident({ s: kf([[0, 0], [24, 112], [36, 96], [46, 100]]) }));

// Stroke-drawn path via trim (0 -> 100).
const drawLayer = (ind, name, v, color, w, i, o) =>
  shapeLayer(ind, name, [
    group(name, [path(v, i, o), stroke(color, w), trim(kf([[16, 0], [44, 100]])), tr()]),
  ]);

const fadeLayer = (ind, name, shapes, ks) =>
  shapeLayer(ind, name, shapes, ident({ o: kf([[40, 0], [54, 100]]), ...ks }));

const anims = {
  // Sprout circle pops, checkmark strokes on.
  verified: doc('verified', [
    popLayer(1, 'disc', SPROUT),
    drawLayer(2, 'check', [[-110, 14], [-34, 84], [118, -76]], FOREST, 46),
  ]),

  // Stone ring + question mark (hook curve + dot).
  unverified: doc('unverified', [
    popLayer(1, 'disc', STONE),
    drawLayer(2, 'hook',
      [[-52, -72], [-52, -128], [52, -128], [52, -52], [0, -14], [0, 26]],
      ONYX, 44,
      // smooth tangents for the hook curve
      [[-30, 0], [0, 34], [30, 0], [0, 30], [-24, 22], [0, 0]],
      [[0, -30], [30, 0], [0, 34], [-26, 16], [0, 0], [0, 0]]),
    fadeLayer(3, 'dot', [group('dot', [ellipse(0, 96, 44, 44), fill(ONYX), tr()])]),
  ]),

  // Onyx disc + exclamation (bar + dot).
  suspicious: doc('suspicious', [
    popLayer(1, 'disc', ONYX),
    drawLayer(2, 'bar', [[0, -100], [0, 30]], WHITE, 48),
    fadeLayer(3, 'dot', [group('dot', [ellipse(0, 96, 44, 44), fill(WHITE), tr()])]),
  ]),

  // Botanical flourish: stem grows, leaves pop. For hero/loading surfaces.
  sprout: doc('sprout', [
    // soil mound
    fadeLayer(1, 'mound', [group('mound', [ellipse(0, 130, 200, 36), fill(STONE), tr()])], { }),
    // stem: vertical draw
    drawLayer(2, 'stem', [[0, 110], [0, -60]], VERDANT, 26),
    // leaves: ellipses rotated outward, pop after stem
    shapeLayer(3, 'leafL', [
      group('leafL', [ellipse(-40, -40, 120, 54), fill(SPROUT), tr({ r: prop(-30), p: prop([-34, -48]), a: prop([48, 0]) })]),
    ], ident({ s: kf([[30, 0], [52, 112], [62, 100]]) })),
    shapeLayer(4, 'leafR', [
      group('leafR', [ellipse(40, -40, 120, 54), fill(VERDANT), tr({ r: prop(30), p: prop([34, -48]), a: prop([-48, 0]) })]),
    ], ident({ s: kf([[36, 0], [58, 112], [68, 100]]) })),
  ]),
};

for (const dir of [EXT_OUT, REG_OUT, TGS_OUT]) mkdirSync(dir, { recursive: true });
for (const [name, anim] of Object.entries(anims)) {
  const json = JSON.stringify(anim);
  writeFileSync(join(EXT_OUT, `${name}.json`), json);
  writeFileSync(join(REG_OUT, `${name}.json`), json);
  const tgs = gzipSync(json, { level: 9 });
  writeFileSync(join(TGS_OUT, `${name}.tgs`), tgs);
  console.log(`${name}.json ${(json.length / 1024).toFixed(1)}KB  ${name}.tgs ${(tgs.length / 1024).toFixed(1)}KB`);
}
