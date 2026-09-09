import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Maintainer-controlled application with a file-backed API. Never point test writes at customer data.
export async function createDeliveryDemo({ directory, mode = 'healthy', port = 0 } = {}) {
  await mkdir(directory, { recursive: true });
  const filename = path.join(directory, 'records.json');
  try {
    await readFile(filename);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(filename, '[]');
  }
  let writes = Promise.resolve(),
    mutationRequests = 0;
  const records = async () => JSON.parse(await readFile(filename, 'utf8'));
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/api/records' && req.method === 'GET') {
        if (mode === 'cookie' && !req.headers.cookie?.includes('ledgerSession=test')) {
          res.statusCode = 403;
          return res.end();
        }
        if (mode === 'redirect-readback') {
          res.statusCode = 302;
          res.setHeader('location', '/unexpected');
          return res.end();
        }
        res.setHeader('content-type', 'application/json');
        res.setHeader('cache-control', 'no-store');
        if (mode === 'invalid-readback') return res.end('{}');
        const reference = url.searchParams.get('reference');
        const items =
          mode === 'stale'
            ? [{ reference, status: 'saved' }]
            : (await records()).filter((r) => !reference || r.reference === reference);
        return res.end(JSON.stringify({ items }));
      }
      if (url.pathname === '/api/records' && req.method === 'POST') {
        mutationRequests++;
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > 8192) throw new Error('Body too large');
          chunks.push(chunk);
        }
        const body = JSON.parse(Buffer.concat(chunks).toString());
        if (typeof body.reference !== 'string' || body.reference.length > 100) {
          res.statusCode = 400;
          return res.end();
        }
        if (mode !== 'lost-write') {
          const write = writes.then(async () => {
            const items = await records();
            items.push({ id: randomUUID(), reference: body.reference, status: 'saved' });
            if (mode === 'duplicate')
              items.push({ id: randomUUID(), reference: body.reference, status: 'saved' });
            await writeFile(filename + '.tmp', JSON.stringify(items));
            await rename(filename + '.tmp', filename);
          });
          writes = write.catch(() => {});
          await write;
        }
        res.statusCode = 201;
        res.setHeader('content-type', 'application/json');
        return res.end('{"ok":true}');
      }
      if (url.pathname === '/' && req.method === 'GET') {
        if (mode === 'cookie')
          res.setHeader('set-cookie', 'ledgerSession=test; HttpOnly; SameSite=Lax');
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.end(
          `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Delivery example</title><style>body{font:16px/1.6 system-ui;max-width:640px;margin:48px auto;padding:0 24px;color:#182c47;background:#f4f7fb}h1{line-height:1.2}form{display:grid;gap:12px}input,button{font:inherit;padding:12px;border:1px solid #a5b4c7;border-radius:6px}button{cursor:pointer;color:#fff;background:#234eb0}input:focus-visible,button:focus-visible{outline:2px solid #234eb0;outline-offset:3px}#status{padding:16px 0;min-height:2em}small{color:#526981}</style><h1>Save a delivery record</h1><p>A local test app with a file-backed API.</p><form id="form"><label for="reference">Test reference</label><input id="reference" required autocomplete="off"><button id="save">Save record</button></form><p id="status" role="status">Ready</p><small>This example creates disposable test records in its configured directory.</small><script>document.querySelector('#form').onsubmit=async event=>{event.preventDefault();const state=document.querySelector('#status');try{${mode === 'no-request' ? "state.textContent='Saved';return;" : ''}const response=await fetch('/api/records',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({reference:document.querySelector('#reference').value})});if(!response.ok)throw new Error('Unavailable');state.textContent='Saved';}catch{state.textContent=${mode === 'false-success' ? "'Saved'" : "'Could not save. Try again.'"};}};</script></html>`,
        );
      }
      res.statusCode = 404;
      res.end();
    } catch {
      res.statusCode = 500;
      res.end('Example request failed');
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    records,
    mutationRequests: () => mutationRequests,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = await createDeliveryDemo({
    directory: process.env.SHIPLENS_DEMO_DATA || '.shiplens/delivery-demo-data',
    port: Number(process.env.PORT || 3001),
    mode: process.env.SHIPLENS_DEMO_MODE || 'healthy',
  });
  console.log(`Delivery example: ${app.url}`);
}
