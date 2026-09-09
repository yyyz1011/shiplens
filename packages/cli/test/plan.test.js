import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ReviewWorkspace } from '../src/review.js';
const exec = promisify(execFile);
const plan = {
  schemaVersion: 1,
  kind: 'shiplens-case',
  name: 'Checkout release',
  tags: ['release'],
  flows: [],
  requirements: [
    {
      id: 'price',
      description: 'Price is $19',
      page: '/',
      selector: '#price',
      checks: [{ operator: 'equals', value: '$19' }],
      evaluation: 'checks',
    },
  ],
};
async function fixture(fn) {
  let fixed = false,
    machineError = false,
    requests = 0;
  const server = http.createServer((_req, res) => {
    requests++;
    res.setHeader('content-type', 'text/html');
    res.end(
      `<html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Checkout</title><h1>Checkout</h1><p id="price">${fixed ? '$19' : '$29'}</p><input id="query" aria-label="Query" oninput="document.querySelector('#echo').textContent=this.value"><p id="echo"></p>${machineError ? '<script>console.error("Broken checkout service")</script>' : ''}</html>`,
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const root = await mkdtemp(path.join(tmpdir(), 'shiplens-plan-'));
  const directory = path.join(root, 'reviews');
  const options = {
    url: `http://127.0.0.1:${server.address().port}`,
    viewport: 'both',
    crawl: false,
    scroll: false,
    settle: 0,
  };
  try {
    await fn({
      root,
      directory,
      options,
      w: new ReviewWorkspace({ directory, options }),
      requests: () => requests,
      fix: () => {
        fixed = true;
      },
      breakMachine: () => {
        machineError = true;
      },
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
}

test('portable plan preflight validates host scope and required inputs without artifacts or website access', () =>
  fixture(async ({ w, directory, requests }) => {
    const info = w.validatePlan({ data: plan });
    assert.deepEqual(info.automaticRequirements, ['price']);
    assert.deepEqual(info.manualRequirements, []);
    assert.equal(info.sha256.length, 64);
    assert.equal(
      info.sha256,
      w.validatePlan({ data: Object.fromEntries(Object.entries(plan).reverse()) }).sha256,
    );
    for (const data of [
      { ...plan, requirements: [{ ...plan.requirements[0], page: '//external.test/' }] },
      { ...plan, requirements: [{ ...plan.requirements[0], page: '/?token=secret' }] },
      { ...plan, requirements: [{ ...plan.requirements[0], checks: undefined }] },
      {
        ...plan,
        flows: [
          {
            name: 'fill',
            page: '/',
            steps: [{ action: 'fill', selector: '#query', value: 'raw' }],
          },
        ],
      },
      { ...plan, unexpected: true },
    ])
      assert.throws(() => w.validatePlan({ data }));
    const parameterized = {
      ...plan,
      flows: [
        {
          name: 'fill',
          page: '/',
          steps: [{ action: 'fill', selector: '#query', valueFromInput: 'query' }],
        },
      ],
    };
    assert.equal(w.validatePlan({ data: parameterized }).requiredInputs[0].key, 'query');
    await assert.rejects(w.verify({ data: parameterized }), /Missing string input/);
    await assert.rejects(
      w.verify({ data: plan, inputs: { unexpected: 'private' } }),
      /required named inputs/,
    );
    await assert.rejects(w.verify({ data: plan, failOn: 'none' }), /threshold/);
    await assert.rejects(stat(directory), { code: 'ENOENT' });
    assert.equal(requests(), 0);
  }));

test('one-command verification writes fresh evidence and a report without saved-case accumulation; manual and machine failures stay blocked', () =>
  fixture(async ({ w, directory, fix, breakMachine }) => {
    const before = await w.verify({ data: plan });
    assert.equal(before.gate.passed, false);
    assert.equal(before.unresolved[0].status, 'fail');
    assert.deepEqual(before.next, { method: 'reviewPacket', input: { runId: before.runId } });
    assert.match(await readFile(path.join(directory, before.report.file), 'utf8'), /Checkout/);
    fix();
    const after = await w.verify({ data: plan, format: 'json' });
    assert.equal(after.gate.passed, true);
    assert.equal(after.next, null);
    assert.notEqual(after.runId, before.runId);
    assert.equal((await w.listCases()).total, 0);
    const run = await w.getRun(after.runId);
    assert.equal(run.planSource.sha256, after.plan.sha256);
    assert.equal(run.history.length, 0);
    assert.equal(
      JSON.parse(await readFile(path.join(directory, after.report.file), 'utf8')).gate.passed,
      true,
    );
    assert.equal(
      (await w.compareRuns({ runId: after.runId, previousRunId: before.runId })).criteria[0]
        .transition,
      'resolved',
    );
    const manual = await w.verify({
      data: { ...plan, requirements: [{ ...plan.requirements[0], evaluation: 'manual' }] },
      format: 'markdown',
    });
    assert.equal(manual.gate.passed, false);
    assert.equal(manual.unresolved[0].status, 'pending');
    const packet = await w.reviewPacket(manual.next.input);
    await w.assess({
      runId: manual.runId,
      criterionId: 'price',
      status: 'pass',
      evidenceIds: packet.items.map((i) => i.evidence.evidenceId),
      note: 'Reviewed fresh evidence on both devices.',
    });
    assert.equal((await w.gate({ runId: manual.runId })).passed, true);
    breakMachine();
    const broken = await w.verify({ data: plan, failOn: 'warning' });
    assert.equal(broken.unresolved.length, 0);
    assert.equal(broken.gate.passed, false);
    assert.ok(broken.gate.reasons.length);
  }));

test('verify resolves explicit runtime inputs and recovers from cancellation without inheriting a pass', () =>
  fixture(async ({ w, fix }) => {
    const data = {
      ...plan,
      flows: [
        {
          name: 'fill',
          page: '/',
          steps: [{ action: 'fill', selector: '#query', valueFromInput: 'query' }],
        },
      ],
      requirements: [
        {
          id: 'echo',
          description: 'Echo test input',
          page: '/',
          flow: 'fill',
          step: 1,
          selector: '#echo',
          checks: [{ operator: 'equals', value: 'Sample' }],
          evaluation: 'checks',
        },
      ],
    };
    const result = await w.verify({ data, inputs: { query: 'Sample' }, format: 'json' });
    assert.equal(result.gate.passed, true);
    const controller = new AbortController();
    controller.abort(new Error('Cancelled before execution'));
    await assert.rejects(w.verify({ data: plan }, { signal: controller.signal }), /Cancelled/);
    assert.equal(w.getStatus().running, false);
    fix();
    assert.equal((await w.verify({ data: plan })).gate.passed, true);
  }));

test('portable verification CLI uses stable input files and exit codes 0, 1, 2 without run-ID plumbing', () =>
  fixture(async ({ root, options, fix }) => {
    const cli = path.resolve('packages/cli/src/cli.js');
    await writeFile(
      path.join(root, 'config.json'),
      JSON.stringify({ ...options, output: 'output' }),
    );
    await writeFile(path.join(root, 'acceptance.json'), JSON.stringify(plan));
    const args = [
      'review',
      'verify',
      '--config',
      'config.json',
      '--plan',
      'acceptance.json',
      '--format',
      'json',
    ];
    let failed;
    try {
      await exec(process.execPath, [cli, ...args], { cwd: root });
    } catch (error) {
      failed = error;
    }
    assert.equal(failed.code, 1);
    assert.equal(JSON.parse(failed.stdout).gate.passed, false);
    fix();
    const passed = JSON.parse((await exec(process.execPath, [cli, ...args], { cwd: root })).stdout);
    assert.equal(passed.gate.passed, true);
    const info = JSON.parse(
      (
        await exec(
          process.execPath,
          [cli, 'review', 'plan', '--config', 'config.json', '--plan', 'acceptance.json'],
          { cwd: root },
        )
      ).stdout,
    );
    assert.equal(info.sha256, passed.plan.sha256);
    await writeFile(
      path.join(root, 'invalid.json'),
      JSON.stringify({ unexpected: 'DO_NOT_ECHO_INPUT' }),
    );
    await assert.rejects(
      exec(process.execPath, [cli, ...args, '--input', 'invalid.json'], { cwd: root }),
      (error) => error.code === 2 && !error.stderr.includes('DO_NOT_ECHO_INPUT'),
    );
    await assert.rejects(
      exec(process.execPath, [cli, 'review', 'verify', '--config', 'config.json'], { cwd: root }),
      (error) => error.code === 2 && error.stderr.includes('--plan'),
    );
  }));
