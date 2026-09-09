import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { scan, validateOptions } from '../src/index.js';
import { demoHandler } from '../examples/server.mjs';
import { applySuppressions } from '../src/suppressions.js';
const exec = promisify(execFile);
const example = JSON.parse(
  await readFile(new URL('../examples/flows.json', import.meta.url), 'utf8'),
);
async function fixture(fn) {
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url);
    if (req.url === '/writes') {
      res.setHeader('content-type', 'text/html');
      return res.end(
        '<h1>Write example</h1><button id="write" onclick="fetch(\'/mutate\',{method:\'POST\'}).catch(()=>{})">Write</button>',
      );
    }
    demoHandler(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const output = await mkdtemp(path.join(tmpdir(), 'shiplens-flows-'));
  const options = {
    url: `http://127.0.0.1:${server.address().port}`,
    output,
    viewport: 'desktop',
    settle: 0,
    scroll: false,
    crawl: false,
    timeout: 1000,
  };
  try {
    await fn(options, hits);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(output, { recursive: true, force: true });
  }
}
const flow = (steps, extra = {}) => ({ name: 'test-flow', page: '/', steps, ...extra });
const click = (selector) => ({ action: 'click', selector });

test('documented example executes all six actions with isolated flows and step evidence', () =>
  fixture(async (o) => {
    const r = await scan({
      ...o,
      flows: [
        ...example.flows,
        flow([{ action: 'waitFor', selector: '#result', state: 'hidden' }], {
          name: 'fresh-session',
        }),
      ],
    });
    assert.equal(r.summary.errors, 0);
    assert.equal(r.summary.incomplete, 0);
    assert.equal(r.summary.checks, 3);
    const checks = r.pages[0].checks;
    assert.equal(checks[1].steps.length, 9);
    for (const step of checks[1].steps) {
      assert.equal(step.status, 'passed');
      assert.ok((await readFile(path.join(r.runDirectory, step.screenshot))).length > 100);
    }
    const saved = await readFile(path.join(r.runDirectory, 'report.json'), 'utf8');
    assert.ok(!saved.includes('Kyoto'));
    assert.ok(!saved.includes('"value"'));
    assert.equal(checks[2].steps[0].status, 'passed');
  }));

test('interaction errors have step-specific evidence and failed expectations stop later steps', () =>
  fixture(async (o) => {
    const r = await scan({
      ...o,
      flows: [
        flow([
          click('#broken'),
          { action: 'expectText', selector: '#result', value: 'NEVER-SAVE-THIS' },
          click('#known'),
        ]),
      ],
    });
    const check = r.pages[0].checks[1];
    assert.deepEqual(
      check.steps.map((s) => s.status),
      ['passed', 'failed', 'skipped'],
    );
    assert.equal(check.status, 'incomplete');
    const runtime = r.findings.find((f) => f.code === 'runtime-error');
    assert.equal(runtime.flow, 'test-flow');
    assert.equal(runtime.step, 1);
    assert.match(runtime.screenshot, /step-1\.png$/);
    assert.ok(r.findings.some((f) => f.code === 'interaction-failed' && f.step === 2));
    assert.ok(!r.findings.some((f) => f.code === 'console-error'));
    const saved = await readFile(path.join(r.runDirectory, 'report.json'), 'utf8');
    assert.ok(!saved.includes('NEVER-SAVE-THIS'));
    assert.match(await readFile(path.join(r.runDirectory, 'report.md'), 'utf8'), /test-flow/);
    assert.match(await readFile(path.join(r.runDirectory, 'index.html'), 'utf8'), /test-flow/);
  }));

test('flows add explicit pages, preserve blocked-write policy, and fail CLI checks', () =>
  fixture(async (o, hits) => {
    const config = { ...o, flows: [flow([click('#write')], { page: '/writes' })] };
    const file = path.join(o.output, 'flow.json');
    await writeFile(file, JSON.stringify(config));
    await assert.rejects(
      exec(process.execPath, ['packages/cli/src/cli.js', '--config', file, '--json']),
      (error) => {
        assert.equal(error.code, 1);
        const r = JSON.parse(error.stdout);
        assert.equal(r.summary.pages, 2);
        assert.ok(r.summary.incomplete > 0);
        assert.equal(r.pages[1].checks[1].steps[0].status, 'failed');
        return true;
      },
    );
    assert.ok(!hits.includes('/mutate'));
  }));

