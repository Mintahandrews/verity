// Cross-platform parameterized entrypoint - replaces
// `node packages/$VERITY_PKG/src/$VERITY_ENTRY` which only expands on POSIX
// shells. Railway sets VERITY_PKG + VERITY_ENTRY per service; Windows
// dev machines work too.
import { spawn } from 'node:child_process';

const pkg = process.env.VERITY_PKG;
const entry = process.env.VERITY_ENTRY;
if (!pkg || !entry) {
  console.error('Set VERITY_PKG (e.g. registry|bot) and VERITY_ENTRY (e.g. server.ts|bot.ts)');
  process.exit(1);
}

const child = spawn(process.execPath, [`packages/${pkg}/src/${entry}`], {
  stdio: 'inherit',
});
// Forward shutdown signals (Railway SIGTERM) so the child exits cleanly.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, () => child.kill(sig));
}
child.on('exit', (code, sig) => {
  if (sig) process.kill(process.pid, sig);
  else process.exit(code ?? 1);
});
