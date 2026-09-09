import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = 'apps/docs/public/check-audit/';
const result = JSON.parse(await readFile(root + 'results.json'));
assert.deepEqual(result.summary, {
  uniqueKnownWrongStates: 3,
  viewportObservationsPerState: 2,
  weakKnownWrongPassed: 6,
  strongKnownWrongPassed: 0,
  offlineExtraRequests: 0,
});
assert.equal(result.playwright.length, 12);
assert.equal(result.playwright.filter((r) => r.state === 'known-wrong' && r.weakPassed).length, 6);
assert.equal(
  result.playwright.filter((r) => r.state === 'known-wrong' && r.strongPassed).length,
  0,
);
for (const [key, status] of [
  ['weakAudit', 'survived'],
  ['strongAudit', 'caught'],
]) {
  assert.equal(result[key].items.length, 3);
  for (const item of result[key].items) {
    assert.equal(item.samples.length, 2);
    for (const sample of item.samples) {
      assert.equal(sample.probes.find((p) => p.kind === 'custom').result, status);
      assert.equal(sample.probes.find((p) => p.kind === 'number-change').result, status);
    }
  }
}
assert.equal(result.artifacts.length, 48);
assert.equal(new Set(result.artifacts.map((a) => a.file)).size, 48);
for (const artifact of result.artifacts) {
  assert.match(artifact.file, /^evidence\/[\w-]+\.(png|json)$/);
  assert.equal(
    createHash('sha256')
      .update(await readFile(root + artifact.file))
      .digest('hex'),
    artifact.sha256,
  );
}
// The pinned runner is part of this reproducible case study; historical package hashes are identifiers.
assert.equal(
  createHash('sha256')
    .update(await readFile('benchmarks/check-audit/run.mjs'))
    .digest('hex'),
  result.sourceHashes['benchmarks/check-audit/run.mjs'],
);
console.log(
  'Check audit case study: independent predicate baseline, 12 custom probe outcomes and 48 evidence artifacts verified.',
);
