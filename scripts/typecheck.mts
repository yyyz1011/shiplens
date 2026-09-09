import { scan, validateOptions, compareBaseline, type Report } from '../packages/cli/src/index.js';
const options = validateOptions({
  url: 'http://localhost:3000',
  pages: ['/#/dashboard'],
  storageState: 'state.json',
  allowRequests: [{ method: 'POST', path: '/api/query' }],
  mask: ['.secret'],
  flows: [
    {
      name: 'search',
      page: '/',
      steps: [
        { action: 'fill', selector: '#q', value: 'Kyoto' },
        { action: 'press', selector: '#q', key: 'Enter' },
        { action: 'expectText', selector: '#result', value: 'Kyoto' },
      ],
    },
  ],
  ignore: [{ rule: 'console-error', page: '/', reason: 'Tracked issue', expires: '2099-01-01' }],
  lang: 'en',
});
const checked: Promise<Report> = scan(options);
void checked.then((report) => {
  const suppressed: number = report.summary.suppressed;
  const stepStatus: 'passed' | 'failed' | 'skipped' | undefined =
    report.pages[0]?.checks[0]?.steps?.[0]?.status;
  void [suppressed, stepStatus];
  const n: number = report.summary.incomplete;
  return compareBaseline(report.findings, report).absent.length + n;
});
// @ts-expect-error Unsupported request method must be caught in consumers.
validateOptions({ url: 'http://localhost', allowRequests: [{ method: 'CONNECT', path: '/' }] });

// @ts-expect-error Fill steps must include a value.
const invalidStep: import('../packages/cli/src/index.js').InteractionStep = {
  action: 'fill',
  selector: 'input',
};
void invalidStep;

import {
  ReviewWorkspace,
  type Requirement,
  type ReviewRun,
  type EvidenceResult,
} from 'shiplens/review';
const review = new ReviewWorkspace({
  directory: '.shiplens/reviews',
  options: { url: 'http://localhost:3000', captureDom: true },
});
const requirement: Requirement = {
  id: 'heading',
  description: 'Heading is visible',
  page: '/',
  viewports: ['desktop'],
};
const reviewRun: Promise<ReviewRun> = review.collect({ requirements: [requirement] });
const reviewEvidence: Promise<EvidenceResult> = review.readEvidence({
  runId: 'id',
  evidenceId: 'e_id',
});
void reviewRun;
void reviewEvidence;
review.assess({
  runId: 'id',
  criterionId: 'heading',
  status: 'needs-evidence',
  evidenceIds: [],
  note: 'Need mobile evidence',
});
review.getRun('id');
review.saveCase({ runId: 'id', name: 'Heading' });
review.recheck({ caseId: 'id', inputs: { input_1: 'test' } });

const cancellation = new AbortController();
scan(options, { signal: cancellation.signal });
review.collect(
  { requirements: [{ ...requirement, selector: 'h1' }] },
  { signal: cancellation.signal, timeoutMs: 180000, onProgress: console.log },
);
review.getStatus();
review.cancel();
review.listCases({ tag: 'smoke', limit: 10 });
review.listRuns();
review.getCase('id');
review.updateCase({ caseId: 'id', tags: ['critical'] });
review.exportCase({ caseId: 'id' }).then((data) => review.importCase({ data }));
review.compareRuns({ runId: 'id', previousRunId: 'id' });
review.exportReport({ runId: 'id', previousRunId: 'id', format: 'html', lang: 'zh' });
review.gate({ runId: 'id', failOn: 'warning' });
review.exportCase({ caseId: 'id' }).then(async (data) => {
  const info = review.validatePlan({ data });
  const digest: string = info.sha256;
  const verified = await review.verify({ data, format: 'json', inputs: {} }, { timeoutMs: 180000 });
  const passed: boolean = verified.gate.passed;
  if (verified.next) review.reviewPacket(verified.next.input);
  void digest;
  void passed;
});
// @ts-expect-error Unsupported gate thresholds must fail in consumers.
review.gate({ runId: 'id', failOn: 'none' });

review
  .saveCase({ runId: 'id', name: 'Legacy signature' })
  .then((saved) => review.getRun(saved.sourceRunId));

review.collect({
  requirements: [
    { ...requirement, checks: [{ operator: 'equals', value: 'Checkout' }], evaluation: 'checks' },
  ],
});
review.reviewPacket({ runId: 'id', limit: 6, maxBytes: 2097152 }).then((packet) => {
  const next: number | null = packet.nextOffset;
  const state: string | undefined = packet.requirements[0]?.verification?.status;
  void next;
  void state;
});
review.collect({
  // @ts-expect-error Checks do not accept executable scripts or regular expressions.
  requirements: [{ ...requirement, checks: [{ operator: 'regex', value: '.*' }] }],
});

review
  .auditChecks({
    runId: 'id',
    criterionIds: ['heading'],
    limit: 2,
    counterexamples: [{ criterionId: 'heading', label: 'Wrong state', text: 'Loading…' }],
  })
  .then((audit) => {
    const next: number | null = audit.nextOffset;
    const scope: 'offline-text-counterexamples' = audit.scope;
    const result: 'caught' | 'survived' | 'unchanged' = audit.items[0].samples[0].probes[0].result;
    void [next, scope, result];
  });
// @ts-expect-error Custom counterexamples require an explanatory label.
review.auditChecks({ runId: 'id', counterexamples: [{ criterionId: 'heading', text: 'bad' }] });

const deliveryContract: import('shiplens/review').DeliveryContract = {
  schemaVersion: 1,
  kind: 'shiplens-delivery',
  name: 'Save record',
  page: '/',
  referenceInput: 'reference',
  steps: [
    { action: 'fill', selector: '#reference', valueFromInput: 'reference' },
    { action: 'click', selector: '#save' },
  ],
  request: { method: 'POST', path: '/api/records' },
  readback: {
    path: '/api/records',
    items: '/items',
    reference: '/reference',
    checks: [{ pointer: '/status', equals: 'saved' }],
  },
  success: { selector: '#status', checks: [{ operator: 'equals', value: 'Saved' }] },
  failure: { selector: '#status', checks: [{ operator: 'contains', value: 'Try again' }] },
};
review.verifyDelivery({ contract: deliveryContract }).then(async (result) => {
  const passed: boolean = result.passed;
  await review.getDelivery({ deliveryId: result.deliveryId });
  const proof = await review.readDeliveryEvidence({
    deliveryId: result.deliveryId,
    viewport: 'desktop',
    phase: 'success',
  });
  const image: string = proof.image.data;
  void [passed, image];
});
// @ts-expect-error Readback assertions accept JSON scalar expectations only.
deliveryContract.readback.checks.push({ pointer: '/status', equals: { value: 'saved' } });

const approvedLock = review.createPlanLock({
  data: {
    schemaVersion: 1,
    kind: 'shiplens-case',
    name: 'Approved',
    tags: [],
    requirements: [requirement],
    flows: [],
  },
});
const pinned = new ReviewWorkspace({
  directory: '.shiplens/locked',
  options: { url: 'http://localhost:3000' },
  acceptanceLock: { lock: approvedLock, sha256: approvedLock.sha256 },
});
const inspection = pinned.checkPlanLock({ data: approvedLock.plan });
const changedCount: number = inspection.totalChanges;
void changedCount;
