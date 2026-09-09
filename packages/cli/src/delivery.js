import { z } from 'zod';
import { chromium } from 'playwright';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { stepSchema } from './case-format.js';
import { checksSchema, evaluateText } from './acceptance-checks.js';
import { validateOptions, excluded, redact, VIEWPORTS } from './options.js';
import { captureObservation } from './observations.js';
import { performStep } from './interactions.js';
import { deliveryHtml } from './delivery-report.js';
import { VERSION } from './version.js';

const text = (max) => z.string().trim().min(1).max(max);
const pointer = z
  .string()
  .max(500)
  .refine((p) => p === '' || (p.startsWith('/') && !/~(?![01])/u.test(p)));
const endpoint = z
  .string()
  .min(1)
  .max(2000)
  .refine((p) => p.startsWith('/') && !p.startsWith('//') && !/[?#\\]/.test(p));
const ui = z
  .strictObject({ selector: text(2000), checks: checksSchema })
  .refine((value) => value.checks.some((check) => check.operator !== 'excludes'));
export const deliverySchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal('shiplens-delivery'),
  name: text(120),
  page: text(2000),
  referenceInput: text(80),
  steps: z.array(stepSchema).min(1).max(30),
  request: z.strictObject({ method: z.enum(['POST', 'PUT', 'PATCH']), path: endpoint }),
  readback: z.strictObject({
    path: endpoint,
    queryKey: text(80).optional(),
    items: pointer,
    reference: pointer,
    checks: z
      .array(
        z.strictObject({
          pointer,
          equals: z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null()]),
        }),
      )
      .min(1)
      .max(10),
  }),
  success: ui,
  failure: ui,
});
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, canonical(value[k])]),
        )
      : value;
export const deliveryDigest = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');

export function prepareDelivery(raw, inputs, options) {
  const parsed = deliverySchema.safeParse(raw);
  if (!parsed.success || Buffer.byteLength(JSON.stringify(raw)) > 65536)
    throw new Error(
      'Invalid delivery contract: use the documented shiplens-delivery schema (at most 64 KiB).',
    );
  const contract = parsed.data;
  if (
    !contract.page.startsWith('/') ||
    contract.page.startsWith('//') ||
    contract.page.includes('\\') ||
    redact(contract.page) !== contract.page
  )
    throw new Error('Delivery page must be a non-secret relative path.');
  const origin = new URL(options.url).origin;
  for (const p of [contract.page, contract.request.path, contract.readback.path]) {
    const url = new URL(p, origin);
    if (url.origin !== origin || excluded(url.href, options.exclude))
      throw new Error('Delivery paths must stay on the configured origin and outside exclusions.');
  }
  if (
    !options.allowRequests.some(
      (r) => r.method === contract.request.method && r.path === contract.request.path,
    )
  )
    throw new Error('The exact delivery mutation must be authorized in host allowRequests.');
  const names = [];
  const steps = contract.steps.map((step) => {
    if (step.action === 'fill') {
      if (!step.valueFromInput || step.value !== undefined || names.includes(step.valueFromInput))
        throw new Error('Delivery fills require unique valueFromInput names and no raw values.');
      names.push(step.valueFromInput);
      const { valueFromInput, ...rest } = step;
      return { ...rest, value: '' };
    }
    if (step.valueFromInput !== undefined) throw new Error('Only fill accepts valueFromInput.');
    return step;
  });
  if (!names.includes(contract.referenceInput))
    throw new Error(
      'referenceInput must name a fill input; ShipLens generates its value per trial.',
    );
  const required = names.filter((n) => n !== contract.referenceInput);
  if (
    !inputs ||
    typeof inputs !== 'object' ||
    Array.isArray(inputs) ||
    Object.keys(inputs).length !== required.length ||
    required.some(
      (k) => !Object.hasOwn(inputs, k) || typeof inputs[k] !== 'string' || inputs[k].length > 10000,
    )
  )
    throw new Error(
      'Provide exactly the required named string inputs, excluding the generated referenceInput.',
    );
  validateOptions({
    ...options,
    pages: [],
    flows: [{ name: 'delivery', page: contract.page, steps }],
  });
  return { contract, inputs: structuredClone(inputs), requiredInputs: required };
}

export function jsonPointer(value, pointer) {
  if (pointer === '') return value;
  for (const part of pointer
    .slice(1)
    .split('/')
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part))
      return undefined;
    value = value[part];
  }
  return value;
}

