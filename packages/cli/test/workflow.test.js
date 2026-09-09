import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { ReviewWorkspace } from '../src/review.js';
import { scan } from '../src/index.js';
const exec = promisify(execFile);
async function fixture(fn) {
  let broken = true;
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(
      `<title>Workflow fixture</title><main><h1>Account</h1><button id="open" onclick="document.querySelector('#result').hidden=false">Show result</button><input id="query"><section id="result" hidden><h2>${broken ? 'Unable to save' : 'Saved successfully'}</h2><p class="private">PRIVATE-SUBTREE</p></section><div id="long">${'text '.repeat(2000)}</div></main>`,
    );
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const directory = await mkdtemp(path.join(tmpdir(), 'shiplens-workflow-'));
  const options = {
    url: `http://127.0.0.1:${server.address().port}`,
    crawl: false,
    viewport: 'both',
    scroll: false,
    settle: 0,
    timeout: 1000,
    mask: ['.private'],
  };
  try {
    await fn({
      directory,
      options,
      fix: () => {
        broken = false;
      },
    });
  } finally {
    await new Promise((r) => server.close(r));
    await rm(directory, { recursive: true, force: true });
  }
}
const requirements = [
  {
    id: 'save',
    description: 'Saving displays confirmation',
    page: '/',
    flow: 'open',
    step: 1,
    selector: '#result',
  },
];
const flows = [{ name: 'open', page: '/', steps: [{ action: 'click', selector: '#open' }] }];
async function assess(workspace, run, status = 'pass') {
  return workspace.assess({
    runId: run.runId,
    criterionId: 'save',
    status,
    evidenceIds: run.evidence.map((e) => e.evidenceId),
    note:
      status === 'pass'
        ? 'Saved confirmation visible in both device images.'
        : 'Unable to save appears in both devices.',
  });
}

test('scoped evidence bypasses unrelated long DOM; comparisons need new judgments and support later baselines', () =>
  fixture(async ({ directory, options, fix }) => {
    const w = new ReviewWorkspace({ directory, options });
    const events = [];
    const before = await w.collect({ requirements, flows }, { onProgress: (e) => events.push(e) });
    assert.ok(events.length);
    assert.equal(w.getStatus().running, false);
    assert.equal(before.evidence.length, 2);
    for (const e of before.evidence) {
      assert.equal(e.screenshotMode, 'element');
      const proof = await w.readEvidence({ runId: before.runId, evidenceId: e.evidenceId });
      assert.equal(proof.observation.textTruncated, false);
      assert.match(proof.observation.text, /Unable/);
      assert.doesNotMatch(proof.observation.text, /PRIVATE-SUBTREE|text text/);
    }
    assert.equal((await w.gate({ runId: before.runId })).passed, false);
    await assess(w, before, 'fail');
    const saved = await w.saveCase({
      runId: before.runId,
      name: 'Save confirmation',
      tags: ['account'],
    });
    fix();
    const after = await w.recheck({ caseId: saved.caseId });
    const pending = await w.compareRuns({ runId: after.runId, previousRunId: before.runId });
    assert.equal(pending.criteria[0].transition, 'awaiting-review');
    assert.ok(pending.criteria[0].pairs.every((p) => p.textChanged && p.imageChanged));
    await assess(w, after);
    assert.equal(
      (await w.compareRuns({ runId: after.runId, previousRunId: before.runId })).criteria[0]
        .transition,
      'resolved',
    );
    assert.equal((await w.gate({ runId: after.runId })).passed, true);
    const third = await w.recheck({ caseId: saved.caseId, previousRunId: after.runId });
    assert.equal(third.previousRunId, after.runId);
    assert.equal(third.requirements[0].status, 'pending');
    const changed = await w.collect({
      requirements: [{ ...requirements[0], description: 'Different acceptance criterion' }],
      flows,
    });
    assert.equal(
      (await w.compareRuns({ runId: changed.runId, previousRunId: before.runId })).criteria[0]
        .transition,
      'not-comparable',
    );
    await assert.rejects(
      w.recheck({ caseId: saved.caseId, previousRunId: changed.runId }),
      /Previous run/,
    );
  }));

