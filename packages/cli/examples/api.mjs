import path from 'node:path';
import { scan, validateOptions, compareBaseline } from 'shiplens';

// Start examples/server.mjs first. Override SHIPLENS_EXAMPLE_URL for another test server.
const options = validateOptions({
  url: process.env.SHIPLENS_EXAMPLE_URL || 'http://127.0.0.1:3000',
  crawl: false,
  scroll: false,
  viewport: 'desktop',
  output: process.env.SHIPLENS_EXAMPLE_OUTPUT || '.shiplens',
  onProgress: ({ url, viewport, flow }) => console.log({ url, viewport, flow }),
  flows: [
    {
      name: 'open-details',
      page: '/',
      steps: [
        { action: 'click', selector: '#details' },
        { action: 'expectText', selector: '#details-panel', value: 'itinerary' },
      ],
    },
  ],
});

try {
  const before = await scan(options);
  const after = await scan({ ...options, baseline: path.join(before.runDirectory, 'report.json') });
  // This helper compares fingerprints only; it does not prove resolution.
  const changes = compareBaseline(after.findings, before);
  console.log({
    summary: after.summary,
    changes,
    coverageComparison: after.comparison,
    directory: after.runDirectory,
  });
  process.exitCode = after.summary.errors || after.summary.incomplete ? 1 : 0;
} catch (error) {
  console.error(error.message);
  process.exitCode = 2;
}
