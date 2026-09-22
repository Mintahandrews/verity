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
// crxjs only emits the loader shim + web-accessible wiring for declared
// content scripts, so the declaration exists at build time but is stripped
// from dist/manifest.json before shipping.
const buildManifest = {
  ...manifest,
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
};

export const CONTENT_SCRIPT_FILE = 'assets/content-loader.js';

function stripContentScripts(): Plugin {
  return {
    name: 'verity:strip-content-scripts',
    closeBundle() {
      const file = join(here, 'dist', 'manifest.json');
      if (!existsSync(file)) return;
      const json = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
      delete json.content_scripts;
      writeFileSync(file, JSON.stringify(json, null, 2));
      // Give the hashed loader a fixed name - executeScript injects it by path.
      const assets = join(here, 'dist', 'assets');
      const loader = readdirSync(assets).find((f) => /-loader-[^/]*\.js$/.test(f));
      if (loader) cpSync(join(assets, loader), join(assets, 'content-loader.js'));
    },
  };
}

export default defineConfig({
  plugins: [crx({ manifest: buildManifest }), copyWasmAssets(), stripContentScripts()],
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
