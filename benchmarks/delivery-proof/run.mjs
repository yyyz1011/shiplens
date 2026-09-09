import path from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createDeliveryDemo } from '../../packages/cli/examples/delivery-server.mjs';
import { ReviewWorkspace } from '../../packages/cli/src/review.js';
import { VERSION } from '../../packages/cli/src/version.js';
const contract = JSON.parse(await readFile('packages/cli/examples/delivery.json', 'utf8'));
const directory = path.resolve(`artifacts/delivery-proof-${Date.now()}`);
await mkdir(directory, { recursive: true });
const record = process.env.SHIPLENS_RECORD_DELIVERY === '1';
const publicRoot = 'apps/docs/public/delivery-proof';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const cases = [],
  artifacts = [];
const browser = await chromium.launch();
try {
  for (const mode of ['healthy', 'lost-write', 'duplicate', 'false-success', 'no-request']) {
    const app = await createDeliveryDemo({ directory: path.join(directory, mode, 'app'), mode });
    try {
      const baseline = [];
      for (const viewport of ['desktop', 'mobile']) {
        const trials = [];
        for (const phase of ['success', 'failure']) {
          const reference = randomUUID();
          const ctx = await browser.newContext({
            viewport:
              viewport === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 },
          });
          const page = await ctx.newPage();
          let requests = 0;
          const statuses = [];
          await page.route('**/api/records', async (route) => {
            if (route.request().method() === 'POST') {
              requests++;
              if (phase === 'failure')
                return route.fulfill({
                  status: 503,
                  contentType: 'application/json',
                  body: '{"error":"unavailable"}',
                });
            }
            return route.continue();
          });
          page.on('response', (r) => {
            if (r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/records')
              statuses.push(r.status());
          });
          await page.goto(app.url);
          const before = (
            await (await ctx.request.get(app.url + '/api/records?reference=' + reference)).json()
          ).items;
          await page.locator('#reference').fill(reference);
          await page.locator('#save').click();
          await page.waitForFunction(
            () => document.querySelector('#status').textContent !== 'Ready',
          );
          const observedText = await page.locator('#status').innerText();
          const after = (
            await (await ctx.request.get(app.url + '/api/records?reference=' + reference)).json()
          ).items;
          const passed =
            before.length === 0 &&
            requests === 1 &&
            (phase === 'success'
              ? observedText === 'Saved' &&
                statuses.length === 1 &&
                statuses[0] >= 200 &&
                statuses[0] < 300 &&
                after.length === 1 &&
                after[0].reference === reference &&
                after[0].status === 'saved'
              : observedText.includes('Could not save') &&
                !observedText.includes('Saved') &&
                after.length === 0);
          trials.push({
            viewport,
            phase,
            reference,
            requests,
            statuses,
            beforeCount: before.length,
            afterCount: after.length,
            observedText,
            passed,
          });
          await ctx.close();
        }
        baseline.push({
          viewport,
          uiOnlyPassed: trials[0].observedText === 'Saved',
          fullContractPassed: trials.every((t) => t.passed),
          trials,
        });
      }
      const workspaceDirectory = path.join(directory, mode, 'reviews');
      const w = new ReviewWorkspace({
        directory: workspaceDirectory,
        options: {
          url: app.url,
          viewport: 'both',
          crawl: false,
          settle: 0,
          timeout: 1000,
          allowRequests: [contract.request],
        },
      });
      const result = await w.verifyDelivery({ contract });
      assert.equal(result.passed, mode === 'healthy', JSON.stringify(result));
      for (const row of baseline) {
        assert.equal(row.uiOnlyPassed, true);
        assert.equal(
          row.fullContractPassed,
          result.trials.filter((t) => t.viewport === row.viewport).every((t) => t.passed),
        );
      }
      const files = [{ source: result.report, file: `${mode}/report.html` }];
      for (const t of result.trials)
        if (t.evidence)
          for (const key of ['image', 'observation'])
            files.push({
              source: `deliveries/${result.deliveryId}/${t.evidence[key]}`,
              file: `${mode}/${t.evidence[key]}`,
            });
      for (const file of files) {
        const bytes = await readFile(path.join(workspaceDirectory, file.source));
        artifacts.push({ file: file.file, sha256: sha(bytes) });
        if (record) {
          await mkdir(path.dirname(path.join(publicRoot, file.file)), { recursive: true });
          await writeFile(path.join(publicRoot, file.file), bytes);
        }
      }
      cases.push({ mode, playwright: baseline, shiplens: result });
    } finally {
      await app.close();
    }
  }
  const sources = {};
  for (const f of [
    'benchmarks/delivery-proof/run.mjs',
    'packages/cli/examples/delivery-server.mjs',
    'packages/cli/examples/delivery.json',
    'packages/cli/src/delivery.js',
  ])
    sources[f] = sha(await readFile(f));
  const result = {
    schemaVersion: 1,
    version: VERSION,
    recordedAt: new Date().toISOString(),
    protocol:
      'One maintainer-controlled file-backed application, four deliberately implemented failure modes plus healthy control, two viewports, one repetition. UI-only baseline checks the success text. Independent full Playwright baseline performs equivalent correlation/readback/failure checks. No AI model, customer task, time, token or market measurement.',
    summary: {
      healthyViewportCases: 2,
      defectiveViewportCases: 8,
      uiOnlyFalsePasses: 8,
      playwrightFullFalsePasses: 0,
      shiplensFalsePasses: 0,
    },
    sources,
    contract,
    cases,
    artifacts,
  };
  await writeFile(path.join(directory, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  if (record)
    await writeFile(path.join(publicRoot, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ directory, ...result.summary, artifacts: artifacts.length }));
} finally {
  await browser.close();
}
