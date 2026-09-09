import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOptions, crawlUrl, redact, fingerprint, compareBaseline } from '../src/options.js';
import { htmlReport } from '../src/report.js';

test('validates scope, numeric limits and protocols', () => {
  assert.equal(validateOptions({ url: 'http://localhost:3000', maxPages: '3' }).maxPages, 3);
  for (const options of [
    { url: 'file:///etc/passwd' },
    { url: 'http://u:p@localhost' },
    { url: 'http://localhost', maxPages: 0 },
    { url: 'http://localhost', settle: -1 },
    { url: 'http://localhost', viewport: 'tablet' },
    { url: 'http://localhost', exclude: ['admin'] },
  ])
    assert.throws(() => validateOptions(options));
});
test('crawl stays same-origin and excludes mutations, files and configured paths', () => {
  const origin = 'http://localhost:3000';
  const next = (href) => crawlUrl(href, origin + '/start', origin, ['/private']);
  assert.equal(next('/hello#title'), origin + '/hello');
  assert.equal(next('/hello?q=1'), origin + '/hello?q=1');
  assert.equal(next('/#/settings'), origin + '/#/settings');
  assert.equal(next('/#!/settings'), origin + '/#!/settings');
  for (const href of [
    'https://example.com',
    'mailto:test@example.com',
    'javascript:alert(1)',
    '/logout',
    '/a/delete/1',
    '/archive.pdf',
    '/private/a',
  ])
    assert.equal(next(href), null, href);
});
test('redacts common secret query parameters and bearer strings', () => {
  const result = redact('https://app.test/?access_token=abc&api_key=def&page=1 Bearer secret');
  assert.ok(!result.includes('abc'));
  assert.ok(!result.includes('def'));
  assert.ok(!result.includes('Bearer secret'));
  assert.ok(result.includes('page=1'));
});
test('baseline distinguishes changed scope from proof of resolution', () => {
  const f = {
    code: 'runtime-error',
    url: 'http://localhost/a',
    viewport: 'mobile',
    subject: 'error',
  };
  const id = fingerprint(f);
  assert.equal(id, fingerprint({ ...f, title: 'new wording' }));
  const comparison = compareBaseline([{ fingerprint: id }], {
    schemaVersion: 1,
    findings: [{ fingerprint: 'old' }],
  });
  assert.deepEqual(comparison, { new: [id], unchanged: [], absent: ['old'] });
  assert.throws(() => compareBaseline([], { schemaVersion: 3, findings: [] }));
});
test('HTML report escapes untrusted evidence and disallows injected screenshot paths', () => {
  const report = {
    target: '<script>alert(1)</script>',
    completedAt: 'today',
    durationMs: 1,
    summary: { pages: 1, errors: 1, warnings: 0, incomplete: 0 },
    findings: [
      {
        severity: 'error',
        title: '<img src=x onerror=alert(1)>',
        code: 'test',
        detail: '</script>',
        url: 'http://test',
        viewport: 'mobile',
        screenshot: 'javascript:alert(1)',
        fingerprint: '123',
      },
    ],
    skipped: [],
  };
  const html = htmlReport(report);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('&lt;script&gt;'));
});
