import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const exec = promisify(execFile);
const dist = path.resolve('apps/docs/dist');
await stat(path.join(dist, 'index.html'));
const output = path.resolve('artifacts/docs-plan-' + Date.now());
await mkdir(output, { recursive: true });
let changed = false,
  alteredResponses = 0;
const moduleHashes = new Map();
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(dist + path.sep)) throw new Error('Outside fixture root');
    let bytes = await readFile(file);
    const ext = path.extname(file);
    if (ext === '.js') {
      moduleHashes.set(path.relative(dist, file), createHash('sha256').update(bytes).digest('hex'));
      if (changed && bytes.includes('Quick start')) {
        bytes = Buffer.from(bytes.toString().replaceAll('Quick start', 'BROKEN quick start title'));
        alteredResponses++;
      }
    }
    const mime = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.svg': 'image/svg+xml',
    };
    res.setHeader('content-type', mime[ext] || 'application/octet-stream');
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const data = {
  schemaVersion: 1,
  kind: 'shiplens-case',
  name: 'Documentation release routes',
  tags: ['integration'],
  flows: [],
  requirements: [
    ['quickstart', '/#/docs/quickstart', 'Quick start'],
    ['mcp', '/#/docs/mcp', 'MCP setup & tools'],
    ['plans', '/#/docs/portable-plans', 'One-command verification'],
  ].map(([id, page, value]) => ({
    id,
    description: `Page heading: ${value}`,
    page,
    selector: 'h1',
    checks: [{ operator: 'equals', value }],
    evaluation: 'checks',
  })),
};
await writeFile(path.join(output, 'acceptance.json'), JSON.stringify(data, null, 2));
await writeFile(
  path.join(output, 'config.json'),
  JSON.stringify({
    url: `http://127.0.0.1:${server.address().port}`,
    viewport: 'both',
    crawl: false,
    scroll: false,
    waitFor: 'h1',
    settle: 100,
    output: path.join(output, 'evidence'),
  }),
);
const command = [
  path.resolve('packages/cli/src/cli.js'),
  'review',
  'verify',
  '--config',
  'config.json',
  '--plan',
  'acceptance.json',
  '--format',
  'json',
];
const trials = [];
try {
  for (const variant of ['clean', 'altered-title']) {
    changed = variant === 'altered-title';
    let stdout,
      exitCode = 0;
    try {
      ({ stdout } = await exec(process.execPath, command, { cwd: output, timeout: 120000 }));
    } catch (error) {
      if (error.code !== 1) throw error;
      stdout = error.stdout;
      exitCode = error.code;
    }
    const result = JSON.parse(stdout);
    assert.equal(exitCode, changed ? 1 : 0, variant);
    assert.equal(result.gate.counts.pass, changed ? 2 : 3, variant);
    assert.equal(result.gate.counts.fail, changed ? 1 : 0, variant);
    const snapshot = JSON.parse(
      await readFile(path.join(output, 'evidence/reviews', result.report.file), 'utf8'),
    );
    assert.equal(snapshot.run.evidence.length, 6);
    assert.equal(snapshot.run.history.length, 0);
    if (changed)
      assert.deepEqual(
        result.unresolved.map((r) => r.criterionId),
        ['quickstart'],
      );
    trials.push({
      variant,
      exitCode,
      result,
      evidenceCount: snapshot.run.evidence.length,
      callerAssessments: snapshot.run.history.length,
    });
  }
  assert.ok(alteredResponses > 0);
  assert.notEqual(trials[0].result.runId, trials[1].result.runId);
  const record = {
    at: new Date().toISOString(),
    version: JSON.parse(await readFile('packages/cli/package.json', 'utf8')).version,
    node: process.version,
    platform: process.platform,
    plan: data,
    modules: Object.fromEntries(moduleHashes),
    alteredResponses,
    trials,
    note: 'Maintainer-controlled integration test of the built documentation app. One injected title defect, three requirements, two viewports, two runs; no AI calls, timing comparison or independent/customer validation. Run npm run build then npm run test:plan-docs. Full local run evidence is under artifacts/docs-plan-TIMESTAMP.',
  };
  await writeFile(path.join(output, 'results.json'), JSON.stringify(record, null, 2));
  if (process.env.SHIPLENS_RECORD_DOCS_PLAN === '1') {
    await mkdir('apps/docs/public/plan-verification', { recursive: true });
    await writeFile(
      'apps/docs/public/plan-verification/results.json',
      JSON.stringify(record, null, 2) + '\n',
    );
  }
  console.log(
    JSON.stringify({
      passed: true,
      output,
      trials: trials.map((t) => ({
        variant: t.variant,
        exitCode: t.exitCode,
        counts: t.result.gate.counts,
      })),
    }),
  );
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
