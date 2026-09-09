import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ReviewWorkspace } from 'shiplens/review';

const data = JSON.parse(await readFile(new URL('./acceptance.json', import.meta.url), 'utf8'));
const workspace = new ReviewWorkspace({
  directory: path.resolve(process.env.SHIPLENS_EXAMPLE_OUTPUT || '.shiplens/verify'),
  options: {
    url: process.env.SHIPLENS_EXAMPLE_URL || 'http://127.0.0.1:3000',
    viewport: 'both',
    crawl: false,
    scroll: false,
    settle: 0,
  },
});
const plan = workspace.validatePlan({ data });
const result = await workspace.verify({ data });
console.log(JSON.stringify({ plan, ...result }, null, 2));
if (!result.gate.passed) process.exitCode = 1;
