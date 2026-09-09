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