// Independent of application JavaScript and its fetch wrappers, caches or service workers.
async function readback(ctx, contract, options, reference, signal) {
  const url = new URL(contract.readback.path, options.url);
  if (contract.readback.queryKey) url.searchParams.set(contract.readback.queryKey, reference);
  const cookies = await ctx.cookies(url.href);
  const response = await fetch(url, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.any([signal, AbortSignal.timeout(options.timeout)]),
    headers: {
      accept: 'application/json',
      'cache-control': 'no-cache',
      ...(cookies.length ? { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') } : {}),
    },
  });
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error('Readback requires HTTP 200 without redirects.');
  }
  if (!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel();
    throw new Error('Readback requires JSON.');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1048576) throw new Error('Readback exceeds 1 MiB.');
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const rows = jsonPointer(
    JSON.parse(Buffer.concat(chunks).toString('utf8')),
    contract.readback.items,
  );
  if (!Array.isArray(rows) || rows.length > 10000)
    throw new Error('Readback must select an array of at most 10,000 records.');
  const matched = rows.filter((row) => jsonPointer(row, contract.readback.reference) === reference);
  const checks = contract.readback.checks.map((check) => {
    const actual = matched.length === 1 ? jsonPointer(matched[0], check.pointer) : undefined;
    const scalar = actual === null || ['string', 'number', 'boolean'].includes(typeof actual);
    return {
      pointer: check.pointer,
      matched: matched.length === 1 && actual === check.equals,
      ...(scalar
        ? { actual: typeof actual === 'string' ? redact(actual).slice(0, 500) : actual }
        : { actualOmitted: true }),
    };
  });
  return { status: 'complete', httpStatus: 200, count: matched.length, checks };
}
const pause = (ms, signal) =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
async function retryReadback(ctx, contract, options, reference, signal, phase) {
  const deadline = Date.now() + options.timeout;
  let latest;
  do {
    try {
      latest = await readback(ctx, contract, options, reference, signal);
    } catch {
      signal.throwIfAborted();
      return {
        status: 'unavailable',
        reason: 'Readback failed: check endpoint, cookie session, JSON shape and response budget.',
      };
    }
    if (
      phase === 'failure' ||
      latest.count > 1 ||
      (latest.count === 1 && latest.checks.every((c) => c.matched))
    )
      return latest;
    await pause(100, signal);
  } while (Date.now() < deadline);
  return latest;
}

async function captureUI(page, scope, masks, directory, base, options, signal, wait = true) {
  const locator = page.locator(scope.selector);
  if ((await locator.count()) !== 1) throw new Error('UI scope must match one element.');
  await locator.waitFor({ state: 'visible', timeout: options.timeout });
  const box = await locator.boundingBox();
  if (!box || box.width * box.height > 12000000 || box.height > 12000)
    throw new Error('UI scope exceeds image budget.');
  let observation;
  const deadline = Date.now() + options.timeout;
  do {
    signal.throwIfAborted();
    const handle = await locator.elementHandle();
    try {
      if (!handle || !(await handle.evaluate((el) => el.isConnected)))
        throw new Error('UI scope detached.');
      await captureObservation(page, masks(), path.join(directory, base + '.json'), handle);
      observation = JSON.parse(await readFile(path.join(directory, base + '.json'), 'utf8'));
    } finally {
      await handle?.dispose();
    }
    if (!wait || evaluateText(scope.checks, observation.text).every(Boolean)) break;
    await pause(100, signal);
  } while (Date.now() < deadline);
  await locator.screenshot({
    path: path.join(directory, base + '.png'),
    mask: masks(),
    timeout: options.timeout,
    animations: 'disabled',
  });
  return {
    ui: {
      passed:
        !observation.textTruncated &&
        !observation.elementsTruncated &&
        evaluateText(scope.checks, observation.text).every(Boolean),
      observedText: observation.text,
      checks: evaluateText(scope.checks, observation.text),
    },
    evidence: { image: base + '.png', observation: base + '.json', selector: scope.selector },
  };
}