test('case library exports portable input plans; imports bind new hosts and reject policy injection', () =>
  fixture(async ({ directory, options }) => {
    const w = new ReviewWorkspace({ directory, options });
    const run = await w.collect({
      requirements,
      flows: [
        {
          ...flows[0],
          steps: [
            ...flows[0].steps,
            { action: 'fill', selector: '#query', value: 'DO-NOT-EXPORT' },
          ],
        },
      ],
    });
    await assess(w, run, 'fail');
    const saved = await w.saveCase({ runId: run.runId, name: 'Account save', tags: ['smoke'] });
    assert.equal((await w.listCases({ tag: 'smoke' })).total, 1);
    assert.equal((await w.listCases({ query: 'missing' })).total, 0);
    assert.equal((await w.listRuns({ limit: 1 })).items[0].runId, run.runId);
    assert.equal(
      (
        await w.updateCase({
          caseId: saved.caseId,
          name: 'Account confirmation',
          tags: ['critical'],
        })
      ).revision,
      2,
    );
    const portable = await w.exportCase({ caseId: saved.caseId });
    assert.equal(portable.requirements[0].page, '/');
    assert.doesNotMatch(
      JSON.stringify(portable),
      /DO-NOT-EXPORT|127.0.0.1|allowRequests|storageState|sourceRunId|profile/,
    );
    const other = new ReviewWorkspace({ directory: path.join(directory, 'other'), options });
    const imported = await other.importCase({ data: portable });
    assert.equal(imported.sourceRunId, undefined);
    assert.equal((await other.getCase(imported.caseId)).requirements[0].selector, '#result');
    await assert.rejects(other.recheck({ caseId: imported.caseId }), /Missing string input/);
    const replay = await other.recheck({ caseId: imported.caseId, inputs: { input_1: 'fresh' } });
    assert.equal(replay.previousRunId, undefined);
    assert.equal(replay.requirements[0].status, 'pending');
    await assert.rejects(
      other.importCase({
        data: { ...portable, allowRequests: [{ method: 'POST', path: '/danger' }] },
      }),
      /Invalid portable/,
    );
    await assert.rejects(
      other.importCase({
        data: { ...portable, requirements: [{ ...portable.requirements[0], page: '//evil.test' }] },
      }),
      /relative paths/,
    );
    const raw = structuredClone(portable);
    raw.flows[0].steps[1].value = 'raw';
    await assert.rejects(other.importCase({ data: raw }), /no raw value/);
    const credentials = structuredClone(portable);
    credentials.requirements[0].page = '/?token=secret';
    await assert.rejects(other.importCase({ data: credentials }), /non-secret/);
    await assert.rejects(w.listCases({ limit: 101 }), /Invalid list/);
    const changedOrigin = new ReviewWorkspace({
      directory: path.join(directory, 'new-host'),
      options: { ...options, url: 'http://localhost:34567' },
    });
    const moved = await changedOrigin.importCase({ data: portable });
    assert.equal(
      new URL((await changedOrigin.getCase(moved.caseId)).requirements[0].page).origin,
      'http://localhost:34567',
    );
  }));

