import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Repository root, resolved independently of the shell working directory. */
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
assert(Number(process.versions.node.split('.')[0]) >= 22, 'Node.js 22 or later is required');
assert.equal(execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim(), '9.0.0', 'Use pnpm 9.0.0');
mkdirSync('evidence', { recursive: true });
const environment = { ...process.env };
delete environment.XR_ENV;
// Public registry selection applies to both the Demo and the nested SDK workspace.
environment.npm_config_registry = 'https://registry.npmjs.org/';
execFileSync(process.execPath, ['scripts/prepare-sdk.mjs'], { stdio: 'inherit', env: environment });
execFileSync('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], { stdio: 'inherit', env: environment });
execFileSync('pnpm', ['--dir', 'baseline', 'install', '--frozen-lockfile', '--ignore-scripts'], { stdio: 'inherit', env: environment });
for (const platform of ['baseline', 'web', 'avp']) {
  const result = spawnSync('pnpm', ['run', `build:${platform}`], { encoding: 'utf8', env: environment });
  const log = (result.stdout ?? '') + (result.stderr ?? '');
  writeFileSync(`evidence/build-${platform}.log`, log);
  process.stdout.write(log);
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${platform} production build failed`);
}
execFileSync(process.execPath, ['verify.mjs'], { stdio: 'inherit', env: environment });
execFileSync(process.execPath, ['measure.mjs'], { stdio: 'inherit', env: environment });
execFileSync(process.execPath, ['scripts/verify-overhead.mjs'], { stdio: 'inherit', env: environment });
writeFileSync('evidence/environment.json', JSON.stringify({ node: process.version, pnpm: '9.0.0', zlib: process.versions.zlib, platform: process.platform, arch: process.arch, sdkCommit: execFileSync('git', ['-C', '.cache/sdk', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() }, null, 2));
console.log('Reproduction passed. Inspect evidence/sizes.json and evidence/web-overhead.json.');
