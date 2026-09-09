import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ReviewWorkspace } from '../../packages/cli/src/review.js';
import { VERSION } from '../../packages/cli/src/version.js';

const fixtures = [
  {
    id: 'price',
    good: 'Total: ¥129',
    bad: 'Total: ¥999',
    token: '¥',
    description: 'Order total must be ¥129',
  },
  {
    id: 'stock',
    good: 'Stock: 12 units',
    bad: 'Stock: 0 units',
    token: 'Stock:',
    description: 'Inventory must be 12 units',
  },
  {
    id: 'delivery',
    good: 'Delivery in 3 days',
    bad: 'Delivery in 30 days',
    token: 'Delivery',
    description: 'Delivery estimate must be 3 days',
  },
];
let requestCount = 0;
const server = http.createServer((req, res) => {
  requestCount++;
  const bad = req.url === '/bad';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(
    '<html lang="en"><title>Acceptance sensitivity</title><meta name="viewport" content="width=device-width,initial-scale=1"><h1>Checkout</h1>' +
      fixtures.map((f) => `<p id="${f.id}">${bad ? f.bad : f.good}</p>`).join('') +
      '</html>',
  );
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
const directory = path.resolve(`artifacts/check-audit-${Date.now()}`);
await mkdir(directory, { recursive: true });
const w = new ReviewWorkspace({
  directory,
  options: { url, viewport: 'both', crawl: false, scroll: false, settle: 0 },
});
const requirements = (strong, page = '/') =>
  fixtures.map((f) => ({
    id: f.id,
    description: f.description,
    page,
    selector: '#' + f.id,
    evaluation: 'checks',
    checks: [{ operator: strong ? 'equals' : 'contains', value: strong ? f.good : f.token }],
  }));
const browser = await chromium.launch();
try {
  const baseline = [];
  for (const viewport of ['desktop', 'mobile']) {
    const page = await browser.newPage({
      viewport: viewport === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    });
    for (const bad of [false, true]) {
      await page.goto(url + (bad ? '/bad' : '/'));
      for (const f of fixtures) {
        const text = (await page.locator('#' + f.id).innerText()).replace(/\s+/g, ' ').trim();
        baseline.push({
          criterionId: f.id,
          viewport,
          state: bad ? 'known-wrong' : 'specified',
          observedText: text,
          weakPassed: text.includes(f.token),
          strongPassed: text === f.good,
        });
      }
    }
    await page.close();
  }
  const weak = await w.collect({ requirements: requirements(false) });
  const strong = await w.collect({ requirements: requirements(true) });
  const liveWrongWeak = await w.collect({ requirements: requirements(false, '/bad') });
  const liveWrongStrong = await w.collect({ requirements: requirements(true, '/bad') });
  assert.ok(weak.requirements.every((r) => r.status === 'pass'));
  assert.ok(strong.requirements.every((r) => r.status === 'pass'));
  assert.ok(liveWrongWeak.requirements.every((r) => r.status === 'pass'));
  assert.ok(liveWrongStrong.requirements.every((r) => r.status === 'fail'));
  const requestsBeforeAudit = requestCount;
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  const counterexamples = fixtures.map((f) => ({
    criterionId: f.id,
    label: 'Specified unacceptable state',
    text: f.bad,
  }));
  const weakAudit = await w.auditChecks({ runId: weak.runId, counterexamples });
  const strongAudit = await w.auditChecks({ runId: strong.runId, counterexamples });
  assert.equal(requestCount, requestsBeforeAudit);
  for (const item of weakAudit.items)
    for (const sample of item.samples)
      assert.equal(sample.probes.find((p) => p.kind === 'custom').result, 'survived');
  for (const item of strongAudit.items)
    for (const sample of item.samples)
      assert.equal(sample.probes.find((p) => p.kind === 'custom').result, 'caught');
  const artifacts = [];
  for (const [name, run] of [
    ['weak', weak],
    ['strong', strong],
    ['wrong-weak', liveWrongWeak],
    ['wrong-strong', liveWrongStrong],
  ]) {
    const manifest = JSON.parse(
      await readFile(path.join(directory, 'runs', run.runId, 'run.json')),
    );
    for (const evidence of run.evidence)
      for (const kind of ['screenshot', 'observation']) {
        const file = `evidence/${name}-${evidence.criterionIds[0]}-${evidence.viewport}.${kind === 'screenshot' ? 'png' : 'json'}`;
        const bytes = await readFile(path.join(directory, manifest.scanDirectory, evidence[kind]));
        artifacts.push({ file, sha256: createHash('sha256').update(bytes).digest('hex') });
        if (process.env.SHIPLENS_RECORD_CHECK_AUDIT === '1') {
          await mkdir('apps/docs/public/check-audit/evidence', { recursive: true });
          await writeFile('apps/docs/public/check-audit/' + file, bytes);
        }
      }
  }
  const hashes = {};
  for (const file of [
    'benchmarks/check-audit/run.mjs',
    'packages/cli/src/check-audit.js',
    'packages/cli/src/acceptance-checks.js',
  ])
    hashes[file] = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
  const result = {
    schemaVersion: 1,
    version: VERSION,
    recordedAt: new Date().toISOString(),
    protocol:
      'Three maintainer-authored text fixtures, two viewports, one repetition. Known wrong states are specified up front. Playwright uses independently written equivalent string predicates, not AI or an unconfigured framework. Audit is offline string simulation, corroborated by separate real-browser collection of the specified wrong states. No source mutation, visual behavior, model, human-time or comparative performance measurement.',
    fixtures,
    sourceHashes: hashes,
    artifacts,
    summary: {
      uniqueKnownWrongStates: 3,
      viewportObservationsPerState: 2,
      weakKnownWrongPassed: 6,
      strongKnownWrongPassed: 0,
      offlineExtraRequests: requestCount - requestsBeforeAudit,
    },
    playwright: baseline,
    liveRuns: [weak, strong, liveWrongWeak, liveWrongStrong].map((r) => ({
      runId: r.runId,
      requirements: r.requirements.map(({ id, status }) => ({ id, status })),
    })),
    weakAudit,
    strongAudit,
  };
  const raw = JSON.stringify(result, null, 2) + '\n';
  await writeFile(path.join(directory, 'results.json'), raw);
  if (process.env.SHIPLENS_RECORD_CHECK_AUDIT === '1')
    await writeFile('apps/docs/public/check-audit/results.json', raw);
  console.log(JSON.stringify({ directory, ...result.summary }));
} finally {
  await browser.close();
  server.closeAllConnections();
  server.close();
}
