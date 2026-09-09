import http from 'node:http';
import { pathToFileURL } from 'node:url';
export function planLockPage(mode = 'wrong') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Order summary</title><style>body{font:16px/1.6 system-ui;margin:40px auto;max-width:620px;padding:0 24px}h1{font-size:28px}#price{font-size:24px}.mobile-price{display:none}section{padding:20px 0;border-top:1px solid #bbb}@media(max-width:600px){${mode === 'mobile-wrong' ? '.desktop-price{display:none}.mobile-price{display:inline}' : ''}}</style></head><body><h1>Order summary</h1><p>A synthetic order for testing an approved total of ¥129.</p><section><h2>Total</h2><p id="price"><span class="desktop-price">${mode === 'healthy' || mode === 'mobile-wrong' ? '¥129' : '¥999'}</span><span class="mobile-price">¥999</span></p></section><section><h2>Reference only</h2><p id="reference">¥129</p></section></body></html>`;
}
export async function startPlanLockDemo({ mode = 'wrong', port = 0 } = {}) {
  let requests = 0;
  const server = http.createServer((req, res) => {
    requests++;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(planLockPage(mode));
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests: () => requests,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = await startPlanLockDemo({
    mode: process.env.SHIPLENS_DEMO_MODE || 'wrong',
    port: Number(process.env.PORT || 3002),
  });
  console.log(`Example ready: ${app.url}`);
}
