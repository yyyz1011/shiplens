import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = 'apps/docs/public/plan-lock/';
const data = JSON.parse(await readFile(root + 'results.json'));
assert.deepEqual(data.summary, {
  changedStandards: 6,
  nativeSuccessfulCommandsAfterChanges: 6,
  shiplensBlockedBeforeBrowser: 6,
  changedStandardRequests: 0,
  bespokeGuardBlocked: 6,
  unchangedControls: 3,
});
assert.equal(data.cases.length, 9);
assert.equal(data.artifacts.length, 27);
for (const item of data.cases) {
  assert.equal(item.nativeExit, item.id === 'unfixed' ? 1 : 0);
  assert.equal(item.shiplens.blockedBeforeBrowser, item.changedStandard);
  if (item.changedStandard) {
    assert.equal(item.shiplens.requests, 0);
    assert.equal(item.customGuardPassed, false);
  } else assert.equal(item.shiplens.gate.passed, item.id !== 'unfixed');
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const artifact of data.artifacts) {
  assert.match(artifact.file, /^[\w-]+\/[\w.-]+$/);
  assert.equal(hash(await readFile(root + artifact.file)), artifact.sha256, artifact.file);
}
assert.equal(
  hash(await readFile('benchmarks/plan-lock/run.mjs')),
  data.sources['benchmarks/plan-lock/run.mjs'],
);
console.log(
  'Plan lock study: 6 deliberate standard changes, 3 controls, native Playwright and custom guard baselines, 27 artifacts verified.',
);
