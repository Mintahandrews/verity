import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crx } from '@crxjs/vite-plugin';
import { defineConfig, type Plugin } from 'vite';
import manifest from './manifest.json';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

// @contentauth/c2pa-web ships its WASM toolkit + worker as static dist files;
// the offscreen document loads them via chrome.runtime.getURL('assets/...').
const c2paDist = join(dirname(require.resolve('@contentauth/c2pa-web/package.json')), 'dist');
const C2PA_ASSETS = [
  join(c2paDist, 'resources', 'c2pa_bg.wasm'),
  join(c2paDist, 'c2pa_worker.js'),
];

// onnxruntime-web WASM - only loaded at runtime if an aiModelUrl is configured.
// (no package.json export - resolve the entrypoint, dist is its dirname)
const ortDist = dirname(require.resolve('onnxruntime-web'));

function copyWasmAssets(): Plugin {
  return {
    name: 'verity:copy-wasm-assets',
    closeBundle() {
      const out = join(here, 'dist', 'assets');
      for (const src of C2PA_ASSETS) {
        if (!existsSync(src)) {
          this.warn(`c2pa asset not found: ${src}`);
          continue;
        }
        cpSync(src, join(out, src.split('/').pop()!));
      }
      if (existsSync(ortDist)) {
        const ortOut = join(out, 'ort');
        for (const f of readdirSync(ortDist)) {
          if (/ort.*\.(wasm|mjs)$/.test(f)) cpSync(join(ortDist, f), join(ortOut, f));
        }
      }
    },
  };
}

// The content script is never registered statically - injection happens
// on-demand via chrome.scripting (activeTab) when the user checks media.
// It is bundled post-build as a self-contained IIFE (esbuild): the crxjs
// loader relies on dynamic import(), which is subject to the HOST PAGE's
// CSP in content scripts (crbug 1053639) - silently dying on strict sites
// like X/Reddit/news. A plain file injection bypasses page CSP entirely.
export const CONTENT_SCRIPT_FILE = 'assets/content-loader.js';

function bundleContentScript(): Plugin {
  return {
    name: 'verity:bundle-content-script',
    async closeBundle() {
      const esbuild = await import('esbuild');
      await esbuild.build({
        entryPoints: [join(here, 'src', 'content', 'index.ts')],
        bundle: true,
        format: 'iife',
        target: 'chrome110',
        outfile: join(here, 'dist', CONTENT_SCRIPT_FILE),
      });
    },
  };
}

export default defineConfig({
  plugins: [crx({ manifest }), copyWasmAssets(), bundleContentScript()],
  build: {
    rollupOptions: {
      input: {
        offscreen: 'src/offscreen/index.html',
        verdict: 'src/verdict/index.html',
      },
      output: {
        // Deterministic names: the content-script loader is injected via
        // chrome.scripting at runtime and must be addressable by fixed path.
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
      },
    },
  },
});
