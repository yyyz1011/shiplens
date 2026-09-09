import { readFile } from 'node:fs/promises';
import { ReviewWorkspace } from 'shiplens/review';
const data = JSON.parse(await readFile(new URL('./locked-plan.json', import.meta.url), 'utf8'));
const config = {
  directory: process.env.SHIPLENS_EXAMPLE_OUTPUT || '.shiplens/reviews',
  options: {
    url: process.env.SHIPLENS_EXAMPLE_URL || 'http://127.0.0.1:3002',
    viewport: 'both',
    crawl: false,
    scroll: false,
    settle: 0,
    timeout: 1000,
  },
};
const host = new ReviewWorkspace(config);
// Demonstration only: production keeps the reviewed lock and its fingerprint outside agent edits.
const lock = host.createPlanLock({ data });
const locked = new ReviewWorkspace({ ...config, acceptanceLock: { lock, sha256: lock.sha256 } });
const original = await locked.verify({ data });
const weakened = structuredClone(data);
weakened.requirements[1].checks = [{ operator: 'contains', value: '¥' }];
let blocked = false;
try {
  await locked.verify({ data: weakened });
} catch (error) {
  if (error.code !== 'SHIPLENS_PLAN_LOCK_BLOCKED') throw error;
  blocked = true;
}
console.log(
  JSON.stringify({
    originalPassed: original.gate.passed,
    originalReport: original.report.file,
    changedBlocked: blocked,
    inspection: locked.checkPlanLock({ data: weakened }),
  }),
);
if (!blocked) process.exitCode = 1;
