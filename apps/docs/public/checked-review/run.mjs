import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { ReviewWorkspace } from '../../packages/cli/src/review.js';

const repetitions = Number(process.env.BENCH_REPETITIONS || 5);
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 20)
  throw new Error('Use 1–20 repetitions.');
await mkdir('artifacts', { recursive: true });
const output = path.resolve(process.env.BENCH_OUTPUT || `artifacts/checked-review-${Date.now()}`);
await mkdir(output); // An existing directory must never contaminate a new batch.
const baseline = path.join(output, 'baseline');
execFileSync(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  [
    'install',
    '--prefix',
    baseline,
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--save-exact',
    'shiplens@0.4.1',
  ],
  { stdio: 'pipe' },
);
const { ReviewWorkspace: OldWorkspace } = await import(
  pathToFileURL(path.join(baseline, 'node_modules/shiplens/src/review.js'))
);
const expectations = [
  '$19',
  'In stock',
  'Delivery included',
  'Returns accepted',
  'Continue',
  'Summary ready',
];
const criteria = expectations.map((text, i) => ({
  id: `criterion-${i}`,
  description: `Visible text equals ${text}`,
  page: '/',
  selector: `#result-${i}`,
}));
const sizes = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
let fixed = false;
const server = http.createServer((_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Controlled checkout fixture</title><style>body{font:16px system-ui;margin:24px}section{padding:8px;margin:4px;background:#eef2ff;max-width:400px}</style><h1>Checkout</h1>${expectations.map((text, i) => `<section id="result-${i}">${i === 0 && !fixed ? '$29' : text}</section>`).join('')}</html>`,
  );
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
const sha = (b) => createHash('sha256').update(b).digest('hex');
const json = (p, v) => writeFile(p, JSON.stringify(v, null, 2) + '\n');
const trials = [],
  observations = [];
let chromiumVersion;
async function plain(phase, directory) {
  const browser = await chromium.launch();
  chromiumVersion = browser.version();
  const rows = [];
  try {
    for (const [viewport, size] of Object.entries(sizes)) {
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
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      for (const [i, c] of criteria.entries()) {
        const text = (await page.locator(c.selector).innerText()).replace(/\s+/g, ' ').trim();
        const image = await page.locator(c.selector).screenshot();
        const row = {
          criterionId: c.id,
          viewport,
          status: text === expectations[i] ? 'pass' : 'fail',
          text,
          imageSha256: sha(image),
        };
        await writeFile(path.join(directory, `${phase}-${c.id}-${viewport}.png`), image);
        await json(path.join(directory, `${phase}-${c.id}-${viewport}.json`), row);
        rows.push(row);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  return rows;
}
try {
  for (let repeat = 1; repeat <= repetitions; repeat++) {
    const arms = ['playwright', '0.4.1', '0.5.0'];
    const order = [...arms.slice((repeat - 1) % 3), ...arms.slice(0, (repeat - 1) % 3)];
    for (const arm of order) {
      const directory = path.join(output, `${repeat}-${arm}`);
      await mkdir(directory);
      const trial = {
        repeat,
        arm,
        order,
        apiCalls: {},
        callerAssessments: 0,
        phases: [],
        error: null,
      };
      trials.push(trial);
      const w =
        arm === 'playwright'
          ? null
          : new (arm === '0.4.1' ? OldWorkspace : ReviewWorkspace)({
              directory,
              options: { url, crawl: false, scroll: false, settle: 0, viewport: 'both' },
            });
      const call = (method, input) => {
        trial.apiCalls[method] = (trial.apiCalls[method] || 0) + 1;
        return w[method](input);
      };
      const start = performance.now();
      let saved, before, after;
      try {
        for (const phase of ['before', 'after']) {
          fixed = phase === 'after';
          const phaseStart = performance.now();
          if (!w) {
            const rows = await plain(phase, directory);
            observations.push(...rows.map((r) => ({ repeat, arm, phase, ...r })));
          } else {
            const run =
              phase === 'before'
                ? await call('collect', {
                    requirements:
                      arm === '0.4.1'
                        ? criteria
                        : criteria.map((c, i) =>
                            i < 5
                              ? {
                                  ...c,
                                  evaluation: 'checks',
                                  checks: [{ operator: 'equals', value: expectations[i] }],
                                }
                              : c,
                          ),
                  })
                : await call('recheck', { caseId: saved.caseId });
            if (phase === 'before') before = run;
            else after = run;
            const proof = [];
            if (arm === '0.4.1') {
              for (const e of run.evidence)
                proof.push(
                  await call('readEvidence', { runId: run.runId, evidenceId: e.evidenceId }),
                );
            } else {
              let offset = 0;
              do {
                const packet = await call('reviewPacket', { runId: run.runId, offset });
                if (packet.items.some((p) => p.readSeparately))
                  throw new Error('Fixture evidence exceeded packet budget.');
                proof.push(...packet.items);
                offset = packet.nextOffset;
              } while (offset !== null);
            }
            for (const [i, c] of criteria.entries()) {
              if (arm === '0.5.0' && i < 5) continue;
              const evidence = proof.filter((p) => p.evidence.criterionIds.includes(c.id));
              if (evidence.length !== 2) throw new Error('Both devices required.');
              await call('assess', {
                runId: run.runId,
                criterionId: c.id,
                status: evidence.every(
                  (p) => p.observation.text.replace(/\s+/g, ' ').trim() === expectations[i],
                )
                  ? 'pass'
                  : 'fail',
                evidenceIds: evidence.map((p) => p.evidence.evidenceId),
                note: 'Synthetic protocol: scripted exact-text caller assessment, not a model judgment or visual review.',
              });
              trial.callerAssessments++;
            }
            if (phase === 'before')
              saved = await call('saveCase', { runId: run.runId, name: 'Controlled checkout' });
          }
          trial.phases.push({ phase, ms: performance.now() - phaseStart });
        }
        if (w) trial.gatePassed = (await call('gate', { runId: after.runId })).passed;
        trial.ms = performance.now() - start;
        // Artifact export and safety probes are outside the timing and API-call count.
        if (w) {
          for (const [phase, run] of [
            ['before', before],
            ['after', after],
          ]) {
            const assessed = await w.getRun(run.runId);
            for (const e of run.evidence) {
              const p = await w.readEvidence({ runId: run.runId, evidenceId: e.evidenceId });
              const i = Number(e.criterionIds[0].split('-')[1]);
              const text = p.observation.text.replace(/\s+/g, ' ').trim();
              const image = Buffer.from(p.image.data, 'base64');
              const criterion = assessed.requirements.find((r) => r.id === e.criterionIds[0]);
              const checks = criterion.verification?.results.filter(
                (r) => r.viewport === e.viewport,
              );
              const actualStatus = checks
                ? checks.every((r) => r.status === 'pass')
                  ? 'pass'
                  : checks.some((r) => r.status === 'fail')
                    ? 'fail'
                    : 'needs-evidence'
                : criterion.status;
              const row = {
                repeat,
                arm,
                phase,
                criterionId: e.criterionIds[0],
                viewport: e.viewport,
                status: actualStatus,
                oracleStatus: text === expectations[i] ? 'pass' : 'fail',
                text,
                imageSha256: sha(image),
              };
              observations.push(row);
              await writeFile(
                path.join(directory, `${phase}-${row.criterionId}-${row.viewport}.png`),
                image,
              );
            }
          }
          try {
            await w.assess({
              runId: before.runId,
              criterionId: 'criterion-0',
              status: 'pass',
              evidenceIds: before.evidence
                .filter((e) => e.criterionIds.includes('criterion-0'))
                .map((e) => e.evidenceId),
              note: 'Deliberately false pass probe, not an honest judgment.',
            });
            trial.falsePassRejected = false;
          } catch {
            trial.falsePassRejected = true;
          }
        }
      } catch (error) {
        trial.error = error.message;
        trial.ms ??= performance.now() - start;
      }
      trial.totalApiCalls = Object.values(trial.apiCalls).reduce((a, b) => a + b, 0);
      console.log(
        `${repeat}/${repetitions} ${arm}: ${trial.error || `${trial.ms.toFixed(0)} ms, ${trial.totalApiCalls} review API calls`}`,
      );
    }
  }
} finally {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
const median = (xs) => {
  const a = [...xs].sort((a, b) => a - b);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const summary = Object.fromEntries(
  ['playwright', '0.4.1', '0.5.0'].map((arm) => {
    const ts = trials.filter((t) => t.arm === arm),
      rows = observations.filter((r) => r.arm === arm);
    return [
      arm,
      {
        trials: ts.length,
        failedTrials: ts.filter((t) => t.error).length,
        medianCycleMs: median(ts.map((t) => t.ms)),
        minCycleMs: Math.min(...ts.map((t) => t.ms)),
        maxCycleMs: Math.max(...ts.map((t) => t.ms)),
        reviewApiCallsPerCycle:
          arm === 'playwright' ? null : median(ts.map((t) => t.totalApiCalls)),
        callerAssessmentsPerCycle:
          arm === 'playwright' ? null : median(ts.map((t) => t.callerAssessments)),
        observations: rows.length,
        missed: rows.filter(
          (r) => r.phase === 'before' && r.criterionId === 'criterion-0' && r.status !== 'fail',
        ).length,
        falseAlarms: rows.filter(
          (r) => !(r.phase === 'before' && r.criterionId === 'criterion-0') && r.status !== 'pass',
        ).length,
        falsePassRejections:
          arm === 'playwright' ? null : ts.filter((t) => t.falsePassRejected).length,
      },
    ];
  }),
);
const metadata = {
  id: 'checked-review-v1',
  timestamp: new Date().toISOString(),
  node: process.version,
  cpu: os.cpus()[0].model,
  platform: `${os.platform()}/${os.arch()}`,
  chromium: chromiumVersion,
  repetitions,
  runnerSha256: sha(await readFile(new URL(import.meta.url))),
  sourceBaseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  candidate: JSON.parse(await readFile(new URL('../../packages/cli/package.json', import.meta.url)))
    .version,
  baseline: 'npm shiplens@0.4.1',
  model: null,
  disclosure:
    'Author-run synthetic protocol test. Five explicitly configured text requirements and one deliberately unasserted text requirement. Caller assessments are scripted, not model evaluations. API calls are SDK/MCP-operation counts, not model calls, tokens or a lower bound on calls with custom wrappers. Playwright already supports reusable assertions. Different output scopes; no overall superiority or accuracy claim. Browser startup, evidence, judgments, case save and final gate timed; package installation, exports and safety probes excluded. Sequential arms rotate order; no warmup exclusion. Engine source changes relative to sourceBaseCommit must be obtained from the release containing this runner.',
};
await json(path.join(output, 'results.json'), { metadata, summary, trials, observations });
console.log(JSON.stringify({ output, summary }, null, 2));
if (trials.some((t) => t.error) || Object.values(summary).some((s) => s.missed || s.falseAlarms))
  process.exitCode = 1;
