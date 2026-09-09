import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
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
      (f) => f.path.startsWith('src/') || ['README.md', 'LICENSE', 'package.json'].includes(f.path),
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
      },
      null,
      2,
    ),
  );
  console.log(
    `Packed ${packed.name}@${packed.version}: ${packed.files.length} files. Independent install, CLI scan and ESM import passed.`,
  );
} finally {
  await fixture.close();
  await rm(temp, { recursive: true, force: true });
}
