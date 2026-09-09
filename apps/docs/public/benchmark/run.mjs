import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rm, readdir, stat } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ReviewWorkspace } from '../../packages/cli/src/review.js';

// These are deterministic text checks, NOT independent AI evaluations.
const repetitions = Number(process.env.BENCH_REPETITIONS || 5);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 20)
  throw new Error('BENCH_REPETITIONS must be 1–20.');
const output = path.resolve(process.env.BENCH_OUTPUT || `artifacts/benchmark-${Date.now()}`);
await mkdir(output, { recursive: true });
const fixtures = [
  { id: 'catalog', expected: 'Price: $19', broken: 'Price: $29', action: false },
  { id: 'signup', expected: 'Registration complete', broken: 'Please try again', action: true },
  { id: 'dashboard', expected: 'Sync complete', broken: 'Sync pending', action: false },
];
const devices = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
let fixed = false;
const server = http.createServer((req, res) => {
  const f = fixtures.find((item) => req.url === `/${item.id}`);
  if (!f) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader('content-type', 'text/html');
  res.end(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Workflow benchmark: ${f.id}</title><style>body{font:16px system-ui;margin:24px;color:#182c47}section{background:#eef2ff;padding:24px;max-width:480px}button{padding:12px}h1{font-size:28px}.mobile{display:none}@media(max-width:600px){.mobile{display:block}.desktop{display:none}}</style><h1>${f.id}</h1>${f.action ? '<button id="open" onclick="document.querySelector(\'#result\').hidden=false">Register demo account</button>' : ''}<section id="result" ${f.action ? 'hidden' : ''}>${f.id === 'dashboard' ? `<p class="desktop">${f.expected}</p><p class="mobile">${fixed ? f.expected : f.broken}</p>` : `<p>${fixed ? f.expected : f.broken}</p>`}</section></html>`,
  );
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const judge = (text, fixture) => (normalize(text) === fixture.expected ? 'pass' : 'fail');
const sha = (data) => createHash('sha256').update(data).digest('hex');
const json = async (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
async function bytes(directory) {
  let total = 0;
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    total += item.isDirectory() ? await bytes(file) : (await stat(file)).size;
  }
  return total;
}
const observations = [],
  trials = [],
  safety = [];
let browserVersion;

async function baseline(fixture, phase, directory) {
  const browser = await chromium.launch();
  browserVersion = browser.version();
  const records = [];
  try {
    for (const [viewport, size] of Object.entries(devices)) {
      const context = await browser.newContext({
        viewport: size,
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        isMobile: viewport === 'mobile',
        hasTouch: viewport === 'mobile',
        serviceWorkers: 'block',
        acceptDownloads: false,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (r) => {
        if (r.status() >= 400) errors.push(`HTTP ${r.status()}`);
      });
      await page.goto(`${origin}/${fixture.id}`, { waitUntil: 'domcontentloaded' });
      if (fixture.action) await page.locator('#open').click();
      const target = page.locator('#result');
      const text = normalize(await target.innerText());
      const screenshot = await target.screenshot({
        path: path.join(directory, `${phase}-${viewport}.png`),
      });
      const record = {
        viewport,
        text,
        status: judge(text, fixture),
        errors,
        imageSha256: sha(screenshot),
      };
      await json(path.join(directory, `${phase}-${viewport}.json`), record);
      records.push(record);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return records;
}

async function evaluate(workspace, run, fixture) {
  const records = [];
  for (const e of run.evidence) {
    const proof = await workspace.readEvidence({ runId: run.runId, evidenceId: e.evidenceId });
    const text = normalize(proof.observation?.text || '');
    records.push({
      viewport: e.viewport,
      text,
      status: judge(text, fixture),
      complete: e.complete,
      imageSha256: proof.image ? sha(Buffer.from(proof.image.data, 'base64')) : null,
    });
  }
  await workspace.assess({
    runId: run.runId,
    criterionId: fixture.id,
    status: records.every((r) => r.status === 'pass') ? 'pass' : 'fail',
    evidenceIds: run.evidence.map((e) => e.evidenceId),
    note: 'Deterministic fixture oracle: normalized visible text equals the predefined expected text on both devices. No model judgment.',
  });
  return records;
}

async function rejected(fn) {
  try {
    await fn();
    return { rejected: false };
  } catch (error) {
    return { rejected: true, message: error.message };
  }
}

try {
  for (let repeat = 1; repeat <= repetitions; repeat++) {
    for (const [index, fixture] of fixtures.entries()) {
      const order = (repeat + index) % 2 ? ['playwright', 'shiplens'] : ['shiplens', 'playwright'];
      for (const arm of order) {
        const directory = path.join(output, `${repeat}-${fixture.id}-${arm}`);
        await mkdir(directory, { recursive: true });
        const trial = { repeat, fixture: fixture.id, arm, order, phases: [], error: null };
        trials.push(trial);
        const start = performance.now();
        try {
          const workspace =
            arm === 'shiplens'
              ? new ReviewWorkspace({
                  directory,
                  options: {
                    url: `${origin}/${fixture.id}`,
                    crawl: false,
                    scroll: false,
                    viewport: 'both',
                    settle: 0,
                  },
                })
              : null;
          let before, after, saved;
          for (const phase of ['before', 'after']) {
            fixed = phase === 'after';
            const phaseStart = performance.now();
            let records;
            if (workspace) {
              const run =
                phase === 'before'
                  ? await workspace.collect({
                      requirements: [
                        {
                          id: fixture.id,
                          description: `Visible result must equal "${fixture.expected}" on both devices.`,
                          page: `/${fixture.id}`,
                          selector: '#result',
                          ...(fixture.action ? { flow: 'register', step: 1 } : {}),
                        },
                      ],
                      flows: fixture.action
                        ? [
                            {
                              name: 'register',
                              page: `/${fixture.id}`,
                              steps: [{ action: 'click', selector: '#open' }],
                            },
                          ]
                        : [],
                    })
                  : await workspace.recheck({ caseId: saved.caseId });
              if (phase === 'before') before = run;
              else after = run;
              records = await evaluate(workspace, run, fixture);
              if (phase === 'before')
                saved = await workspace.saveCase({
                  runId: run.runId,
                  name: `Benchmark ${fixture.id}`,
                });
            } else records = await baseline(fixture, phase, directory);
            const durationMs = performance.now() - phaseStart;
            trial.phases.push({ phase, durationMs });
            for (const record of records) {
              const expectedStatus =
                phase === 'after' || (fixture.id === 'dashboard' && record.viewport === 'desktop')
                  ? 'pass'
                  : 'fail';
              observations.push({
                repeat,
                fixture: fixture.id,
                arm,
                phase,
                expectedStatus,
                ...record,
              });
            }
          }
          // Timed cycle includes collection, disk evidence, deterministic verdicts and saved case.
          // Additional reports and adversarial policy probes below are timed separately.
          trial.cycleMs = performance.now() - start;
          if (workspace) {
            const reportStart = performance.now();
            const comparison = await workspace.compareRuns({
              runId: after.runId,
              previousRunId: before.runId,
            });
            const report = await workspace.exportReport({
              runId: after.runId,
              previousRunId: before.runId,
            });
            trial.reportMs = performance.now() - reportStart;
            trial.transition = comparison.criteria[0].transition;
            trial.report = path.relative(output, path.join(directory, report.file));
            const receipt = { repeat, fixture: fixture.id };
            const assessment = {
              runId: after.runId,
              criterionId: fixture.id,
              status: 'pass',
              note: 'Intentional benchmark integrity probe; not an honest semantic assessment.',
            };
            receipt.oldRunEvidence = await rejected(() =>
              workspace.assess({
                ...assessment,
                evidenceIds: before.evidence.map((e) => e.evidenceId),
              }),
            );
            receipt.missingMobile = await rejected(() =>
              workspace.assess({
                ...assessment,
                evidenceIds: after.evidence
                  .filter((e) => e.viewport === 'desktop')
                  .map((e) => e.evidenceId),
              }),
            );
            receipt.completeGate = await workspace.gate({ runId: after.runId });
            const manifest = JSON.parse(
              await readFile(path.join(directory, 'runs', after.runId, 'run.json')),
            );
            const imageFile = path.join(
              directory,
              manifest.scanDirectory,
              after.evidence[0].screenshot,
            );
            const image = await readFile(imageFile);
            await rm(imageFile);
            receipt.deletedArtifactGate = await workspace.gate({ runId: after.runId });
            await writeFile(imageFile, image);
            // Demonstrate the important limit: complete citations cannot verify a caller's reasoning.
            const originalBefore = await workspace.getRun(before.runId);
            await workspace.assess({
              ...assessment,
              runId: before.runId,
              evidenceIds: before.evidence.map((e) => e.evidenceId),
            });
            receipt.falseSemanticPassGate = await workspace.gate({ runId: before.runId });
            await workspace.assess({ ...originalBefore.requirements[0].assessment });
            const replay = await workspace.recheck({
              caseId: saved.caseId,
              previousRunId: after.runId,
            });
            receipt.freshRunStatus = replay.requirements[0].status;
            receipt.freshRunGate = await workspace.gate({ runId: replay.runId });
            safety.push(receipt);
          }
          trial.artifactBytes = await bytes(directory);
        } catch (error) {
          trial.error = error.message;
          trial.cycleMs ??= performance.now() - start;
        }
        console.log(
          `${repeat}/${repetitions} ${fixture.id} ${arm}: ${trial.error || `${trial.cycleMs.toFixed(0)} ms`}`,
        );
      }
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};
const summary = Object.fromEntries(
  ['playwright', 'shiplens'].map((arm) => {
    const records = observations.filter((r) => r.arm === arm);
    const runs = trials.filter((r) => r.arm === arm);
    return [
      arm,
      {
        observations: records.length,
        defectObservations: records.filter((r) => r.expectedStatus === 'fail').length,
        detected: records.filter((r) => r.expectedStatus === 'fail' && r.status === 'fail').length,
        missed: records.filter((r) => r.expectedStatus === 'fail' && r.status === 'pass').length,
        cleanObservations: records.filter((r) => r.expectedStatus === 'pass').length,
        falseAlarms: records.filter((r) => r.expectedStatus === 'pass' && r.status === 'fail')
          .length,
        failedTrials: runs.filter((r) => r.error).length,
        medianCycleMs: median(runs.map((r) => r.cycleMs)),
        minCycleMs: Math.min(...runs.map((r) => r.cycleMs)),
        maxCycleMs: Math.max(...runs.map((r) => r.cycleMs)),
        medianAfterMs: median(
          runs.flatMap((r) => r.phases.filter((p) => p.phase === 'after').map((p) => p.durationMs)),
        ),
      },
    ];
  }),
);
const metadata = {
  schemaVersion: 1,
  benchmark: 'synthetic-workflow-v1',
  timestamp: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  runnerSha256: sha(await readFile(new URL(import.meta.url))),
  shiplens: JSON.parse(await readFile(new URL('../../packages/cli/package.json', import.meta.url)))
    .version,
  node: process.version,
  playwright: JSON.parse(
    await readFile(new URL('../../node_modules/playwright/package.json', import.meta.url)),
  ).version,
  chromium: browserVersion,
  platform: os.platform(),
  arch: os.arch(),
  cpu: os.cpus()[0].model,
  repetitions,
  devices,
  model: null,
  tokens: null,
  dollars: null,
  warmup: 'none; installed browser reused; new browser per phase; arm order alternates',
  fixtureCount: fixtures.length,
  disclosure:
    'Package-author-run deterministic synthetic fixtures, shared exact-text oracle, no independent AI reviewer or customer projects. Timing compares different output scopes; baseline has screenshots, visible text, errors and reusable code; ShipLens also collects machine reports, manifests, assessments and a case. No accuracy, token, dollar or human-time advantage established.',
};
await json(path.join(output, 'results.json'), { metadata, summary, trials, observations, safety });
console.log(JSON.stringify({ output, summary, policyTrials: safety.length }, null, 2));
if (trials.some((r) => r.error) || observations.some((r) => r.status !== r.expectedStatus))
  process.exitCode = 1;
