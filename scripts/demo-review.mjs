import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ReviewWorkspace } from '../packages/cli/src/review.js';
let fixed = false;
const server = http.createServer((_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(
    `<!doctype html><html lang="en"><title>Synthetic acceptance fixture</title><style>body{font:16px system-ui;margin:32px;color:#182c47}section{padding:24px;background:#eef2ff;max-width:480px}h2{margin:0 0 12px}</style><h1>Demo checkout</h1><section id="confirmation"><h2>${fixed ? 'Order confirmed' : 'Something went wrong'}</h2><p>${fixed ? 'Your demo order is ready.' : 'The confirmation could not be displayed.'}</p></section></html>`,
  );
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
try {
  const directory = path.resolve('artifacts/review-demo');
  const workspace = new ReviewWorkspace({
    directory,
    options: {
      url: `http://127.0.0.1:${server.address().port}`,
      crawl: false,
      scroll: false,
      viewport: 'both',
      settle: 0,
    },
  });
  const before = await workspace.collect({
    requirements: [
      {
        id: 'confirmation',
        description: 'Synthetic demo: checkout shows order confirmation.',
        page: '/',
        selector: '#confirmation',
      },
    ],
  });
  const judge = (run, status, note) =>
    workspace.assess({
      runId: run.runId,
      criterionId: 'confirmation',
      status,
      evidenceIds: run.evidence.map((e) => e.evidenceId),
      note,
    });
  await judge(
    before,
    'fail',
    'Synthetic fixture: the deliberately broken page shows an error in both captures.',
  );
  const saved = await workspace.saveCase({
    runId: before.runId,
    name: 'Synthetic checkout confirmation',
  });
  fixed = true;
  const after = await workspace.recheck({ caseId: saved.caseId });
  await judge(
    after,
    'pass',
    'Synthetic fixture: the corrected page shows Order confirmed in both captures. This is a demonstration receipt, not an independent AI evaluation.',
  );
  const result = await workspace.exportReport({ runId: after.runId, previousRunId: before.runId });
  await mkdir('apps/docs/public/review-example', { recursive: true });
  await writeFile(
    'apps/docs/public/review-example/index.html',
    await readFile(path.join(directory, result.file)),
  );
  await writeFile(
    path.join(directory, 'latest.json'),
    JSON.stringify({ before: before.runId, after: after.runId, report: result.file }, null, 2),
  );
  console.log('Synthetic before/after acceptance report generated.');
} finally {
  await new Promise((r) => server.close(r));
}
