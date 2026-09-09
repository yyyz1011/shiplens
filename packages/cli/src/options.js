import { createHash } from 'node:crypto';

export const DEFAULTS = Object.freeze({
  maxPages: 10,
  timeout: 15000,
  settle: 1000,
  viewport: 'both',
  output: '.shiplens',
  exclude: [],
  pages: [],
  crawl: true,
  scroll: true,
  scrollSteps: 6,
  waitFor: '',
  allowRequests: [],
  ignoreRules: [],
  mask: [],
  flows: [],
  ignore: [],
  lang: 'en',
});
export const VIEWPORTS = Object.freeze({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
});
export const RULES = [
  'runtime-error',
  'console-error',
  'http-error',
  'request-failed',
  'broken-image',
  'horizontal-overflow',
  'page-empty',
  'navigation-failed',
  'screenshot-failed',
  'interaction-failed',
];
export const OPERATIONAL_RULES = ['navigation-failed', 'screenshot-failed', 'interaction-failed'];
export const hash = (value) => createHash('sha256').update(value).digest('hex').slice(0, 16);
const sensitive =
  /token|secret|password|credential|api[_-]?key|authorization|session|signature|cookie/i;

export function normalizeUrl(value, base) {
  const url = new URL(value, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Use an HTTP(S) URL without embedded credentials.');
  if (!/^#!?\//.test(url.hash)) url.hash = '';
  return url.href;
}
export function excluded(url, prefixes) {
  const u = new URL(url);
  const route = /^#!?\//.test(u.hash) ? u.hash.replace(/^#!/, '').replace(/^#/, '') : '';
  return prefixes.some((p) => u.pathname.startsWith(p) || route.startsWith(p));
}
export function validateOptions(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Options must be an object.');
  const o = { ...DEFAULTS, ...input };
  try {
    o.url = normalizeUrl(o.url);
  } catch {
    throw new Error('Provide an HTTP(S) URL, for example http://localhost:3000.');
  }
  for (const [key, min, max] of [
    ['maxPages', 1, 100],
    ['timeout', 1000, 120000],
    ['settle', 0, 10000],
    ['scrollSteps', 0, 30],
  ]) {
    if (typeof o[key] === 'boolean' || o[key] === null || o[key] === '')
      throw new Error(`${key} must be an integer from ${min} to ${max}.`);
    o[key] = Number(o[key]);
    if (!Number.isInteger(o[key]) || o[key] < min || o[key] > max)
      throw new Error(`${key} must be an integer from ${min} to ${max}.`);
  }
  for (const key of ['crawl', 'scroll'])
    if (typeof o[key] !== 'boolean') throw new Error(`${key} must be a boolean.`);
  if (!['desktop', 'mobile', 'both'].includes(o.viewport))
    throw new Error('viewport must be desktop, mobile or both.');
  if (!['en', 'zh'].includes(o.lang)) throw new Error('lang must be en or zh.');
  if (typeof o.output !== 'string' || !o.output.trim())
    throw new Error('output must be a directory path.');
  for (const key of ['exclude', 'pages', 'ignoreRules', 'mask'])
    if (!Array.isArray(o[key]) || o[key].some((x) => typeof x !== 'string' || !x.trim()))
      throw new Error(`${key} must be an array of nonempty strings.`);
  if (o.exclude.some((p) => !p.startsWith('/')))
    throw new Error('exclude entries must start with /.');
  if (excluded(o.url, o.exclude))
    throw new Error('The entry URL is excluded by the configuration.');
  if (o.ignoreRules.some((r) => !RULES.includes(r) || OPERATIONAL_RULES.includes(r)))
    throw new Error('ignoreRules contains an unknown or operational rule.');
  if (typeof o.waitFor !== 'string') throw new Error('waitFor must be a CSS selector.');
  for (const key of ['baseline', 'storageState'])
    if (o[key] !== undefined && (typeof o[key] !== 'string' || !o[key]))
      throw new Error(`${key} must be a file path.`);
  if (o.onProgress !== undefined && typeof o.onProgress !== 'function')
    throw new Error('onProgress must be a function.');
  if (
    !Array.isArray(o.allowRequests) ||
    o.allowRequests.some(
      (r) =>
        !r ||
        typeof r !== 'object' ||
        !['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method) ||
        typeof r.path !== 'string' ||
        !r.path.startsWith('/') ||
        r.path.includes('?') ||
        r.path.includes('#'),
    )
  )
    throw new Error(
      'allowRequests requires { method: "POST", path: "/api/search" } entries. Paths match exactly on the target origin.',
    );
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
  const nonempty = (value) => typeof value === 'string' && !!value.trim();
  const keys = (value, allowed) => Object.keys(value).every((key) => allowed.includes(key));
  const samePage = (page) => {
    if (!nonempty(page)) throw new Error('Flow and ignore pages must be nonempty URLs or paths.');
    const value = normalizeUrl(page, o.url);
    if (new URL(value).origin !== new URL(o.url).origin || excluded(value, o.exclude))
      throw new Error('Flow and ignore pages must be same-origin and not excluded.');
    return value;
  };
  if (!Array.isArray(o.flows) || o.flows.length > 20)
    throw new Error('flows must be an array of up to 20 flows.');
  const names = new Set();
  o.flows = o.flows.map((flow) => {
    if (
      !object(flow) ||
      !keys(flow, ['name', 'page', 'steps']) ||
      !nonempty(flow.name) ||
      flow.name.length > 80 ||
      names.has(flow.name) ||
      !Array.isArray(flow.steps) ||
      !flow.steps.length ||
      flow.steps.length > 30
    )
      throw new Error('Each flow needs a unique name (1–80 characters), page and 1–30 steps.');
    names.add(flow.name);
    const steps = flow.steps.map((step) => {
      const fields = {
        click: [],
        fill: ['value'],
        press: ['key'],
        select: ['value'],
        waitFor: ['state'],
        expectText: ['value'],
      };
      if (
        !object(step) ||
        !Object.hasOwn(fields, step.action) ||
        !nonempty(step.selector) ||
        !keys(step, ['action', 'selector', 'timeout', ...fields[step.action]])
      )
        throw new Error(
          'Each step needs a supported action and selector, with only action-specific fields.',
        );
      if (['fill', 'select', 'expectText'].includes(step.action) && typeof step.value !== 'string')
        throw new Error('fill, select and expectText require a string value.');
      if (step.action === 'expectText' && !step.value.trim())
        throw new Error('expectText value must be nonempty.');
      if (step.action === 'press' && !nonempty(step.key)) throw new Error('press requires a key.');
      if (
        step.action === 'waitFor' &&
        step.state !== undefined &&
        !['visible', 'hidden'].includes(step.state)
      )
        throw new Error('waitFor state must be visible or hidden.');
      if (
        step.timeout !== undefined &&
        (!Number.isInteger(step.timeout) || step.timeout < 1000 || step.timeout > 120000)
      )
        throw new Error('Step timeout must be an integer from 1000 to 120000.');
      return { ...step };
    });
    return { name: flow.name, page: samePage(flow.page), steps };
  });
  if (!Array.isArray(o.ignore) || o.ignore.length > 200)
    throw new Error('ignore must be an array of up to 200 entries.');
  o.ignore = o.ignore.map((entry) => {
    const scopes = ['page', 'viewport', 'selector', 'messageIncludes', 'fingerprint'];
    if (
      !object(entry) ||
      !keys(entry, ['rule', 'reason', 'expires', ...scopes]) ||
      !RULES.includes(entry.rule) ||
      OPERATIONAL_RULES.includes(entry.rule) ||
      !nonempty(entry.reason) ||
      !scopes.some((key) => entry[key] !== undefined)
    )
      throw new Error(
        'Each ignore entry needs a non-operational rule, reason and at least one match field.',
      );
    for (const key of scopes)
      if (entry[key] !== undefined && !nonempty(entry[key]))
        throw new Error('Ignore match fields must be nonempty strings.');
    if (entry.viewport !== undefined && !['desktop', 'mobile'].includes(entry.viewport))
      throw new Error('Ignore viewport must be desktop or mobile.');
    if (entry.fingerprint !== undefined && !/^[a-f0-9]{16}$/.test(entry.fingerprint))
      throw new Error('Ignore fingerprint must be a 16-character ShipLens fingerprint.');
    if (
      entry.expires !== undefined &&
      (typeof entry.expires !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires) ||
        !Number.isFinite(Date.parse(entry.expires)) ||
        new Date(entry.expires).toISOString().slice(0, 10) !== entry.expires)
    )
      throw new Error('Ignore expires must be a valid YYYY-MM-DD UTC date.');
    return { ...entry, ...(entry.page ? { page: samePage(entry.page) } : {}) };
  });
  o.pages = [
    ...new Set(
      [...o.pages, ...o.flows.map((flow) => flow.page)].map((p) => {
        const u = normalizeUrl(p, o.url);
        if (new URL(u).origin !== new URL(o.url).origin || excluded(u, o.exclude))
          throw new Error('Explicit pages must be same-origin and not excluded.');
        return u;
      }),
    ),
  ];
  if (new Set([o.url, ...o.pages]).size > o.maxPages)
    throw new Error('maxPages must cover all explicitly requested pages.');
  return o;
}

export function crawlUrl(href, base, origin, exclude = []) {
  try {
    const value = normalizeUrl(href, base),
      u = new URL(value);
    if (u.origin !== origin || excluded(value, exclude)) return null;
    const route = u.pathname + '/' + u.hash.replace(/^#!?/, '');
    if (
      /(?:^|\/)(?:logout|log-out|signout|sign-out|delete|remove|unsubscribe)(?:[/?#]|$)/i.test(
        route,
      )
    )
      return null;
    if (
      /\.(?:pdf|zip|gz|exe|dmg|png|jpe?g|gif|svg|webp|mp4|mp3|csv|xlsx?|docx?|json|txt|md|xml|woff2?)$/i.test(
        u.pathname,
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function redact(value) {
  return String(value)
    .replace(/([?&]([^=&\s]+)=)([^&\s#]*)/g, (all, prefix, key) =>
      sensitive.test(decodeURIComponentSafe(key)) ? prefix + '[REDACTED]' : all,
    )
    .replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+/gi, '$1[REDACTED]');
}
function decodeURIComponentSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
export function fingerprint(finding) {
  return hash(
    [
      finding.code,
      finding.url,
      finding.viewport,
      finding.subject || '',
      ...(finding.flow ? [finding.flow, finding.step ?? ''] : []),
    ].join('\n'),
  );
}
export function requestAllowed(method, url, options) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
  const u = new URL(url);
  return (
    u.origin === new URL(options.url).origin &&
    options.allowRequests.some((r) => r.method === method && r.path === u.pathname)
  );
}
export function validateBaseline(b) {
  if (
    !b ||
    ![1, 2].includes(b.schemaVersion) ||
    !Array.isArray(b.findings) ||
    b.findings.some((f) => !f || typeof f.fingerprint !== 'string')
  )
    throw new Error('Baseline must be a valid ShipLens report.json.');
}
export function compareBaseline(findings, baseline) {
  validateBaseline(baseline);
  const old = new Set(baseline.findings.map((f) => f.fingerprint)),
    current = new Set(findings.map((f) => f.fingerprint));
  return {
    new: findings.filter((f) => !old.has(f.fingerprint)).map((f) => f.fingerprint),
    unchanged: findings.filter((f) => old.has(f.fingerprint)).map((f) => f.fingerprint),
    absent: baseline.findings.filter((f) => !current.has(f.fingerprint)).map((f) => f.fingerprint),
  };
}
export function compareReports(current, baseline) {
  const result = compareBaseline(current.findings, baseline);
  const scope = (r) =>
    JSON.stringify({
      target: r.target,
      options: r.options,
      pages: r.pages
        ?.map((p) => [
          p.url,
          p.checks.map((c) => [c.viewport, c.finalUrl, ...(c.flow ? [c.flow] : [])]),
        ])
        .sort((a, b) => a[0].localeCompare(b[0])),
    });
  const comparable =
    baseline.schemaVersion === current.schemaVersion &&
    scope(current) === scope(baseline) &&
    !current.truncated &&
    !baseline.truncated &&
    current.summary.incomplete === 0 &&
    baseline.summary?.incomplete === 0;
  return {
    ...result,
    comparable,
    resolved: comparable ? result.absent : [],
    note: comparable
      ? 'Matching complete coverage. Resolved means not observed again, not proof of business correctness.'
      : 'Coverage, options, schema or completion differ. Absent findings cannot be treated as resolved.',
  };
}