async function trial(browser, prepared, options, directory, viewport, phase, runtime) {
  const { contract, inputs } = prepared;
  const reference = randomUUID();
  const result = {
    viewport,
    phase,
    reference,
    passed: false,
    status: 'needs-evidence',
    reasons: [],
    network: { matched: 0, statuses: [], failed: 0, blocked: 0, injected: 0 },
    before: null,
    after: null,
    ui: null,
    evidence: null,
  };
  runtime.onProgress?.({
    url: redact(new URL(contract.page, options.url).href),
    viewport,
    page: 1,
    flow: `delivery:${phase}`,
  });
  const ctx = await browser.newContext({
    viewport: VIEWPORTS[viewport],
    storageState: options.storageState,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    acceptDownloads: false,
    deviceScaleFactor: 1,
    isMobile: viewport === 'mobile',
    hasTouch: viewport === 'mobile',
  });
  const page = await ctx.newPage();
  let armed = false,
    finished = 0;
  const tracked = new Set();
  const origin = new URL(options.url).origin;
  const target = (req) =>
    req.method() === contract.request.method &&
    new URL(req.url()).origin === origin &&
    new URL(req.url()).pathname === contract.request.path;
  const masks = () => [
    page.locator('input[type="password"]'),
    ...options.mask.map((s) => page.locator(s)),
    ...contract.steps.filter((s) => s.action === 'fill').map((s) => page.locator(s.selector)),
  ];
  try {
    for (const s of options.mask) await page.locator(s).count();
    await ctx.route('**/*', async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      const isTarget = target(req);
      if (
        (req.isNavigationRequest() &&
          (url.origin !== origin || excluded(url.href, options.exclude))) ||
        (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && (!armed || !isTarget))
      ) {
        result.network.blocked++;
        return route.abort('blockedbyclient');
      }
      if (isTarget && armed) {
        tracked.add(req);
        result.network.matched++;
        if (phase === 'failure') {
          result.network.injected++;
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: '{"error":"shiplens-injected-unavailable"}',
          });
        }
      }
      return route.continue();
    });
    page.on('response', (response) => {
      if (tracked.has(response.request())) result.network.statuses.push(response.status());
    });
    page.on('requestfinished', (req) => {
      if (tracked.has(req)) finished++;
    });
    page.on('requestfailed', (req) => {
      if (tracked.has(req)) {
        finished++;
        result.network.failed++;
      }
    });
    page.on('dialog', (dialog) => void dialog.dismiss());
    await page.goto(new URL(contract.page, options.url).href, {
      waitUntil: 'domcontentloaded',
      timeout: options.timeout,
    });
    if (options.waitFor)
      await page.locator(options.waitFor).waitFor({ state: 'visible', timeout: options.timeout });
    await pause(options.settle, runtime.signal);
    // Precondition is mandatory: an old matching record must not count as a new delivery.
    result.before = await readback(ctx, contract, options, reference, runtime.signal);
    if (result.before.count !== 0) {
      result.reasons.push('reference-already-exists');
      return result;
    }
    armed = true;
    for (const step of contract.steps) {
      runtime.signal.throwIfAborted();
      const { valueFromInput, ...action } = step;
      if (step.action === 'fill')
        action.value =
          valueFromInput === contract.referenceInput ? reference : inputs[valueFromInput];
      await performStep(page, action, step.timeout ?? options.timeout);
    }
    const deadline = Date.now() + options.timeout;
    while ((!result.network.matched || finished < result.network.matched) && Date.now() < deadline)
      await pause(50, runtime.signal);
    await pause(options.settle, runtime.signal);
    const scope = phase === 'success' ? contract.success : contract.failure;
    const base = `${viewport}-${phase}`;
    try {
      Object.assign(
        result,
        await captureUI(page, scope, masks, directory, base, options, runtime.signal),
      );
    } catch {
      runtime.signal.throwIfAborted();
      result.reasons.push('ui-evidence-unavailable');
    }
    result.after = await retryReadback(ctx, contract, options, reference, runtime.signal, phase);
    if (result.network.matched !== 1)
      result.reasons.push(
        result.network.matched ? 'multiple-mutation-requests' : 'mutation-not-exercised',
      );
    if (finished !== result.network.matched) result.reasons.push('mutation-still-pending');
    if (result.network.blocked) result.reasons.push('out-of-contract-request');
    if (!result.ui?.passed) result.reasons.push('ui-expectation-failed');
    if (result.after.status !== 'complete') result.reasons.push('readback-unavailable');
    if (phase === 'success') {
      if (
        result.network.failed ||
        result.network.statuses.length !== 1 ||
        result.network.statuses.some((s) => s < 200 || s >= 300)
      )
        result.reasons.push('mutation-response-failed');
      if (
        result.after.status === 'complete' &&
        (result.after.count !== 1 || !result.after.checks.every((c) => c.matched))
      )
        result.reasons.push('persisted-record-mismatch');
    } else {
      if (result.network.injected !== 1) result.reasons.push('fault-not-exercised');
      if (
        result.network.failed ||
        result.network.statuses.length !== 1 ||
        result.network.statuses[0] !== 503
      )
        result.reasons.push('fault-response-unavailable');
      if (result.after.status === 'complete' && result.after.count !== 0)
        result.reasons.push('record-created-during-injected-failure');
      // Missing error UI must not hide a success banner on a different component.
      const success = page.locator(contract.success.selector);
      const count = await success.count();
      if (count > 1) result.reasons.push('ambiguous-success-scope');
      if (count === 1 && (await success.isVisible())) {
        try {
          const proof = await captureUI(
            page,
            contract.success,
            masks,
            directory,
            base + '-success',
            options,
            runtime.signal,
            false,
          );
          result.successDuringFailure = proof.ui.passed;
          if (proof.ui.passed) result.reasons.push('false-success-during-injected-failure');
          if (!result.evidence) result.evidence = proof.evidence;
        } catch {
          runtime.signal.throwIfAborted();
          result.reasons.push('success-evidence-unavailable');
        }
      }
    }

    result.passed = result.reasons.length === 0;
    result.status = result.passed
      ? 'pass'
      : result.after.status === 'complete' && result.ui
        ? 'fail'
        : 'needs-evidence';
  } catch {
    runtime.signal.throwIfAborted();
    result.reasons.push('execution-or-evidence-unavailable');
  } finally {
    await ctx.close();
  }
  if (
    result.passed &&
    (result.network.matched !== 1 ||
      result.network.blocked ||
      result.network.failed ||
      finished !== 1)
  ) {
    result.passed = false;
    result.status = 'fail';
    result.reasons.push('late-request-activity');
  }
  return result;
}

