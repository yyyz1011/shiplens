import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const publicRoot = new URL('../../apps/docs/public/benchmark/', import.meta.url);
const result = JSON.parse(await readFile(new URL('results.json', publicRoot)));
const runner = await readFile(new URL('run.mjs', publicRoot));
assert.equal(createHash('sha256').update(runner).digest('hex'), result.metadata.runnerSha256);
assert.equal(result.metadata.model, null);
assert.equal(result.metadata.tokens, null);
assert.equal(result.metadata.repetitions, 5);
assert.equal(result.trials.length, 30);
assert.equal(result.observations.length, 120);
assert.equal(result.safety.length, 15);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const arm of ['playwright', 'shiplens']) {
  const rows = result.observations.filter((r) => r.arm === arm);
  const runs = result.trials.filter((r) => r.arm === arm);
  const summary = result.summary[arm];
  assert.equal(summary.observations, rows.length);
  assert.equal(summary.defectObservations, rows.filter((r) => r.expectedStatus === 'fail').length);
  assert.equal(summary.cleanObservations, rows.filter((r) => r.expectedStatus === 'pass').length);
  assert.equal(
    summary.detected,
    rows.filter((r) => r.expectedStatus === 'fail' && r.status === 'fail').length,
  );
  assert.equal(
    summary.missed,
    rows.filter((r) => r.expectedStatus === 'fail' && r.status === 'pass').length,
  );
  assert.equal(
    summary.falseAlarms,
    rows.filter((r) => r.expectedStatus === 'pass' && r.status === 'fail').length,
  );
  assert.equal(summary.failedTrials, runs.filter((r) => r.error).length);
  assert.equal(summary.medianCycleMs, median(runs.map((r) => r.cycleMs)));
  assert.equal(summary.minCycleMs, Math.min(...runs.map((r) => r.cycleMs)));
  assert.equal(summary.maxCycleMs, Math.max(...runs.map((r) => r.cycleMs)));
  assert.equal(
    summary.medianAfterMs,
    median(
      runs.flatMap((r) => r.phases.filter((p) => p.phase === 'after').map((p) => p.durationMs)),
    ),
  );
  for (const row of rows) assert.match(row.imageSha256, /^[a-f0-9]{64}$/);
}
for (const probe of result.safety) {
  assert.equal(probe.oldRunEvidence.rejected, true);
  assert.equal(probe.missingMobile.rejected, true);
  assert.equal(probe.completeGate.passed, true);
  assert.equal(probe.deletedArtifactGate.passed, false);
  assert.equal(probe.freshRunStatus, 'pending');
  assert.equal(probe.freshRunGate.passed, false);
  // A semantic claim must not be promoted to evidence of model correctness.
  assert.equal(probe.falseSemanticPassGate.passed, true);
}
assert.doesNotMatch(JSON.stringify(result), /\/Users\/|\/home\/|Bearer /);
console.log(
  'Published benchmark: source checksum, 120 observations, timings and 15 policy trials verified.',
);
