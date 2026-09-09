import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ReviewWorkspace } from '../src/review.js';
import { textProbes, auditRequirement } from '../src/check-audit.js';
const exec = promisify(execFile);
const requirement = {
  id: 'price',
  description: 'Price is ¥129',
  page: '/',
  selector: '#price',
  evaluation: 'checks',
  checks: [{ operator: 'contains', value: '¥' }],
};

async function fixture(fn) {
  let requests = 0;
  const server = http.createServer((_req, res) => {
    requests++;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      '<html lang="en"><title>Audit</title><meta name="viewport" content="width=device-width,initial-scale=1"><h1>Checkout</h1><p id="price">¥129<span class="private">SECRET</span></p><p id="long">' +
        '123 '.repeat(2500) +
        '</p></html>',
    );
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const root = await mkdtemp(path.join(tmpdir(), 'shiplens-audit-'));
  const config = {
    url: `http://127.0.0.1:${server.address().port}`,
    viewport: 'both',
    crawl: false,
    scroll: false,
    settle: 0,
    mask: ['.private'],
    output: root,
  };
  const directory = path.join(root, 'reviews');
  const workspace = new ReviewWorkspace({ directory, options: config });
  try {
    await fn({
      workspace,
      directory,
      root,
      config,
      requests: () => requests,
      stop: () =>
        new Promise((r) => {
          server.closeAllConnections();
          server.close(r);
        }),
    });
  } finally {
    server.closeAllConnections();
    server.close();
    await rm(root, { recursive: true, force: true });
  }
}

test('passing weak checks expose numeric blind spots offline; strong checks reject them without changing acceptance', () =>
  fixture(async ({ workspace: w, directory, stop, requests }) => {
    const weak = await w.collect({ requirements: [requirement] });
    const strong = await w.collect({
      requirements: [{ ...requirement, checks: [{ operator: 'equals', value: '¥129' }] }],
    });
    const manifest = JSON.parse(
      await readFile(path.join(directory, 'runs', weak.runId, 'run.json')),
    );
    const observationPath = path.join(
      directory,
      manifest.scanDirectory,
      weak.evidence[0].observation,
    );
    const original = await readFile(observationPath);
    const names = await readdir(directory, { recursive: true });
    const count = requests();
    await stop(); // The server no longer exists. Audit must use saved proof only.
    const audit = await w.auditChecks({
      runId: weak.runId,
      counterexamples: [{ criterionId: 'price', label: 'Known wrong price', text: '¥999' }],
    });
    assert.equal(audit.items[0].status, 'audited');
    assert.equal(audit.items[0].samples.length, 2);
    for (const sample of audit.items[0].samples) {
      assert.equal(sample.observedText, '¥129');
      assert.match(sample.sourceSha256, /^[a-f0-9]{64}$/);
      assert.equal(sample.probes.find((p) => p.kind === 'number-change').text, '¥230');
      assert.equal(sample.probes.find((p) => p.kind === 'number-change').result, 'survived');
      assert.equal(sample.probes.find((p) => p.kind === 'custom').result, 'survived');
      assert.equal(sample.probes.find((p) => p.kind === 'empty').result, 'caught');
    }
    const robust = await w.auditChecks({ runId: strong.runId });
    assert.equal(robust.pageSummary.survived, 0);
    assert.equal(robust.pageSummary.caught, 8);
    assert.equal(requests(), count);
    assert.deepEqual(await readFile(observationPath), original);
    assert.deepEqual(await readdir(directory, { recursive: true }), names);
    assert.equal((await w.gate({ runId: weak.runId })).passed, true);
    assert.equal((await w.getRun(weak.runId)).history.length, 0);
    assert.doesNotMatch(JSON.stringify(audit), /SECRET/);
    assert.equal(audit.bytes, Buffer.byteLength(JSON.stringify(audit)));
  }));

test('audit skips manual-only, failing, incomplete and truncated evidence; CLI paginates and rejects invalid input', () =>
  fixture(async ({ workspace: w, directory, root, config }) => {
    const run = await w.collect({
      requirements: [
        requirement,
        { ...requirement, id: 'manual', checks: undefined, evaluation: 'manual' },
        { ...requirement, id: 'failing', checks: [{ operator: 'equals', value: '¥999' }] },
        { ...requirement, id: 'missing', selector: '#absent' },
        {
          ...requirement,
          id: 'truncated',
          selector: '#long',
          checks: [{ operator: 'contains', value: '123' }],
        },
      ],
    });
    const audit = await w.auditChecks({ runId: run.runId });
    assert.deepEqual(
      audit.items.map((i) => i.status),
      ['audited', 'no-checks', 'baseline-failing', 'needs-evidence', 'needs-evidence'],
    );
    const first = await w.auditChecks({ runId: run.runId, limit: 2 });
    assert.equal(first.nextOffset, 2);
    const second = await w.auditChecks({ runId: run.runId, offset: first.nextOffset, limit: 5 });
    assert.equal(second.nextOffset, null);
    assert.equal(second.items[0].criterionId, 'failing');
    const configFile = path.join(root, 'config.json');
    await writeFile(configFile, JSON.stringify(config));
    const cli = path.resolve('packages/cli/src/cli.js');
    const output = await exec(process.execPath, [
      cli,
      'review',
      'audit',
      '--config',
      configFile,
      '--run',
      run.runId,
    ]);
    assert.deepEqual(JSON.parse(output.stdout), audit);
    for (const input of [
      { limit: 0 },
      { maxBytes: 1 },
      { criterionIds: ['unknown'] },
      { criterionIds: ['price', 'price'] },
      { counterexamples: [{ criterionId: 'bad', label: 'bad', text: 'bad' }] },
      { counterexamples: [{ criterionId: 'price', label: 'bad', text: 'x'.repeat(8001) }] },
      { extra: true },
    ])
      await assert.rejects(w.auditChecks({ runId: run.runId, ...input }));
    const manifest = JSON.parse(
      await readFile(path.join(directory, 'runs', run.runId, 'run.json')),
    );
    await rm(path.join(directory, manifest.scanDirectory, run.evidence[0].screenshot));
    assert.equal(
      (await w.auditChecks({ runId: run.runId, criterionIds: ['price'] })).items[0].status,
      'needs-evidence',
    );
  }));

test('numeric coverage is bounded, unchanged probes explicit and custom samples share actual predicate semantics', async () => {
  const p = textProbes('  0  1  2  3  4  5  6  7   ');
  assert.equal(p.numericCandidates, 8);
  assert.equal(p.numericTested, 6);
  assert.equal(p.probes.length, 9);
  const evidence = [
    { evidenceId: 'e', criterionIds: ['price'], viewport: 'desktop', complete: true },
  ];
  const audit = await auditRequirement(
    { ...requirement, viewports: ['desktop'], checks: [{ operator: 'excludes', value: 'failed' }] },
    evidence,
    async () => ({
      image: {},
      observation: { text: 'Loading…', textTruncated: false, elementsTruncated: false },
    }),
    [{ criterionId: 'price', label: 'Failed state', text: '  failed\n ' }],
  );
  assert.equal(audit.samples[0].probes.find((p) => p.kind === 'loading').result, 'unchanged');
  assert.equal(audit.samples[0].probes.find((p) => p.kind === 'empty').result, 'survived');
  assert.deepEqual(
    audit.samples[0].probes.find((p) => p.kind === 'custom').failedCheckIndexes,
    [0],
  );
});

test('audit byte budgets never silently omit a counterexample or report skipped pages as audited', async () => {
  const { auditRun } = await import('../src/check-audit.js');
  const requirements = ['a', 'b', 'c'].map((id) => ({
    ...requirement,
    id,
    viewports: ['desktop'],
    checks: [{ operator: 'excludes', value: 'missing' }],
  }));
  const evidence = requirements.map((r) => ({
    evidenceId: r.id,
    criterionIds: [r.id],
    viewport: 'desktop',
    complete: true,
  }));
  const manifest = { runId: 'test', requirements, evidence };
  const read = async () => ({
    image: {},
    observation: { text: 'word '.repeat(1300), textTruncated: false, elementsTruncated: false },
  });
  const input = { offset: 0, limit: 5, maxBytes: 26000, counterexamples: [] };
  const page = await auditRun(manifest, input, read);
  assert.equal(page.items.length, 1);
  assert.equal(page.nextOffset, 1);
  assert.equal(page.pageSummary.audited, 1);
  assert.ok(page.bytes <= input.maxBytes);
  assert.ok(page.items[0].samples[0].probes.every((p) => 'text' in p));
  await assert.rejects(
    auditRun(
      manifest,
      {
        ...input,
        maxBytes: 16384,
        counterexamples: [{ criterionId: 'a', label: 'Large sample', text: 'x'.repeat(8000) }],
      },
      read,
    ),
    /exceeds maxBytes/,
  );
});
