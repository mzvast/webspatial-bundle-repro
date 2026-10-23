import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

/** Exact upstream source revision used for this experiment. */
const commit = '0d6989338ce0d81298e37dec0cceeae655b81194';
/** Isolated SDK checkout; source and build outputs are excluded from this repository. */
const checkout = fileURLToPath(new URL('../.cache/sdk', import.meta.url));
mkdirSync(checkout, { recursive: true });
if (!existsSync(`${checkout}/.git`)) {
  execFileSync('git', ['init', checkout], { stdio: 'inherit' });
  execFileSync('git', ['-C', checkout, 'remote', 'add', 'origin', 'https://github.com/webspatial/webspatial-sdk.git'], { stdio: 'inherit' });
}
try {
  execFileSync('git', ['-C', checkout, 'cat-file', '-e', `${commit}^{commit}`], { stdio: 'ignore' });
} catch {
  execFileSync('git', ['-C', checkout, 'fetch', '--depth=1', 'origin', commit], { stdio: 'inherit' });
}
// Preserve any local source edits by stopping before switching or building a modified checkout.
assert.equal(execFileSync('git', ['-C', checkout, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim(), '', 'SDK checkout contains tracked edits');
execFileSync('git', ['-C', checkout, 'checkout', '--detach', commit], { stdio: 'inherit' });
assert.equal(execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), commit);
execFileSync('pnpm', ['install', '--filter', '@webspatial/core-sdk', '--filter', '@webspatial/react-sdk', '--frozen-lockfile', '--ignore-scripts', '--registry=https://registry.npmjs.org'], { cwd: checkout, stdio: 'inherit' });
execFileSync('pnpm', ['--filter', '@webspatial/core-sdk', '--filter', '@webspatial/react-sdk', 'run', 'build'], { cwd: checkout, stdio: 'inherit' });
console.log(`SDK ready: ${commit}`);
