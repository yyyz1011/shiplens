import { ReviewWorkspace } from 'shiplens/review';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const directory = path.resolve(process.env.SHIPLENS_EXAMPLE_OUTPUT || '.shiplens/workflow');
const workspace = new ReviewWorkspace({
  directory,
  options: {
    url: process.env.SHIPLENS_EXAMPLE_URL || 'http://127.0.0.1:3000',
    crawl: false,
    viewport: 'both',
    scroll: false,
    settle: 100,
  },
});
const run = await workspace.collect({
  requirements: [
    {
      id: 'details',
      description: 'The details show a three-day itinerary.',
      page: '/',
      flow: 'open',
      step: 1,
      selector: '#details-panel',
    },
  ],
  flows: [{ name: 'open', page: '/', steps: [{ action: 'click', selector: '#details' }] }],
});
// This fixture-only text check demonstrates the interface. It is not a visual AI judgment.
for (const e of run.evidence) {
  const proof = await workspace.readEvidence({ runId: run.runId, evidenceId: e.evidenceId });
  if (!proof.observation?.text.includes('Three-day itinerary'))
    throw new Error('Expected demo fixture missing.');
}
await workspace.assess({
  runId: run.runId,
  criterionId: 'details',
  status: 'pass',
  evidenceIds: run.evidence.map((e) => e.evidenceId),
  note: 'Fixture-only demonstration: the known itinerary text is present in both scoped captures.',
});
const saved = await workspace.saveCase({
  runId: run.runId,
  name: 'Itinerary details',
  tags: ['demo'],
});
await workspace.updateCase({ caseId: saved.caseId, name: 'Itinerary details smoke check' });
const portable = await workspace.exportCase({ caseId: saved.caseId });
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, 'case.json'), JSON.stringify(portable, null, 2));
const imported = await workspace.importCase({ data: portable });
const next = await workspace.recheck({ caseId: saved.caseId });
const comparison = await workspace.compareRuns({ runId: next.runId, previousRunId: run.runId });
const report = await workspace.exportReport({ runId: next.runId, previousRunId: run.runId });
const gate = await workspace.gate({ runId: next.runId });
await writeFile(
  path.join(directory, 'result.json'),
  JSON.stringify(
    {
      runId: run.runId,
      nextRunId: next.runId,
      caseId: saved.caseId,
      importedCaseId: imported.caseId,
      comparison,
      report,
      gate,
    },
    null,
    2,
  ),
);
console.log({
  report: path.join(directory, report.file),
  gate: gate.passed ? 'pass' : 'blocked',
  transition: comparison.criteria[0].transition,
  cases: (await workspace.listCases({ tag: 'demo' })).total,
  runs: (await workspace.listRuns()).total,
});
