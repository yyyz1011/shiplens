import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root = 'apps/docs/public/delivery-proof/';
const result = JSON.parse(await readFile(root + 'results.json'));
assert.deepEqual(result.summary, {
  healthyViewportCases: 2,
  defectiveViewportCases: 8,
  uiOnlyFalsePasses: 8,
  playwrightFullFalsePasses: 0,
  shiplensFalsePasses: 0,
});
assert.equal(result.cases.length, 5);
for (const item of result.cases) {
  assert.equal(item.shiplens.passed, item.mode === 'healthy');
  assert.equal(item.playwright.length, 2);
  for (const row of item.playwright) {
    assert.equal(row.uiOnlyPassed, true);
    assert.equal(row.fullContractPassed, item.mode === 'healthy');
  }
  assert.equal(item.shiplens.trials.length, 4);
}
assert.equal(result.artifacts.length, 33);
for (const file of result.artifacts) {
  assert.match(file.file, /^[\w-]+\/[\w.-]+$/);
  assert.equal(
    createHash('sha256')
      .update(await readFile(root + file.file))
      .digest('hex'),
    file.sha256,
  );
}
assert.equal(
  createHash('sha256')
    .update(await readFile('benchmarks/delivery-proof/run.mjs'))
    .digest('hex'),
  result.sources['benchmarks/delivery-proof/run.mjs'],
);
console.log(
  'Delivery proof case study: 8 injected defect cases, healthy controls, independent complete baseline and 33 artifacts verified.',
);
