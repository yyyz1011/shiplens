import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ReviewWorkspace } from '../src/review.js';
import { startPlanLockDemo } from '../examples/plan-lock-server.mjs';
const exec = promisify(execFile);
const data = JSON.parse(await readFile(new URL('../examples/locked-plan.json', import.meta.url)));
async function fixture(mode, action) {
  const root = await mkdtemp(path.join(tmpdir(), 'shiplens-plan-lock-'));
  const app = await startPlanLockDemo({ mode });
  const config = {
    directory: path.join(root, 'reviews'),
    options: {
      url: app.url,
      output: root,
      viewport: 'both',
      crawl: false,
      scroll: false,
      settle: 0,
      timeout: 1000,
    },
  };
  const host = new ReviewWorkspace(config),
    lock = host.createPlanLock({ data });
  const w = new ReviewWorkspace({ ...config, acceptanceLock: { lock, sha256: lock.sha256 } });
  try {
    await action({ root, app, config, host, lock, w });
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
}
test('a trusted lock preserves approved checks while a changed assertion cannot turn a wrong page green', () =>
  fixture('wrong', async ({ w, host, app, root }) => {
    const original = await w.verify({ data });
    assert.equal(original.gate.passed, false);
    assert.equal(original.gate.planLock.matched, true);
    const report = await readFile(path.join(root, 'reviews', original.report.file), 'utf8');
    assert.ok(report.includes('Approved acceptance standard'));
    assert.ok(report.includes(original.gate.planLock.sha256));

    const changed = structuredClone(data);
    changed.requirements[1].checks = [{ operator: 'contains', value: '¥' }];
    const count = app.requests();
    const inspection = w.checkPlanLock({ data: changed });
    assert.equal(inspection.passed, false);
    assert.ok(inspection.changes.some((c) => c.criterionId === 'price' && c.field === 'checks'));
    await assert.rejects(
      w.verify({ data: changed }),
      (e) => e.code === 'SHIPLENS_PLAN_LOCK_BLOCKED' && e.inspection.status === 'changed',
    );
    assert.equal(app.requests(), count);
    assert.equal((await host.verify({ data: changed })).gate.passed, true);
    assert.ok(
      (await readFile(path.join(root, 'reviews', original.report.file), 'utf8')).includes('¥129'),
    );
  }));
test('locked healthy runs retain their gate, tolerate editorial ordering, and reject old unlocked runs', () =>
  fixture('healthy', async ({ w, host, lock, config }) => {
    const editorial = structuredClone(data);
    editorial.name = 'Edited display name';
    editorial.tags = ['new'];
    editorial.requirements.reverse();
    assert.equal(w.checkPlanLock({ data: editorial }).passed, true);
    const result = await w.verify({ data: editorial });
    assert.equal(result.gate.passed, true);
    assert.equal((await w.getRun(result.runId)).planLock.sha256, lock.sha256);
    assert.equal((await w.gate({ runId: result.runId })).passed, true);
    const unlocked = await host.verify({ data });
    assert.ok(
      (await w.gate({ runId: unlocked.runId })).reasons.includes('acceptance-lock-mismatch'),
    );
    const manifestPath = path.join(config.directory, 'runs', result.runId, 'run.json');
    const manifest = JSON.parse(await readFile(manifestPath));
    manifest.requirements[0].description = 'Silently altered meaning';
    await writeFile(manifestPath, JSON.stringify(manifest));
    assert.equal((await w.gate({ runId: result.runId })).passed, false);
  }));
test('removed criteria, changed scope and policy block offline; execution tools cannot bypass a locked host', () =>
  fixture('healthy', async ({ w, lock, config, root, app }) => {
    for (const mutate of [
      (p) => p.requirements.pop(),
      (p) => (p.requirements[1].viewports = ['desktop']),
      (p) => (p.requirements[1].selector = '#reference'),
      (p) => (p.requirements[1].checks[0].value = '¥999'),
      (p) => (p.requirements[1].evaluation = 'manual'),
    ]) {
      const changed = structuredClone(data);
      mutate(changed);
      assert.equal(w.checkPlanLock({ data: changed }).passed, false);
      await assert.rejects(
        w.verify({ data: changed }),
        (e) => e.code === 'SHIPLENS_PLAN_LOCK_BLOCKED',
      );
    }
    assert.equal(w.checkPlanLock({ data: { ...data, requirements: [] } }).status, 'invalid-plan');
    for (const patch of [
      { viewport: 'desktop' },
      { ignoreRules: ['console-error'] },
      { mask: ['#price'] },
      { settle: 1 },
    ]) {
      const other = new ReviewWorkspace({
        ...config,
        options: { ...config.options, ...patch },
        acceptanceLock: { lock, sha256: lock.sha256 },
      });
      const inspection = other.checkPlanLock({ data });
      assert.equal(inspection.passed, false);
      assert.ok(inspection.changes.some((c) => c.kind === 'policy-changed'));
    }
    assert.equal(w.checkPlanLock({ data, failOn: 'warning' }).passed, false);
    await assert.rejects(w.collect({ requirements: data.requirements }), /Use verify/);
    await assert.rejects(w.recheck({ caseId: 'bad' }), /Use verify/);
    await assert.rejects(w.verifyDelivery({ contract: {} }), /Use verify/);
    assert.throws(() => w.createPlanLock({ data }), /separate unlocked host/);
    assert.equal(app.requests(), 0);
    await assert.rejects(stat(path.join(root, 'reviews')), (e) => e.code === 'ENOENT');
  }));
test('trusted fingerprint detects a rewritten lock; origin and presentation remain runtime choices', () =>
  fixture('healthy', async ({ lock, config }) => {
    const changed = structuredClone(lock);
    changed.plan.requirements[1].checks[0].value = '¥999';
    assert.throws(
      () =>
        new ReviewWorkspace({ ...config, acceptanceLock: { lock: changed, sha256: lock.sha256 } }),
      /fingerprint/,
    );
    assert.throws(
      () => new ReviewWorkspace({ ...config, acceptanceLock: { lock, sha256: 'a'.repeat(64) } }),
      /fingerprint/,
    );
    const moved = new ReviewWorkspace({
      ...config,
      directory: 'elsewhere',
      options: {
        ...config.options,
        url: 'http://example.invalid',
        lang: 'zh',
        output: 'elsewhere',
      },
      acceptanceLock: { lock, sha256: lock.sha256 },
    });
    assert.equal(moved.checkPlanLock({ data }).passed, true);
  }));
test('CLI creates exclusive locks and returns structured changes with exit 1 without launching a browser', () =>
  fixture('healthy', async ({ config, root, app }) => {
    const cli = path.resolve('packages/cli/src/cli.js');
    await writeFile(path.join(root, 'config.json'), JSON.stringify(config.options));
    await writeFile(path.join(root, 'plan.json'), JSON.stringify(data));
    const args = [
      'review',
      'lock',
      '--config',
      'config.json',
      '--plan',
      'plan.json',
      '--lock-output',
      'approved.json',
    ];
    const result = await exec(process.execPath, [cli, ...args], { cwd: root });
    const lock = JSON.parse(result.stdout);
    await assert.rejects(
      exec(process.execPath, [cli, ...args], { cwd: root }),
      (e) => e.code === 2,
    );
    await writeFile(
      path.join(root, 'config.json'),
      JSON.stringify({
        ...config.options,
        acceptanceLock: { file: 'approved.json', sha256: lock.sha256 },
      }),
    );
    const changed = structuredClone(data);
    changed.requirements.pop();
    await writeFile(path.join(root, 'plan.json'), JSON.stringify(changed));
    for (const command of ['lock-check', 'verify'])
      await assert.rejects(
        exec(
          process.execPath,
          [cli, 'review', command, '--config', 'config.json', '--plan', 'plan.json'],
          { cwd: root },
        ),
        (e) => e.code === 1 && JSON.parse(e.stdout).status === 'changed',
      );
    assert.equal(app.requests(), 0);
  }));
test('MCP returns lock differences and rejects verify while exposing no lock-update tool', () =>
  fixture('healthy', async ({ root, config, lock, app }) => {
    const { Client } = await import('@modelcontextprotocol/client');
    const { StdioClientTransport } = await import('@modelcontextprotocol/client/stdio');
    await writeFile(path.join(root, 'approved.json'), JSON.stringify(lock));
    await writeFile(
      path.join(root, 'config.json'),
      JSON.stringify({
        ...config.options,
        acceptanceLock: { file: 'approved.json', sha256: lock.sha256 },
      }),
    );
    const client = new Client({ name: 'lock-test', version: '1' });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          path.resolve('packages/cli/src/cli.js'),
          'mcp',
          '--config',
          path.join(root, 'config.json'),
        ],
      }),
    );
    try {
      const tools = (await client.listTools()).tools;
      assert.equal(tools.length, 25);
      assert.equal(
        tools.find((t) => t.name === 'shiplens_check_plan_lock').annotations.readOnlyHint,
        true,
      );
      assert.ok(!tools.some((t) => /create.*lock|update.*lock/.test(t.name)));
      const changed = structuredClone(data);
      changed.requirements.pop();
      const result = await client.callTool({
        name: 'shiplens_verify',
        arguments: { data: changed },
      });
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent.status, 'changed');
      const check = await client.callTool({
        name: 'shiplens_check_plan_lock',
        arguments: { data: changed },
      });
      assert.equal(check.structuredContent.changes[0].kind, 'requirement-removed');
      assert.equal(app.requests(), 0);
    } finally {
      await client.close();
    }
  }));