export async function executeDelivery(prepared, options, directory, runtime) {
  const deliveryId = path.basename(directory);
  await mkdir(directory, { mode: 0o700 });
  let browser,
    completed = false;
  const abort = () => void browser?.close().catch(() => {});
  try {
    runtime.signal.throwIfAborted();
    browser = await chromium.launch({ headless: true });
    runtime.signal.addEventListener('abort', abort, { once: true });
    runtime.signal.throwIfAborted();
    const result = {
      schemaVersion: 1,
      kind: 'shiplens-delivery-result',
      version: VERSION,
      deliveryId,
      name: prepared.contract.name,
      contractSha256: deliveryDigest(prepared.contract),
      createdAt: new Date().toISOString(),
      passed: false,
      trials: [],
      report: `deliveries/${deliveryId}/index.html`,
      note: 'A bounded delivery contract, not whole-site acceptance. Each success trial can create one real test record; ShipLens does not delete it. The independent GET readback proves the configured API projection, not database durability or unrelated business rules. Fault trials synthesize HTTP 503 in the browser and require an exercised request. Use disposable test data and a test environment. No model calls.',
    };
    for (const viewport of options.viewport === 'both'
      ? ['desktop', 'mobile']
      : [options.viewport]) {
      const success = await trial(
        browser,
        prepared,
        options,
        directory,
        viewport,
        'success',
        runtime,
      );
      result.trials.push(success);
      if (success.passed)
        result.trials.push(
          await trial(browser, prepared, options, directory, viewport, 'failure', runtime),
        );
      else
        result.trials.push({
          viewport,
          phase: 'failure',
          status: 'skipped',
          passed: false,
          reasons: ['success-baseline-not-passing'],
          evidence: null,
        });
    }
    result.passed = result.trials.every((t) => t.passed);
    runtime.signal.throwIfAborted();
    const images = {};
    for (const t of result.trials)
      if (t.evidence)
        images[t.evidence.image] = (
          await readFile(path.join(directory, t.evidence.image))
        ).toString('base64');
    await writeFile(
      path.join(directory, 'index.html'),
      deliveryHtml(result, images, options.lang),
      { mode: 0o600 },
    );
    await writeFile(path.join(directory, 'result.json'), JSON.stringify(result, null, 2) + '\n', {
      mode: 0o600,
    });
    runtime.signal.throwIfAborted();
    completed = true;
    return result;
  } finally {
    runtime.signal.removeEventListener('abort', abort);
    await browser?.close().catch(() => {});
    if (!completed) await rm(directory, { recursive: true, force: true });
  }
}
