import { cpSync, existsSync } from 'node:fs';
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

function copyC2paAssets(): Plugin {
  return {
    name: 'verity:copy-c2pa-assets',
    closeBundle() {
      for (const src of C2PA_ASSETS) {
        if (!existsSync(src)) {
          this.warn(`c2pa asset not found: ${src}`);
          continue;
        }
        cpSync(src, join(here, 'dist', 'assets', src.split('/').pop()!));
      }
    },
  };
}

export default defineConfig({
  plugins: [crx({ manifest }), copyC2paAssets()],
  build: {
    rollupOptions: {
      input: {
        offscreen: 'src/offscreen/index.html',
        verdict: 'src/verdict/index.html',
      },
    },
  },
});
