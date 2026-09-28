// Builds release/verity-extension-<v>-firefox.zip: same dist output, but the
// manifest is rewritten for AMO - Firefox needs background.scripts (no
// service_worker), no offscreen permission, and the gecko data-collection
// declaration AMO now requires.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'packages/extension/dist');
const pkg = JSON.parse(readFileSync(join(root, 'packages/extension/package.json'), 'utf8'));

const work = mkdtempSync(join(tmpdir(), 'verity-ff-'));
try {
  cpSync(dist, join(work, 'xpi'), { recursive: true });
  const mp = join(work, 'xpi', 'manifest.json');
  const manifest = JSON.parse(readFileSync(mp, 'utf8'));

  manifest.background = { scripts: ['service-worker-loader.js'], type: 'module' };
  manifest.permissions = manifest.permissions.filter((p) => p !== 'offscreen');
  // Firefox uses optional_permissions (no separate host bucket).
  manifest.optional_permissions = [
    ...(manifest.optional_permissions ?? []),
    ...(manifest.optional_host_permissions ?? []),
  ];
  delete manifest.optional_host_permissions;

  writeFileSync(mp, JSON.stringify(manifest, null, 2) + '\n');

  const out = join(root, 'release', `verity-extension-${pkg.version}-firefox.zip`);
  rmSync(out, { force: true });
  execFileSync('zip', ['-qr', out, '.'], { cwd: join(work, 'xpi') });
  console.log(`packed ${out}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
