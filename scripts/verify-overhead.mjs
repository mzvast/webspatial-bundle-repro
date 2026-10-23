import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const sizes = JSON.parse(readFileSync('evidence/sizes.json'));
const plain = readFileSync(sizes.baseline.files[0].path, 'utf8');
const web = readFileSync(sizes.web.files[0].path, 'utf8');
// The pinned SDK's only surviving Web runtime code is its metadata banner.
const start = web.indexOf(';(function(){typeof window>"u"');
assert(start >= 0, 'Expected SDK metadata banner is missing');
const marker = '})();var ';
const end = web.indexOf(marker, start);
assert(end > start, 'SDK metadata banner ending is missing');
const removed = web.slice(start, end + marker.length);
const normalized = web.slice(0, start) + ',' + web.slice(end + marker.length);
assert(normalized.replace(/sourceMappingURL=[^\n]*/, 'sourceMappingURL=normalized') === plain.replace(/sourceMappingURL=[^\n]*/, 'sourceMappingURL=normalized'), 'Web contains differences beyond metadata and the map filename');
const proof = { equivalentAfterRemovingMetadata: true, addedRawBytes: Buffer.byteLength(removed) - 1, removed, replacement: ',', note: 'sourceMappingURL filenames normalized; equal-length filenames do not affect raw delta' };
assert.equal(proof.addedRawBytes, sizes.increments.web.raw.bytes);
writeFileSync('evidence/web-overhead.json', JSON.stringify(proof, null, 2));
console.log(`PASS: Web raw increment is exactly ${proof.addedRawBytes} bytes of SDK metadata initialization and declaration joining`);
