import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const results = {};
for (const platform of ['baseline', 'web', 'avp']) {
  const evidence = JSON.parse(readFileSync(`evidence/${platform}.json`));
  // Use emitted chunk names so the nested AVP directory is excluded from Web totals.
  const files = evidence.chunks.map(chunk => {
    const path = `${platform === 'baseline' ? 'baseline/' : ''}${evidence.build.outDir}/${chunk.fileName}`;
    const content = readFileSync(path);
    return { path, raw: content.length, gzip: gzipSync(content, { level: 6 }).length,
      sha256: createHash('sha256').update(content).digest('hex') };
  });
  results[platform] = { files, raw: files.reduce((total, file) => total + file.raw, 0),
    gzip: files.reduce((total, file) => total + file.gzip, 0),
    sdkModules: evidence.chunks.flatMap(chunk => Object.entries(chunk.modules))
      .filter(([id]) => id.includes('/packages/'))
      .map(([id, module]) => ({ id, renderedLength: module.renderedLength })) };
}
results.savings = Object.fromEntries(['raw', 'gzip'].map(metric => [metric, {
  bytes: results.avp[metric] - results.web[metric],
  kib: (results.avp[metric] - results.web[metric]) / 1024,
  percent: (results.avp[metric] - results.web[metric]) / results.avp[metric] * 100,
}]));
results.increments = Object.fromEntries(['web', 'avp'].map(platform => [platform,
  Object.fromEntries(['raw', 'gzip'].map(metric => [metric, {
    bytes: results[platform][metric] - results.baseline[metric],
    kib: (results[platform][metric] - results.baseline[metric]) / 1024,
    percent: (results[platform][metric] - results.baseline[metric]) / results.baseline[metric] * 100,
  }]))]));
results.avpOverWeb = Object.fromEntries(['raw', 'gzip'].map(metric => [metric, {
  bytes: results.avp[metric] - results.web[metric],
  kib: (results.avp[metric] - results.web[metric]) / 1024,
  percent: (results.avp[metric] - results.web[metric]) / results.web[metric] * 100,
}]));
writeFileSync('evidence/sizes.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
