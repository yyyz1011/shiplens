import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ReviewWorkspace } from 'shiplens/review';

// Start node node_modules/shiplens/examples/server.mjs in a separate terminal.
const directory = path.resolve(process.env.SHIPLENS_EXAMPLE_OUTPUT || '.shiplens/demo-review');
const workspace = new ReviewWorkspace({
  directory,
  options: {
    url: process.env.SHIPLENS_EXAMPLE_URL || 'http://127.0.0.1:3000',
    crawl: false,
    scroll: false,
    viewport: 'both',
    settle: 100,
  },
});
const run = await workspace.collect({
  requirements: [
    {
      id: 'details',
      description: 'Opening details reveals the three-day itinerary.',
      page: '/',
      flow: 'open-details',
      step: 1,
    },
  ],
  flows: [{ name: 'open-details', page: '/', steps: [{ action: 'click', selector: '#details' }] }],
});
const evidence = run.evidence.filter((item) => item.criterionIds.includes('details'));
for (const item of evidence) {
  const result = await workspace.readEvidence({ runId: run.runId, evidenceId: item.evidenceId });
  console.log(item.viewport, result.observation?.text);
  // An image-capable assistant should inspect result.image as well as the text.
  // This fixture's string assertion is illustrative; it is not an AI or visual review.
  if (!result.observation?.text.includes('Three-day itinerary with walking routes.'))
    throw new Error('Demo expectation failed. Inspect the fresh evidence before assessing.');
}
await workspace.assess({
  runId: run.runId,
  criterionId: 'details',
  status: 'pass',
  evidenceIds: evidence.map((item) => item.evidenceId),
  note: 'Demo-only text assertion found the itinerary in both observations. This does not judge visual quality.',
});
const saved = await workspace.saveCase({ runId: run.runId, name: 'Itinerary details' });
const next = await workspace.recheck({ caseId: saved.caseId });
if (next.requirements.some((item) => item.status !== 'pending'))
  throw new Error('Stale assessment reused.');
const latest = await workspace.getRun(next.runId);
await writeFile(
  path.join(directory, 'demo-result.json'),
  JSON.stringify({ saved, latest }, null, 2),
);
console.log({
  caseId: saved.caseId,
  previousRunId: next.previousRunId,
  runId: next.runId,
  status: next.requirements[0].status,
  comparable: next.machine.comparison.comparable,
  directory,
});
