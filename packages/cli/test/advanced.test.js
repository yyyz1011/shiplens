import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { scan } from '../src/index.js';
import { compareReports, validateOptions, requestAllowed } from '../src/options.js';

async function fixture() {
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push({ url: req.url, method: req.method });
    res.setHeader('content-type', 'text/html;charset=utf-8');
    const html = (body) =>
      res.end(
        `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Advanced fixture</title></head><body>${body}</body></html>`,
      );
    if (req.url === '/private')
      return html(
        req.headers.cookie?.includes('session=ok')
          ? '<h1>Private content ready</h1>'
          : '<script>throw Error("Missing auth")</script>',
      );
    if (req.url === '/data') {
      res.setHeader('content-type', 'application/json');
      return res.end('{"ok":true}');
    }
    if (req.url === '/post')
      return html(
        '<h1>Data app</h1><script>fetch("/data",{method:"POST"}).then(r=>r.json()).then(()=>document.body.insertAdjacentHTML("beforeend","<p id=ready>Ready</p>")).catch(()=>{})</script>',
      );
    if (req.url === '/slow')
      return html(
        '<div id="app"></div><script>setTimeout(()=>document.getElementById("app").innerHTML="<h1 id=ready>Loaded later</h1>",250)</script>',
      );
    if (req.url === '/hidden')
      return html('<p style="display:none">Hidden text must not make an empty page pass.</p>');
    if (req.url === '/scroll')
      return html(
        '<h1>Lazy content</h1><div style="height:1200px"></div><div id="lazy"></div><script>addEventListener("scroll",()=>{if(scrollY>200&&!document.querySelector("img"))document.getElementById("lazy").innerHTML="<img style=width:120px;height:80px src=/missing.png alt=missing>"})</script>',
      );
    if (req.url === '/missing.png') {
      res.statusCode = 404;
      return res.end('missing');
    }
    if (req.url === '/intentional-scroll')
      return html(
        '<h1>Carousel</h1><div style="max-width:100%;overflow-x:auto"><div style="width:1800px">Wide carousel</div></div>',
      );
    if (req.url === '/tall') return html('<h1>Tall page</h1><div style="height:8000px">Tall</div>');
    if (req.url === '/sensitive')
      return html(
        '<h1>Sensitive test fixture</h1><p id="secret">FAKE-SECRET-FOR-TEST</p><input type="password" value="NOT-A-REAL-PASSWORD">',
      );
    if (req.url.startsWith('/hash'))
      return html(
        '<h1 id="route"></h1><a href="#/one">One</a><a href="#/two">Two</a><script>function render(){document.getElementById("route").textContent=location.hash||"home";if(location.hash==="#/two")throw Error("Hash route failure")};addEventListener("hashchange",render);render()</script>',
      );
    return html(
      '<h1>Healthy</h1><a href="/slow">Slow</a><a href="/report.json" download>Download</a>',
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const output = await mkdtemp(path.join(tmpdir(), 'shiplens-advanced-'));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    hits,
    output,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await rm(output, { recursive: true, force: true });
    },
  };
}
async function withFixture(fn) {
  const f = await fixture();
  try {
    await fn(f);
  } finally {
    await f.close();
  }
}
const options = (f) => ({
  url: f.url,
  output: f.output,
  viewport: 'desktop',
  settle: 50,
  crawl: false,
  scroll: false,
});

test('explicit pages and hash routes are actually inspected', () =>
  withFixture(async (f) => {
    const r = await scan({
      ...options(f),
      url: f.url + '/hash#/one',
      pages: ['/hash#/two'],
      maxPages: 2,
    });
    assert.equal(r.pages.length, 2);
    assert.ok(r.findings.some((x) => x.code === 'runtime-error' && x.url.endsWith('#/two')));
    const crawl = await scan({
      ...options(f),
      url: f.url + '/hash#/one',
      crawl: true,
      maxPages: 5,
    });
    assert.equal(crawl.pages.length, 2);
  }));
