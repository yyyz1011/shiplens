import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import http from 'node:http';
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
      assert.equal((await client.listTools()).tools.length, 18);
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
