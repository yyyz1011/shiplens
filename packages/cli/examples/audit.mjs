import { ReviewWorkspace } from 'shiplens/review';
const workspace = new ReviewWorkspace({
  directory: process.env.SHIPLENS_EXAMPLE_OUTPUT || '.shiplens/audit-example',
  options: {
    url: process.env.SHIPLENS_EXAMPLE_URL || 'http://127.0.0.1:3000',
    viewport: 'both',
    crawl: false,
    scroll: false,
    settle: 0,
  },
});
const requirement = {
  id: 'title',
  description: 'The heading is Try a delivery check',
  page: '/',
  selector: 'h1',
  evaluation: 'checks',
  checks: [{ operator: 'contains', value: 'delivery' }],
};
const run = await workspace.collect({ requirements: [requirement] });
const result = await workspace.auditChecks({
  runId: run.runId,
  counterexamples: [
    { criterionId: 'title', label: 'Known incorrect title', text: 'Broken delivery example' },
  ],
});
console.log(JSON.stringify(result));
// Survivors are advisory. Confirm the intended title with the specification,
// strengthen the requirement, collect again, then audit that new run.