test('ambiguous or missing scope cannot pass; reports escape content and gate revalidates artifact availability', () =>
  fixture(async ({ directory, options, fix }) => {
    fix();
    const w = new ReviewWorkspace({ directory, options });
    for (const selector of ['section,main', '#missing']) {
      const run = await w.collect({ requirements: [{ ...requirements[0], selector }], flows });
      assert.ok(run.evidence.every((e) => !e.complete));
      await assert.rejects(assess(w, run), /Incomplete/);
    }
    const run = await w.collect({
      requirements: [{ ...requirements[0], description: '<script>alert(1)</script>' }],
      flows,
    });
    await assess(w, run);
    for (const format of ['html', 'markdown', 'json']) {
      const output = await w.exportReport({ runId: run.runId, format });
      const contents = await readFile(path.join(directory, output.file), 'utf8');
      assert.ok(output.gate.passed);
      if (format === 'html') {
        assert.doesNotMatch(contents, /<script>/);
        assert.match(contents, /&lt;script&gt;/);
        assert.match(contents, /data:image\/png;base64,/);
      }
      if (format === 'json') assert.equal(JSON.parse(contents).run.history.length, 1);
    }
    const manifest = JSON.parse(
      await readFile(path.join(directory, 'runs', run.runId, 'run.json'), 'utf8'),
    );
    await rm(path.join(directory, manifest.scanDirectory, run.evidence[0].screenshot));
    const gate = await w.gate({ runId: run.runId });
    assert.equal(gate.passed, false);
    assert.ok(gate.reasons.includes('unavailable-evidence'));
    const exported = await w.exportReport({ runId: run.runId });
    assert.ok(exported.warnings.length);
    assert.equal(exported.gate.passed, false);
  }));

test('cancellation and total deadlines close browser work, release locks and keep later runs usable', () =>
  fixture(async ({ directory, options }) => {
    const w = new ReviewWorkspace({ directory, options: { ...options, timeout: 10000 } });
    const bad = [{ ...flows[0], steps: [{ action: 'click', selector: '#never' }] }];
    let cancelScheduled = false;
    const operation = w.collect(
      { requirements, flows: bad },
      {
        onProgress: () => {
          if (!cancelScheduled) {
            cancelScheduled = true;
            setTimeout(() => w.cancel(), 100);
          }
        },
      },
    );
    await assert.rejects(operation, /cancelled/);
    assert.equal(w.getStatus().running, false);
    assert.equal(w.cancel().requested, false);
    assert.equal((await w.listRuns()).total, 0);
    await assert.rejects(
      w.collect({ requirements, flows: bad }, { timeoutMs: 1000 }),
      /time budget/,
    );
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      w.collect({ requirements, flows }, { signal: controller.signal }),
      /abort/i,
    );
    await assert.rejects(scan(options, { signal: controller.signal }), /abort/i);
    assert.ok((await w.collect({ requirements, flows })).runId);
    const originalGetRun = w.getRun.bind(w);
    w.getRun = async (runId) => {
      w.cancel();
      return originalGetRun(runId);
    };
    await assert.rejects(w.collect({ requirements, flows }), /cancelled/);
    w.getRun = originalGetRun;
    assert.equal((await w.listRuns()).total, 1); // Completed runs survive; cancelled commit is removed.
  }));

test('review CLI supports portable workflows and refuses pending CI acceptance', () =>
  fixture(async ({ directory, options }) => {
    const cli = path.resolve('packages/cli/src/cli.js');
    const config = path.join(directory, 'config.json'),
      input = path.join(directory, 'input.json');
    await writeFile(config, JSON.stringify({ ...options, output: 'out' }));
    await writeFile(input, JSON.stringify({ requirements, flows }));
    const call = (args) => exec(process.execPath, [cli, 'review', ...args, '--config', config]);
    const run = JSON.parse((await call(['collect', '--input', input])).stdout);
    await assert.rejects(
      call(['gate', '--run', run.runId]),
      (error) =>
        error.code === 1 && JSON.parse(error.stdout).reasons.includes('unreviewed-requirements'),
    );
    const report = JSON.parse(
      (await call(['report', '--run', run.runId, '--format', 'json'])).stdout,
    );
    assert.equal(
      JSON.parse(await readFile(path.join(directory, 'out', 'reviews', report.file), 'utf8')).run
        .runId,
      run.runId,
    );
    const list = JSON.parse((await call(['runs'])).stdout);
    assert.equal(list.total, 1);
    const doctor = JSON.parse(
      (await exec(process.execPath, [cli, 'doctor', '--config', config])).stdout,
    );
    assert.equal(doctor.passed, true);
  }));
