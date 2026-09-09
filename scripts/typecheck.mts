import { scan, validateOptions, compareBaseline, type Report } from '../packages/cli/src/index.js';
const options = validateOptions({
  url: 'http://localhost:3000',
  pages: ['/#/dashboard'],
  storageState: 'state.json',
  allowRequests: [{ method: 'POST', path: '/api/query' }],
  mask: ['.secret'],
  lang: 'en',
});
const checked: Promise<Report> = scan(options);
void checked.then((report) => {
  const n: number = report.summary.incomplete;
  return compareBaseline(report.findings, report).absent.length + n;
});
// @ts-expect-error Unsupported request method must be caught in consumers.
validateOptions({ url: 'http://localhost', allowRequests: [{ method: 'CONNECT', path: '/' }] });
