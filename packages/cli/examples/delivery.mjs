import { readFile } from 'node:fs/promises';
import { ReviewWorkspace } from 'shiplens/review';
const workspace = new ReviewWorkspace({
  directory: process.env.SHIPLENS_EXAMPLE_OUTPUT || '.shiplens/reviews',
  options: {
    url: process.env.SHIPLENS_EXAMPLE_URL || 'http://127.0.0.1:3001',
    viewport: 'both',
    crawl: false,
    settle: 0,
    timeout: 3000,
    allowRequests: [{ method: 'POST', path: '/api/records' }],
  },
});
const contract = JSON.parse(await readFile(new URL('./delivery.json', import.meta.url), 'utf8'));
const result = await workspace.verifyDelivery({ contract });
console.log(JSON.stringify(result));
process.exitCode = result.passed ? 0 : 1;
