import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { ReviewWorkspace } from '../../packages/cli/src/review.js';
import { startPlanLockDemo } from '../../packages/cli/examples/plan-lock-server.mjs';
const exec = promisify(execFile);
const root = path.resolve('artifacts/plan-lock-' + Date.now());
await mkdir(root, { recursive: true });
const approved = JSON.parse(await readFile('packages/cli/examples/locked-plan.json'));
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
// Independent custom baseline: compare definitions and viewport against a trusted approved copy.
const baselineIdentity = (plan, viewport) =>
  JSON.stringify(
    canonical({
      requirements: [...plan.requirements].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
      flows: plan.flows,
      viewport,
    }),
  );
const variants = [
  { id: 'healthy', mode: 'healthy' },
  { id: 'unfixed', mode: 'wrong' },
  {
    id: 'editorial',
    mode: 'healthy',
    edit: (p) => {
      p.name = 'Renamed display';
      p.tags = [];
      p.requirements.reverse();
    },
  },
  {
    id: 'weakened-check',
    mode: 'wrong',
    changed: true,
    edit: (p) => {
      p.requirements[1].checks = [{ operator: 'contains', value: '¥' }];
    },
  },
  {
    id: 'rewritten-expectation',
    mode: 'wrong',
    changed: true,
    edit: (p) => {
      p.requirements[1].checks[0].value = '¥999';
    },
  },
  {
    id: 'removed-requirement',
    mode: 'wrong',
    changed: true,
    edit: (p) => {
      p.requirements.pop();
    },
  },
  {
    id: 'changed-selector',
    mode: 'wrong',
    changed: true,
    edit: (p) => {
      p.requirements[1].selector = '#reference';
    },
  },
  {
    id: 'omitted-mobile-criterion',
    mode: 'mobile-wrong',
    changed: true,
    edit: (p) => {
      p.requirements[1].viewports = ['desktop'];
    },
  },
  { id: 'narrowed-host', mode: 'mobile-wrong', changed: true, viewport: 'desktop' },
];
const cases = [],
  artifacts = [];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const record = async (file, value) => {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  await writeFile(path.join(root, file), bytes);
  artifacts.push({ file, sha256: hash(bytes), bytes: bytes.length });
};
for (const variant of variants) {
  const directory = path.join(root, variant.id);
  await mkdir(directory);
  const app = await startPlanLockDemo({ mode: variant.mode });
  const current = structuredClone(approved);
  variant.edit?.(current);
  const viewport = variant.viewport || 'both';
  const options = {
    url: app.url,
    viewport: 'both',
    crawl: false,
    scroll: false,
    settle: 0,
    timeout: 1000,
  };
  const host = new ReviewWorkspace({ directory: path.join(directory, 'reviews'), options });
  const lock = host.createPlanLock({ data: approved });
  const workspace = new ReviewWorkspace({
    directory: path.join(directory, 'reviews'),
    options: { ...options, viewport },
    acceptanceLock: { lock, sha256: lock.sha256 },
  });
  try {
    const projects = (viewport === 'both' ? ['desktop', 'mobile'] : [viewport]).map((name) => ({
      name,
      use: {
        viewport: name === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 },
      },
    }));
    await writeFile(
      path.join(directory, 'playwright.config.mjs'),
      `export default ${JSON.stringify({ testDir: '.', testMatch: 'native.spec.mjs', workers: 1, reporter: 'json', timeout: 5000, projects })};`,
    );
    const source = `import { test, expect } from 'playwright/test';\nconst data=${JSON.stringify(current)};\nfor(const r of data.requirements) test(r.id,async({page},info)=>{test.skip(r.viewports && !r.viewports.includes(info.project.name),'Viewport not in current requirement');await page.goto(${JSON.stringify(app.url)}+r.page);for(const check of r.checks){if(check.operator==='equals') await expect(page.locator(r.selector)).toHaveText(check.value,{useInnerText:true,timeout:1000});else await expect(page.locator(r.selector)).toContainText(check.value,{useInnerText:true,timeout:1000});}});\n`;
    await writeFile(path.join(directory, 'native.spec.mjs'), source);
    let nativeExit = 0,
      stdout;
    try {
      ({ stdout } = await exec(
        process.execPath,
        [
          path.resolve('node_modules/playwright/cli.js'),
          'test',
          '--config',
          path.join(directory, 'playwright.config.mjs'),
        ],
        { maxBuffer: 4 * 1024 * 1024, timeout: 60000 },
      ));
    } catch (error) {
      if (error.code !== 1) throw error;
      nativeExit = 1;
      stdout = error.stdout;
    }
    const native = JSON.parse(stdout);
    const cleaned = JSON.parse(
      JSON.stringify(native)
        .replaceAll(JSON.stringify(process.execPath).slice(1, -1), '<node>')
        .replaceAll(JSON.stringify(root).slice(1, -1), '<benchmark-workspace>')
        .replaceAll(JSON.stringify(path.resolve('.')).slice(1, -1), '<repository>'),
    );
    await record(`${variant.id}/native-result.json`, cleaned);
    await record(`${variant.id}/candidate.json`, current);
    const before = app.requests();
    const inspection = workspace.checkPlanLock({ data: current });
    let run = null,
      blocked = false;
    try {
      run = await workspace.verify({ data: current, format: 'json' });
    } catch (error) {
      if (error.code !== 'SHIPLENS_PLAN_LOCK_BLOCKED') throw error;
      blocked = true;
    }
    const requests = app.requests() - before;
    assert.equal(blocked, !!variant.changed, variant.id);
    assert.equal(nativeExit, variant.id === 'unfixed' ? 1 : 0, variant.id);
    if (variant.changed) assert.equal(requests, 0, variant.id);
    else assert.equal(run.gate.passed, variant.id !== 'unfixed');
    const bespokeMatched =
      baselineIdentity(current, viewport) === baselineIdentity(approved, 'both');
    const row = {
      id: variant.id,
      mode: variant.mode,
      changedStandard: !!variant.changed,
      viewport,
      nativeExit,
      nativeStats: native.stats,
      customGuardPassed: bespokeMatched && nativeExit === 0,
      shiplens: { blockedBeforeBrowser: blocked, requests, inspection, gate: run?.gate ?? null },
    };
    assert.equal(row.customGuardPassed, variant.id === 'healthy' || variant.id === 'editorial');
    await record(`${variant.id}/lock-result.json`, row.shiplens);
    cases.push(row);
  } finally {
    await app.close();
  }
}
const changed = cases.filter((c) => c.changedStandard);
const summary = {
  changedStandards: changed.length,
  nativeSuccessfulCommandsAfterChanges: changed.filter((c) => c.nativeExit === 0).length,
  shiplensBlockedBeforeBrowser: changed.filter((c) => c.shiplens.blockedBeforeBrowser).length,
  changedStandardRequests: changed.reduce((sum, c) => sum + c.shiplens.requests, 0),
  bespokeGuardBlocked: changed.filter((c) => !c.customGuardPassed).length,
  unchangedControls: cases.length - changed.length,
};
const sources = {};
for (const file of [
  'benchmarks/plan-lock/run.mjs',
  'packages/cli/src/plan-lock.js',
  'packages/cli/src/review.js',
  'packages/cli/examples/locked-plan.json',
  'packages/cli/examples/plan-lock-server.mjs',
])
  sources[file] = hash(await readFile(file));
