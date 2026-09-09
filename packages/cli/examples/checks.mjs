import { ReviewWorkspace } from 'shiplens/review';
import path from 'node:path';

const workspace = new ReviewWorkspace({
  directory: path.resolve(process.env.SHIPLENS_EXAMPLE_OUTPUT || '.shiplens/checks'),
  options: {
    url: process.env.SHIPLENS_EXAMPLE_URL || 'http://127.0.0.1:3000',
    viewport: 'both',
    crawl: false,
    scroll: false,
    settle: 0,
  },
});
const run = await workspace.collect({
  requirements: [
    {
      id: 'details',
      description: 'Opened details include Three-day itinerary.',
      page: '/',
      flow: 'open',
      step: 1,
      selector: '#details-panel',
      checks: [{ operator: 'contains', value: 'Three-day itinerary' }],
      evaluation: 'checks',
    },
  ],
  flows: [{ name: 'open', page: '/', steps: [{ action: 'click', selector: '#details' }] }],
});
const saved = await workspace.saveCase({ runId: run.runId, name: 'Itinerary text regression' });
const replay = await workspace.recheck({ caseId: saved.caseId });
const packet = await workspace.reviewPacket({ runId: replay.runId });
const gate = await workspace.gate({ runId: replay.runId });
console.log({
  status: replay.requirements[0].status,
  source: replay.requirements[0].verification.source,
  callerAssessments: replay.history.length,
  unresolvedEvidence: packet.total,
  gate: gate.passed,
});
if (!gate.passed) process.exitCode = 1;
