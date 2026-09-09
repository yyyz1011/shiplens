import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createDeliveryDemo } from '../packages/cli/examples/delivery-server.mjs';
import { startPlanLockDemo } from '../packages/cli/examples/plan-lock-server.mjs';
import { demoHandler } from '../packages/cli/examples/server.mjs';
import { startFixture } from '../packages/cli/test/fixture.js';
const exec = promisify(execFile);
const temp = await mkdtemp(path.join(tmpdir(), 'shiplens-package-'));
const fixture = await startFixture();
try {
  const packed = JSON.parse(
    (await exec('npm', ['pack', '--workspace', 'shiplens', '--json', '--pack-destination', temp]))
      .stdout,
  )[0];
  assert.ok(
    packed.files.every(
      (f) =>
        f.path.startsWith('src/') ||
        f.path.startsWith('examples/') ||
        ['README.md', 'AGENT_GUIDE.md', 'LICENSE', 'package.json'].includes(f.path),
    ),
  );
  const installed = path.join(temp, 'consumer');
  await mkdir(installed);
  await writeFile(
    path.join(installed, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  );
  await exec(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', path.join(temp, packed.filename)],
    { cwd: installed },
  );
  const binary = path.join(installed, 'node_modules/.bin/shiplens');
  assert.equal((await exec(binary, ['--version'])).stdout.trim(), packed.version);
  const result = await exec(
    binary,
    [
      fixture.url + '/healthy',
      '--viewport',
      'desktop',
      '--settle',
      '100',
      '--output',
      path.join(temp, 'reports'),
      '--json',
    ],
    { cwd: installed },
  );
  const report = JSON.parse(result.stdout);
  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.pages, 1);
  await exec(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import {scan} from 'shiplens'; if(typeof scan!=='function') process.exit(1)",
    ],
    { cwd: installed },
  );
  const lockDemo = await startPlanLockDemo();
  try {
    const result = JSON.parse(
      (
        await exec(process.execPath, ['node_modules/shiplens/examples/plan-lock.mjs'], {
          cwd: installed,
          env: {
            ...process.env,
            SHIPLENS_EXAMPLE_URL: lockDemo.url,
            SHIPLENS_EXAMPLE_OUTPUT: path.join(temp, 'lock-example'),
          },
        })
      ).stdout,
    );
    assert.equal(result.originalPassed, false);
    assert.equal(result.changedBlocked, true);
    assert.equal(result.inspection.changes[0].criterionId, 'price');
  } finally {
    await lockDemo.close();
  }
  const demo = http.createServer(demoHandler);
  await new Promise((resolve) => demo.listen(0, '127.0.0.1', resolve));
  try {
    const exampleResult = await exec(process.execPath, ['node_modules/shiplens/examples/api.mjs'], {
      cwd: installed,
      env: {
        ...process.env,
        SHIPLENS_EXAMPLE_URL: `http://127.0.0.1:${demo.address().port}`,
        SHIPLENS_EXAMPLE_OUTPUT: path.join(temp, 'example-reports'),
      },
    });
    assert.match(exampleResult.stdout, /comparable: true/);
    const reviewExample = await exec(
      process.execPath,
      ['node_modules/shiplens/examples/review.mjs'],
      {
        cwd: installed,
        env: {
          ...process.env,
          SHIPLENS_EXAMPLE_URL: `http://127.0.0.1:${demo.address().port}`,
          SHIPLENS_EXAMPLE_OUTPUT: path.join(temp, 'review-example'),
        },
      },
    );
    assert.match(reviewExample.stdout, /status: 'pending'/);
    assert.match(reviewExample.stdout, /comparable: true/);
    const workflow = await exec(process.execPath, ['node_modules/shiplens/examples/workflow.mjs'], {
      cwd: installed,
      env: {
        ...process.env,
        SHIPLENS_EXAMPLE_URL: `http://127.0.0.1:${demo.address().port}`,
        SHIPLENS_EXAMPLE_OUTPUT: path.join(temp, 'workflow-example'),
      },
    });
    assert.match(workflow.stdout, /gate: 'blocked'/);
    assert.match(workflow.stdout, /transition: 'awaiting-review'/);
    const checks = await exec(process.execPath, ['node_modules/shiplens/examples/checks.mjs'], {
      cwd: installed,
      env: {
        ...process.env,
        SHIPLENS_EXAMPLE_URL: `http://127.0.0.1:${demo.address().port}`,
        SHIPLENS_EXAMPLE_OUTPUT: path.join(temp, 'checks-example'),
      },
    });
    assert.match(checks.stdout, /callerAssessments: 0/);
    assert.match(checks.stdout, /gate: true/);
    const auditExample = JSON.parse(
      (
        await exec(process.execPath, ['node_modules/shiplens/examples/audit.mjs'], {
          cwd: installed,
          env: {
            ...process.env,
            SHIPLENS_EXAMPLE_URL: `http://127.0.0.1:${demo.address().port}`,
            SHIPLENS_EXAMPLE_OUTPUT: path.join(temp, 'audit-example'),
          },
        })
      ).stdout,
    );
    assert.equal(auditExample.items[0].status, 'audited');
    assert.ok(
      auditExample.items[0].samples.every(
        (s) => s.probes.find((p) => p.kind === 'custom').result === 'survived',
      ),
    );
    const verified = await exec(process.execPath, ['node_modules/shiplens/examples/verify.mjs'], {
      cwd: installed,
      env: {
        ...process.env,
        SHIPLENS_EXAMPLE_URL: `http://127.0.0.1:${demo.address().port}`,
        SHIPLENS_EXAMPLE_OUTPUT: path.join(temp, 'verify-example'),
      },
    });
    const verification = JSON.parse(verified.stdout);
    assert.equal(verification.gate.passed, true);
    assert.equal(verification.plan.automaticRequirements.length, 1);
    assert.equal(verification.next, null);
    const inputPlan = JSON.parse(
      await (
        await import('node:fs/promises')
      ).readFile(path.join(installed, 'node_modules/shiplens/examples/acceptance.json'), 'utf8'),
    );
    inputPlan.flows[0].steps.push({ action: 'fill', selector: '#query', valueFromInput: 'query' });
    await writeFile(path.join(installed, 'acceptance.json'), JSON.stringify(inputPlan));
    await writeFile(
      path.join(installed, 'inputs.json'),
      JSON.stringify({ query: 'Sample destination' }),
    );
    await writeFile(
      path.join(installed, 'verify-config.json'),
      JSON.stringify({
        url: `http://127.0.0.1:${demo.address().port}`,
        viewport: 'both',
        crawl: false,
        output: path.join(temp, 'named-input-example'),
      }),
    );
    const namedInputExample = JSON.parse(
      (
        await exec(
          binary,
          [
            'review',
            'verify',
            '--config',
            'verify-config.json',
            '--plan',
            'acceptance.json',
            '--input',
            'inputs.json',
            '--format',
            'html',
            '--lang',
            'en',
            '--fail-on',
            'warning',
            '--timeout-ms',
            '180000',
          ],
          { cwd: installed },
        )
      ).stdout,
    );
    assert.equal(namedInputExample.gate.passed, true);
    assert.equal(namedInputExample.plan.requiredInputs[0].key, 'query');
    const deliveryApp = await createDeliveryDemo({ directory: path.join(temp, 'delivery-app') });
    try {
      const delivered = JSON.parse(
        (
          await exec(process.execPath, ['node_modules/shiplens/examples/delivery.mjs'], {
            cwd: installed,
            env: {
              ...process.env,
              SHIPLENS_EXAMPLE_URL: deliveryApp.url,
              SHIPLENS_EXAMPLE_OUTPUT: path.join(temp, 'delivery-example'),
            },
          })
        ).stdout,
      );
      assert.equal(delivered.passed, true);
      assert.equal(delivered.trials.length, 4);
    } finally {
      await deliveryApp.close();
    }
    const doctor = JSON.parse((await exec(binary, ['doctor'], { cwd: installed })).stdout);
    assert.equal(doctor.passed, true);
    const { Client } = await import('@modelcontextprotocol/client');
    const { StdioClientTransport } = await import('@modelcontextprotocol/client/stdio');
    const client = new Client({ name: 'package-check', version: '1.0.0' });
    await writeFile(
      path.join(installed, 'mcp.json'),
      JSON.stringify({ url: `http://127.0.0.1:${demo.address().port}`, output: 'mcp-output' }),
    );
    try {
      await client.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [
            path.join(installed, 'node_modules/shiplens/src/cli.js'),
            'mcp',
            '--config',
            path.join(installed, 'mcp.json'),
          ],
        }),
      );
      const tools = (await client.listTools()).tools;
      assert.equal(tools.length, 25);
      assert.equal(
        tools.find((t) => t.name === 'shiplens_verify_delivery').annotations.destructiveHint,
        true,
      );
      assert.equal(
        tools.find((t) => t.name === 'shiplens_read_delivery_evidence').annotations.readOnlyHint,
        true,
      );
      assert.equal(
        tools.find((t) => t.name === 'shiplens_audit_checks').annotations.readOnlyHint,
        true,
      );
      const collected = await client.callTool({
        name: 'shiplens_collect',
        arguments: {
          requirements: [
            {
              id: 'heading',
              description: 'Heading includes delivery',
              page: '/',
              selector: 'h1',
              evaluation: 'checks',
              checks: [{ operator: 'contains', value: 'delivery' }],
            },
          ],
        },
      });
      const runId = collected.structuredContent.runId;
      const audited = await client.callTool({
        name: 'shiplens_audit_checks',
        arguments: { runId },
      });
      assert.equal(audited.isError, undefined);
      assert.equal(audited.structuredContent.items[0].status, 'audited');
      assert.equal(
        audited.structuredContent.items[0].samples[0].probes.find((p) => p.kind === 'error-suffix')
          .result,
        'survived',
      );
    } finally {
      await client.close();
    }
    const config = JSON.parse(
      await (
        await import('node:fs/promises')
      ).readFile(path.join(installed, 'node_modules/shiplens/examples/flows.json'), 'utf8'),
    );
    config.url = `http://127.0.0.1:${demo.address().port}`;
    config.settle = 0;
    config.output = path.join(temp, 'flow-reports');
    await writeFile(path.join(installed, 'flows.json'), JSON.stringify(config));
    const run = await exec(binary, ['--config', 'flows.json', '--json'], { cwd: installed });
    const flows = JSON.parse(run.stdout);
    assert.equal(flows.summary.checks, 4);
    assert.equal(flows.summary.incomplete, 0);
  } finally {
    await new Promise((resolve) => demo.close(resolve));
  }
  await mkdir('artifacts/package', { recursive: true });
  await writeFile(
    'artifacts/package/results.json',
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        package: packed.name,
        version: packed.version,
        size: packed.size,
        unpackedSize: packed.unpackedSize,
        files: packed.files.map((f) => f.path),
        independentInstall: true,
        cliScan: true,
        esmImport: true,
        executableApiExample: true,
        bundledFlowExample: true,
        reviewSubpathExample: true,
        installedMcpHandshake: true,
      },
      null,
      2,
    ),
  );
  console.log(
    `Packed ${packed.name}@${packed.version}: ${packed.files.length} files. Independent install, CLI scan, all API exports and bundled interaction examples passed.`,
  );
} finally {
  await fixture.close();
  await rm(temp, { recursive: true, force: true });
}