const result = {
  schemaVersion: 1,
  kind: 'shiplens-plan-lock-study',
  recordedAt: new Date().toISOString(),
  version: JSON.parse(await readFile('packages/cli/package.json')).version,
  playwright: JSON.parse(await readFile('node_modules/playwright/package.json')).version,
  summary,
  cases,
  sources,
  artifacts,
  note: 'Maintainer-controlled app and deliberate plan/policy edits; no AI model or customer study. Native Playwright evaluates the current tests; an independent custom approved-definition guard catches the same edits as ShipLens. Native JSON paths are replaced with placeholders. Counts are scenario commands, not assertions or a detection-accuracy ranking. Skipped project requirements remain explicit in native stats. Lock mismatch refuses execution; it is not a website failure diagnosis.',
};
await writeFile(path.join(root, 'results.json'), JSON.stringify(result, null, 2) + '\n');
if (process.env.SHIPLENS_RECORD_PLAN_LOCK === '1') {
  const target = 'apps/docs/public/plan-lock';
  await mkdir(target, { recursive: true });
  for (const file of artifacts) {
    await mkdir(path.dirname(path.join(target, file.file)), { recursive: true });
    await copyFile(path.join(root, file.file), path.join(target, file.file));
  }
  await copyFile(path.join(root, 'results.json'), path.join(target, 'results.json'));
}
console.log(JSON.stringify({ root, ...summary, artifacts: artifacts.length }));
