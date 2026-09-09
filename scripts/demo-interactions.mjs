import http from 'node:http';
import { cp, mkdir, rm } from 'node:fs/promises';
import { demoHandler } from '../packages/cli/examples/server.mjs';
import { scan } from '../packages/cli/src/index.js';
const server = http.createServer(demoHandler);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
try {
  const report = await scan({
    url: `http://127.0.0.1:${server.address().port}`,
    crawl: false,
    scroll: false,
    viewport: 'desktop',
    timeout: 1000,
    settle: 50,
    output: 'artifacts/interaction-demo',
    flows: [
      {
        name: 'search-and-details',
        page: '/',
        steps: [
          { action: 'fill', selector: '#query', value: 'Kyoto' },
          { action: 'press', selector: '#query', key: 'Enter' },
          { action: 'expectText', selector: '#result', value: 'Kyoto' },
          { action: 'click', selector: '#details' },
        ],
      },
      {
        name: 'broken-button',
        page: '/',
        steps: [
          { action: 'click', selector: '#broken' },
          { action: 'expectText', selector: '#result', value: 'Saved' },
          { action: 'click', selector: '#details' },
        ],
      },
      { name: 'known-diagnostic', page: '/', steps: [{ action: 'click', selector: '#known' }] },
    ],
    ignore: [
      {
        rule: 'console-error',
        page: '/',
        messageIncludes: 'Demo known diagnostic',
        reason: 'Synthetic known diagnostic used to demonstrate precise ignores',
        expires: '2099-01-01',
      },
    ],
  });
  const output = 'apps/docs/public/interaction-example';
  await mkdir(output, { recursive: true });
  await rm(output, { recursive: true, force: true });
  await cp(report.runDirectory, output, { recursive: true });
  console.log(report.summary);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
