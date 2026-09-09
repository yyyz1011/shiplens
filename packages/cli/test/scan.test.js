import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scan } from '../src/scan.js';
import { startFixture } from './fixture.js';

test('real browser detects seeded failures, saves evidence and respects exclusions', async () => {
  const fixture = await startFixture();
  const output = await mkdtemp(path.join(tmpdir(), 'shiplens-test-'));
  try {
    const r = await scan({
      url: fixture.url,
      maxPages: 5,
      settle: 200,
      exclude: ['/excluded'],
      output,
    });
    const codes = new Set(r.findings.map((f) => f.code));
    for (const code of [
      'runtime-error',
      'http-error',
      'broken-image',
      'horizontal-overflow',
      'page-empty',
    ])
      assert.ok(codes.has(code), `missing ${code}`);
    assert.equal(r.summary.pages, 4);
    assert.equal(r.summary.checks, 8);
    assert.equal(r.summary.incomplete, 0);
    assert.ok(!fixture.hits.some((h) => h.url === '/logout' || h.url === '/excluded'));
    assert.ok(
      !r.findings.some((f) => f.code === 'horizontal-overflow' && f.viewport === 'desktop'),
    );
    for (const f of r.findings)
      if (f.screenshot) await access(path.join(r.runDirectory, f.screenshot));
    const json = JSON.parse(await readFile(path.join(r.runDirectory, 'report.json'), 'utf8'));
    assert.equal(json.summary.errors, r.summary.errors);
    assert.ok(
      (await readFile(path.join(r.runDirectory, 'report.md'), 'utf8')).includes('Reproduce'),
    );
    const baseline = await scan({
      url: fixture.url,
      maxPages: 5,
      settle: 200,
      exclude: ['/excluded'],
      output,
      baseline: path.join(r.runDirectory, 'report.json'),
    });
    assert.equal(baseline.comparison.new.length, 0);
    assert.equal(baseline.comparison.absent.length, 0);
    assert.notEqual(r.runDirectory, baseline.runDirectory);
  } finally {
    await fixture.close();
    await rm(output, { recursive: true, force: true });
  }
});

test('healthy page returns no findings; truncation is visible', async () => {
  const fixture = await startFixture();
  const output = await mkdtemp(path.join(tmpdir(), 'shiplens-healthy-'));
  try {
    const clean = await scan({
      url: fixture.url + '/healthy',
      viewport: 'both',
      settle: 100,
      output,
    });
    assert.deepEqual(clean.findings, []);
    const limited = await scan({
      url: fixture.url,
      maxPages: 1,
      viewport: 'desktop',
      settle: 150,
      output,
    });
    assert.equal(limited.truncated, true);
    assert.ok(limited.remainingPages > 0);
  } finally {
    await fixture.close();
    await rm(output, { recursive: true, force: true });
  }
});

test('non-read-only requests are blocked and completion is not overstated', async () => {
  const fixture = await startFixture();
  const output = await mkdtemp(path.join(tmpdir(), 'shiplens-readonly-'));
  try {
    const r = await scan({
      url: fixture.url + '/mutating',
      viewport: 'desktop',
      settle: 200,
      output,
    });
    assert.equal(r.summary.incomplete, 1);
    assert.equal(r.skipped.length, 1);
    assert.ok(!fixture.hits.some((h) => h.method === 'POST'));
  } finally {
    await fixture.close();
    await rm(output, { recursive: true, force: true });
  }
});

function cli(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [
      fileURLToPath(new URL('../src/cli.js', import.meta.url)),
      ...args,
    ]);
    let out = '',
      err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => resolve({ code, out, err }));
  });
}
test('CLI emits machine-readable JSON and meaningful exit codes', async () => {
  const fixture = await startFixture();
  const output = await mkdtemp(path.join(tmpdir(), 'shiplens-cli-'));
  try {
    const clean = await cli([
      fixture.url + '/healthy',
      '--viewport',
      'desktop',
      '--settle',
      '100',
      '--output',
      output,
      '--json',
    ]);
    assert.equal(clean.code, 0);
    assert.equal(JSON.parse(clean.out).summary.errors, 0);
    assert.equal(clean.err, '');
    const broken = await cli([
      fixture.url + '/missing',
      '--viewport',
      'desktop',
      '--settle',
      '100',
      '--output',
      output,
      '--json',
    ]);
    assert.equal(broken.code, 1);
    assert.ok(JSON.parse(broken.out).summary.errors > 0);
    const invalid = await cli(['http://localhost', '--max-pages', '0']);
    assert.equal(invalid.code, 2);
    const typo = await cli(['http://localhost', '--max-page', '3']);
    assert.equal(typo.code, 2);
  } finally {
    await fixture.close();
    await rm(output, { recursive: true, force: true });
  }
});
