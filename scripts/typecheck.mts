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
