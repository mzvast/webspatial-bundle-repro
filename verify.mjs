import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// Verify the identical minimal business entry before inspecting actual build evidence.
assert(existsSync(new URL('./src/main.tsx', import.meta.url)), 'minimal Demo is missing');
const source = readFileSync(new URL('./src/main.tsx', import.meta.url), 'utf8');
assert(source.includes('<div enable-xr>Hello</div>'));
const builds = {};
for (const platform of ['web', 'avp']) {
  const evidence = JSON.parse(readFileSync(new URL(`./evidence/${platform}.json`, import.meta.url)));
  builds[platform] = evidence;
  assert.equal(evidence.mode, 'production');
  const ids = evidence.modules.map(module => module.id);
  const expected = platform === 'web' ? 'jsx-runtime.web.js' : 'jsx-runtime.js';
  assert(ids.some(id => id.endsWith(`/dist/jsx/${expected}`)), `${platform} runtime missing`);
  assert(evidence.resolvedEntries['@webspatial/react-sdk'].endsWith(`/dist/${platform === 'web' ? 'web' : 'default'}/index.js`));
  assert.equal(ids.some(id => id.endsWith('/packages/core/dist/index.js')), platform === 'avp');
  assert.equal(ids.some(id => id.endsWith('/packages/react/dist/default/index.js')), platform === 'avp');
  assert(evidence.chunks.length > 0);
}
assert.deepEqual(builds.web.inputs, builds.avp.inputs);
const { outDir: webOut, emptyOutDir: webEmpty, ...webBuild } = builds.web.build;
const { outDir: avpOut, emptyOutDir: avpEmpty, ...avpBuild } = builds.avp.build;
assert.deepEqual(webBuild, avpBuild);

// Require the SDK-free baseline evidence before accepting the three-way comparison.
assert(existsSync(new URL('./evidence/baseline.json', import.meta.url)), 'plain React baseline is missing');

const baseline = JSON.parse(readFileSync(new URL('./evidence/baseline.json', import.meta.url)));
assert.equal(baseline.mode, 'production');
assert.equal(baseline.inputs['src/main.tsx'], builds.web.inputs['src/main.tsx']);
assert(baseline.modules.some(module => module.id.endsWith('/react/jsx-runtime.js')));
assert(baseline.modules.every(module => !module.id.includes('@webspatial') && !module.id.includes('/packages/')));
const baselinePackage = JSON.parse(readFileSync(new URL('./baseline/package.json', import.meta.url)));
assert(Object.keys({ ...baselinePackage.dependencies, ...baselinePackage.devDependencies }).every(name => !name.startsWith('@webspatial/')));
const { outDir: baselineOut, emptyOutDir: baselineEmpty, ...baselineBuild } = baseline.build;
assert.deepEqual(baselineBuild, webBuild);
// Compare every installed package version, including transitive build tools.
const sdkDependencies = readdirSync(new URL('./node_modules/.pnpm', import.meta.url));
const plainDependencies = readdirSync(new URL('./baseline/node_modules/.pnpm', import.meta.url));
assert(plainDependencies.every(name => sdkDependencies.includes(name)));
assert(plainDependencies.every(name => !name.startsWith('@webspatial+')));
console.log('PASS: three production builds, identical business source/build options/dependency versions, platform runtimes, SDK-free baseline');