test('storage state enables authenticated pages without exporting cookies', () =>
  withFixture(async (f) => {
    const state = path.join(f.output, 'state.json');
    await writeFile(
      state,
      JSON.stringify({
        cookies: [
          {
            name: 'session',
            value: 'ok',
            domain: '127.0.0.1',
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      }),
    );
    const r = await scan({ ...options(f), url: f.url + '/private', storageState: state });
    assert.equal(r.summary.errors, 0);
    const saved = await readFile(path.join(r.runDirectory, 'report.json'), 'utf8');
    assert.ok(!saved.includes('session=ok'));
    assert.ok(!saved.includes(state));
    assert.ok(!saved.includes(f.output));
  }));
test('POST allowlist is exact and supports data loading without allowing other writes', () =>
  withFixture(async (f) => {
    const o = {
      ...options(f),
      url: f.url + '/post',
      allowRequests: [{ method: 'POST', path: '/data' }],
      waitFor: '#ready',
    };
    const r = await scan(o);
    assert.equal(r.summary.incomplete, 0);
    assert.equal(r.summary.errors, 0);
    assert.ok(f.hits.some((x) => x.url === '/data' && x.method === 'POST'));
    const validated = validateOptions(o);
    assert.equal(requestAllowed('POST', f.url + '/data/other', validated), false);
    assert.equal(requestAllowed('DELETE', f.url + '/data', validated), false);
    assert.equal(requestAllowed('POST', 'https://example.com/data', validated), false);
  }));
test('ready selector handles delayed rendering and invisible text does not hide empty pages', () =>
  withFixture(async (f) => {
    const r = await scan({ ...options(f), url: f.url + '/slow', waitFor: '#ready' });
    assert.equal(r.summary.errors, 0);
    assert.equal(r.findings.length, 0);
    const empty = await scan({ ...options(f), url: f.url + '/hidden' });
    assert.ok(empty.findings.some((x) => x.code === 'page-empty'));
    const timeout = await scan({
      ...options(f),
      url: f.url + '/slow',
      waitFor: '#never',
      timeout: 1000,
    });
    assert.equal(timeout.summary.incomplete, 1);
  }));
test('scroll discovers lazy failures, merges image HTTP errors, and records element evidence', () =>
  withFixture(async (f) => {
    const r = await scan({ ...options(f), url: f.url + '/scroll', scroll: true, scrollSteps: 6 });
    const image = r.findings.find((x) => x.code === 'broken-image');
    assert.ok(image);
    assert.ok(image.elementScreenshot);
    assert.ok(
      !r.findings.some((x) => x.code === 'http-error' && x.subject.endsWith('/missing.png')),
    );
    assert.equal(r.summary.scrollLimited, 0);
  }));
test('intentional nested scrollers do not trigger document-overflow warnings', () =>
  withFixture(async (f) => {
    const r = await scan({ ...options(f), url: f.url + '/intentional-scroll', viewport: 'mobile' });
    assert.ok(!r.findings.some((x) => x.code === 'horizontal-overflow'));
  }));
test('baseline refuses to mark absent findings resolved when coverage changes', () =>
  withFixture(async (f) => {
    const first = await scan({ ...options(f), url: f.url + '/hidden' });
    const second = await scan({
      ...options(f),
      url: f.url + '/hidden',
      ignoreRules: ['page-empty'],
      baseline: path.join(first.runDirectory, 'report.json'),
    });
    assert.equal(second.comparison.comparable, false);
    assert.equal(second.comparison.absent.length, 1);
    assert.deepEqual(second.comparison.resolved, []);
    const copy = structuredClone(first);
    copy.findings = [];
    copy.summary.errors = 0;
    const same = compareReports(copy, first);
    assert.equal(same.comparable, true);
    assert.equal(same.resolved.length, 1);
    const tall = await scan({ ...options(f), url: f.url + '/tall', scroll: true, scrollSteps: 1 });
    assert.equal(tall.summary.scrollLimited, 1);
  }));
test('masking works and invalid mask selectors fail closed', () =>
  withFixture(async (f) => {
    const good = await scan({ ...options(f), url: f.url + '/sensitive', mask: ['#secret'] });
    assert.equal(good.summary.incomplete, 0);
    const bad = await scan({ ...options(f), url: f.url + '/sensitive', mask: ['[broken'] });
    assert.equal(bad.summary.incomplete, 1);
    assert.equal(bad.pages[0].checks[0].screenshot, null);
  }));
test('public API rejects malformed advanced options', () => {
  for (const extra of [
    { pages: ['https://example.com'] },
    { pages: ['/a', '/b'], maxPages: 1 },
    { allowRequests: [{ method: 'POST', path: '/data?x=1' }] },
    { mask: 'secret' },
    { crawl: 'false' },
    { scrollSteps: -1 },
    { onProgress: true },
  ])
    assert.throws(() => validateOptions({ url: 'http://localhost', ...extra }));
});
