import http from 'node:http';
import { pathToFileURL } from 'node:url';

// A local, synthetic application for trying the documented interaction examples.
export function demoHandler(req, res) {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ShipLens interaction example</title>
<style>body{font:16px system-ui;margin:40px auto;padding:0 24px;max-width:650px;line-height:1.6}input,select,button{font:inherit;padding:10px;max-width:100%;box-sizing:border-box}form{display:grid;gap:12px}button{cursor:pointer}#details-panel{padding:16px;background:#eef2ff}section{margin-top:28px}</style></head><body>
<h1>Try a delivery check</h1><p>A local example with a working search and an intentionally broken button.</p>
<form id="search"><label for="query">Destination</label><input id="query" name="query"><label for="category">Category</label><select id="category"><option value="all">All</option><option value="guides">Guides</option></select><button type="submit">Search</button></form>
<p id="result" hidden></p><button id="details" type="button">Toggle details</button><div id="details-panel" hidden>Three-day itinerary with walking routes.</div>
<section><button id="broken" type="button">Intentionally broken action</button><button id="known" type="button">Emit known diagnostic</button></section>
<script>
document.querySelector('#search').addEventListener('submit',event=>{event.preventDefault();const result=document.querySelector('#result');result.textContent=document.querySelector('#query').value+' / '+document.querySelector('#category').value;result.hidden=false;});
document.querySelector('#details').onclick=()=>{const panel=document.querySelector('#details-panel');panel.hidden=!panel.hidden;};
document.querySelector('#broken').onclick=()=>{throw new Error('Demo interaction error');};
document.querySelector('#known').onclick=()=>console.error('Demo known diagnostic');
</script></body></html>`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  http
    .createServer(demoHandler)
    .listen(port, '127.0.0.1', () => console.log(`Example ready: http://127.0.0.1:${port}`));
}