test('precise ignores retain evidence and expiry restores active findings', () =>
  fixture(async (o) => {
    const opts = { ...o, flows: [flow([click('#known')])] };
    const ignore = [
      {
        rule: 'console-error',
        page: '/',
        messageIncludes: 'Demo known diagnostic',
        reason: 'Tracked demo diagnostic',
        expires: '2099-01-01',
      },
    ];
    const r = await scan({ ...opts, ignore });
    assert.equal(r.summary.warnings, 0);
    assert.equal(r.summary.suppressed, 1);
    assert.equal(r.suppressed[0].suppression.reason, 'Tracked demo diagnostic');
    assert.ok(r.suppressed[0].screenshot);
    assert.match(
      await readFile(path.join(r.runDirectory, 'index.html'), 'utf8'),
      /Tracked demo diagnostic/,
    );
    const expired = await scan({
      ...opts,
      ignore: [{ ...ignore[0], expires: '2000-01-01' }],
      baseline: path.join(r.runDirectory, 'report.json'),
    });
    assert.equal(expired.summary.warnings, 1);
    assert.equal(expired.summary.suppressed, 0);
    assert.equal(expired.ignoreWarnings.length, 1);
    assert.equal(expired.comparison.comparable, false);
    const changed = await scan({
      ...opts,
      flows: [flow([click('#known'), click('#details')])],
      ignore,
      baseline: path.join(r.runDirectory, 'report.json'),
    });
    assert.equal(changed.comparison.comparable, false);
  }));

test('ignore match fields combine exactly and cannot hide unrelated overflow candidates', () => {
  const findings = [
    {
      code: 'console-error',
      url: 'http://localhost/a',
      viewport: 'mobile',
      detail: 'known diagnostic',
      fingerprint: '0123456789abcdef',
    },
    {
      code: 'console-error',
      url: 'http://localhost/b',
      viewport: 'mobile',
      detail: 'known diagnostic',
      fingerprint: 'fedcba9876543210',
    },
    {
      code: 'horizontal-overflow',
      url: 'http://localhost/a',
      viewport: 'mobile',
      selector: '#one',
      elements: [{ selector: '#one' }, { selector: '#two' }],
    },
  ];
  const r = { findings };
  applySuppressions(
    r,
    [
      {
        rule: 'console-error',
        page: 'http://localhost/a',
        viewport: 'mobile',
        messageIncludes: 'known',
        reason: 'Known issue',
      },
      { rule: 'horizontal-overflow', selector: '#one', reason: 'Intentional' },
    ],
    Date.now(),
  );
  assert.equal(r.suppressed.length, 1);
  assert.equal(r.findings.length, 2);
});

test('invalid flow and ignore configurations fail before opening a browser', () => {
  const valid = flow([click('#button')]);
  for (const extra of [
    { flows: [{ ...valid, page: 'https://example.com' }] },
    { flows: [valid, valid] },
    { flows: [{ ...valid, steps: [] }] },
    { flows: [flow([{ action: 'eval', selector: 'body' }])] },
    { flows: [flow([{ action: 'fill', selector: '#input' }])] },
    { flows: [flow([{ ...click('#button'), value: 'ignored' }])] },
    { flows: [flow([{ ...click('#button'), timeout: 1 }])] },
    { ignore: [{ rule: 'console-error', reason: 'Too broad' }] },
    { ignore: [{ rule: 'interaction-failed', page: '/', reason: 'Must fail' }] },
    { ignore: [{ rule: 'console-error', page: '/', reason: 'Bad date', expires: '2026-02-30' }] },
    { ignoreRules: ['interaction-failed'] },
  ])
    assert.throws(() => validateOptions({ url: 'http://localhost', ...extra }));
});
