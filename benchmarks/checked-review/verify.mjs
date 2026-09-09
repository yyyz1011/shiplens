import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = new URL('../../apps/docs/public/checked-review/', import.meta.url);
const r = JSON.parse(await readFile(new URL('results.json', base)));
assert.equal(
  createHash('sha256')
    .update(await readFile(new URL('run.mjs', base)))
    .digest('hex'),
  r.metadata.runnerSha256,
);
assert.equal(r.metadata.model, null);
assert.equal(r.trials.length, 15);
assert.equal(r.observations.length, 360);
for (const arm of ['playwright', '0.4.1', '0.5.0']) {
  const trials = r.trials.filter((t) => t.arm === arm),
    rows = r.observations.filter((t) => t.arm === arm),
    s = r.summary[arm];
  assert.equal(s.trials, trials.length);
  assert.equal(s.observations, rows.length);
  assert.equal(s.failedTrials, trials.filter((t) => t.error).length);
  assert.equal(s.medianCycleMs, trials.map((t) => t.ms).sort((a, b) => a - b)[2]);
  assert.equal(s.minCycleMs, Math.min(...trials.map((t) => t.ms)));
  assert.equal(s.maxCycleMs, Math.max(...trials.map((t) => t.ms)));
  assert.equal(
    s.missed,
    rows.filter(
      (t) => t.phase === 'before' && t.criterionId === 'criterion-0' && t.status !== 'fail',
    ).length,
  );
  assert.equal(
    s.falseAlarms,
    rows.filter(
      (t) => !(t.phase === 'before' && t.criterionId === 'criterion-0') && t.status !== 'pass',
    ).length,
  );
  for (const row of rows) {
    assert.match(row.imageSha256, /^[a-f0-9]{64}$/);
    if (row.oracleStatus) assert.equal(row.status, row.oracleStatus);
  }
  if (arm !== 'playwright') {
    const calls = arm === '0.4.1' ? 40 : 8,
      receipts = arm === '0.4.1' ? 12 : 2;
    assert.equal(s.reviewApiCallsPerCycle, calls);
    assert.equal(s.callerAssessmentsPerCycle, receipts);
    for (const trial of trials) {
      assert.equal(
        trial.totalApiCalls,
        Object.values(trial.apiCalls).reduce((a, b) => a + b, 0),
      );
      assert.equal(trial.totalApiCalls, calls);
      assert.equal(trial.callerAssessments, receipts);
      assert.equal(trial.gatePassed, true);
    }
    assert.equal(s.falsePassRejections, trials.filter((t) => t.falsePassRejected).length);
    assert.equal(s.falsePassRejections, arm === '0.4.1' ? 0 : 5);
  }
}
assert.doesNotMatch(JSON.stringify(r), /\/Users\/|\/home\/|Bearer /);
console.log(
  'Checked-review benchmark verified: 360 observations, actual statuses, operation counts, timings and false-pass probes.',
);
