import { captureObservation } from './observations.js';
import { chromium } from 'playwright';
import { mkdir, readFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  validateOptions,
  VIEWPORTS,
  crawlUrl,
  redact,
  fingerprint,
  hash,
  requestAllowed,
  validateBaseline,
  compareReports,
} from './options.js';
import { inspectDOM, RULE_TITLES } from './rules.js';
import { writeReports } from './report.js';
import { VERSION } from './version.js';
import { performStep } from './interactions.js';
import { applySuppressions, isExpired } from './suppressions.js';

export async function scan(input, { signal } = {}) {
  return scanWithEvidence(input, { signal });
}

// Internal capture scopes are supplied by validated review requirements.
export async function scanWithEvidence(input, { scopes = [], signal } = {}) {
  signal?.throwIfAborted();
  const o = validateOptions(input);
  const baseline = o.baseline ? JSON.parse(await readFile(o.baseline, 'utf8')) : null;
  if (baseline) validateBaseline(baseline);
  let storageState,
    authProfile = 'anonymous';
  if (o.storageState) {
    const raw = await readFile(o.storageState, 'utf8');
    try {
      storageState = JSON.parse(raw);
      if (!Array.isArray(storageState.cookies) || !Array.isArray(storageState.origins))
        throw new Error();
    } catch {
      throw new Error('storageState must be a Playwright storage-state JSON file.');
    }
    authProfile = hash(raw);
  }
  const started = Date.now(),
    origin = new URL(o.url).origin;
  const directory = path.resolve(
    o.output,
    `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 6)}`,
  );
  await mkdir(path.join(directory, 'screenshots'), { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  if (o.captureDom) await mkdir(path.join(directory, 'observations'), { mode: 0o700 });
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    throw new Error(
      'Chromium could not start. Run "shiplens browsers" (Linux: shiplens browsers --with-deps), then retry.',
    );
  }
  const abort = () => {
    void browser.close().catch(() => {});
  };
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) {
    await browser.close();
    signal.throwIfAborted();
  }
  const r = {
    schemaVersion: 2,
    version: VERSION,
    target: redact(o.url),
    startedAt: new Date(started).toISOString(),
    options: {
      ...(o.captureDom ? { captureDom: true } : {}),
      maxPages: o.maxPages,
      timeout: o.timeout,
      settle: o.settle,
      viewport: o.viewport,
      exclude: o.exclude,
      pages: o.pages.map(redact),
      crawl: o.crawl,
      scroll: o.scroll,
      scrollSteps: o.scrollSteps,
      waitFor: o.waitFor,
      allowRequests: o.allowRequests,
      ignoreRules: o.ignoreRules,
      mask: o.mask,
      authProfile,
      targetProfile: hash(JSON.stringify([o.url, ...o.pages])),
      ...(o.flows.length ? { flowsProfile: hash(JSON.stringify(o.flows)) } : {}),
      ...(o.ignore.length
        ? {
            ignoreProfile: hash(
              JSON.stringify(o.ignore.map((entry) => [entry, isExpired(entry, started)])),
            ),
          }
        : {}),
    },
    pages: [],
    findings: [],
    skipped: [],
    truncated: false,
  };
  const queue = [...new Set([o.url, ...o.pages])],
    seen = new Set(queue),
    ids = new Set(),
    devices = o.viewport === 'both' ? ['desktop', 'mobile'] : [o.viewport];
  try {
    while (queue.length && r.pages.length < o.maxPages) {
      const url = queue.shift();
      const record = {
        url: redact(url),
        discoveredFrom: o.pages.includes(url) || url === o.url ? 'explicit' : 'same-origin link',
        checks: [],
      };
      r.pages.push(record);
      for (const viewport of devices) {
        const scenarios = [null, ...o.flows.filter((flow) => flow.page === url)];
        for (const [scenarioIndex, flow] of scenarios.entries()) {
          signal?.throwIfAborted();
          o.onProgress?.({
            url: redact(url),
            viewport,
            page: r.pages.length,
            ...(flow ? { flow: flow.name } : {}),
          });
          const ctx = await browser.newContext({
            viewport: VIEWPORTS[viewport],
            deviceScaleFactor: 1,
            reducedMotion: 'reduce',
            isMobile: viewport === 'mobile',
            hasTouch: viewport === 'mobile',
            serviceWorkers: 'block',
            acceptDownloads: false,
            storageState,
          });
          const page = await ctx.newPage();
          const prefix = `${r.pages.length}-${viewport}${flow ? `-flow-${scenarioIndex}` : ''}`;
          const finalShot = `screenshots/${prefix}.png`;
          let shot = finalShot,
            currentStep;
          const check = {
            viewport,
            status: 'complete',
            screenshot: shot,
            blockedRequests: 0,
            scrollTruncated: false,
            notes: [],
            ...(flow ? { flow: flow.name, steps: [] } : {}),
          };
          record.checks.push(check);
          let active = true,
            maskValid = false,
            elementCount = 0;
          const pending = new Set(),
            blocked = new Set(),
            samples = [];
          const add = (code, severity, detail, subject = '', extra = {}) => {
            if (!active || o.ignoreRules.includes(code)) return;
            const f = {
              code,
              severity,
              title: RULE_TITLES[code][o.lang === 'zh' ? 1 : 0],
              detail: redact(detail).slice(0, 2400),
              subject: redact(subject).slice(0, 1000),
              url: redact(url),
              viewport,
              screenshot: shot,
              ...(flow ? { flow: flow.name, ...(currentStep ? { step: currentStep } : {}) } : {}),
              ...extra,
            };
            f.fingerprint = fingerprint(f);
            if (!ids.has(f.fingerprint)) {
              ids.add(f.fingerprint);
              r.findings.push(f);
              return f;
            }
          };
          const markIncomplete = (note) => {
            check.status = 'incomplete';
            check.notes.push(note);
          };
          const masks = () => [
            page.locator('input[type="password"]'),
            ...o.mask.map((s) => page.locator(s)),
            ...(flow?.steps
              .filter((step) => step.action === 'fill')
              .map((step) => page.locator(step.selector)) || []),
          ];
          const observe = async (result, name) => {
            if (!o.captureDom) return;
            try {
              if (!maskValid) throw new Error('Invalid privacy mask.');
              const filename = `observations/${name}.json`;
              await captureObservation(page, masks(), path.join(directory, filename));
              result.observation = filename;
            } catch {
              markIncomplete('DOM evidence unavailable.');
              add('evidence-failed', 'warning', 'DOM evidence unavailable.', 'observation');
            }
          };
          const captureRegions = async (result, name, step) => {
            const targets = scopes.filter(
              (s) =>
                s.page === url &&
                s.flow === flow?.name &&
                s.step === step &&
                s.viewports.includes(viewport),
            );
            if (!targets.length) return;
            result.regions = [];
            for (const [index, scope] of targets.entries()) {
              signal?.throwIfAborted();
              const region = {
                criterionId: scope.id,
                selector: scope.selector,
                screenshot: null,
                observation: null,
                complete: false,
                notes: [],
              };
              result.regions.push(region);
              let root;
              try {
                if (!maskValid) throw new Error('Invalid mask');
                const locator = page.locator(scope.selector);
                if ((await locator.count()) !== 1)
                  throw new Error('Scope must match exactly one element');
                await locator.waitFor({ state: 'visible', timeout: o.timeout });
                const box = await locator.boundingBox();
                if (!box || box.width * box.height > 12000000 || box.height > 12000)
                  throw new Error('Scope exceeds image budget');
                const shotName = `screenshots/${name}-scope-${index}.png`;
                await locator.screenshot({
                  path: path.join(directory, shotName),
                  mask: masks(),
                  timeout: o.timeout,
                  animations: 'disabled',
                });
                root = await locator.elementHandle();
                if (!root) throw new Error('Scope detached');
                const observation = `observations/${name}-scope-${index}.json`;
                await captureObservation(page, masks(), path.join(directory, observation), root);
                region.screenshot = shotName;
                region.observation = observation;
                region.complete = true;
              } catch {
                region.notes.push(
                  'Region unavailable: require one visible element within the image budget and valid masks.',
                );
              } finally {
                await root?.dispose().catch(() => {});
              }
            }
          };
          const important = (req) =>
            ['script', 'stylesheet', 'fetch', 'xhr'].includes(req.resourceType()) &&
            new URL(req.url()).origin === origin;
          const settle = async () => {
            await page.waitForTimeout(o.settle);
            const deadline = Date.now() + Math.min(o.timeout, 5000);
            while (pending.size && Date.now() < deadline) await page.waitForTimeout(100);
          };
          const elementShot = async (f, selector) => {
            if (!f || !selector || elementCount >= 10 || !maskValid) return;
            const filename = `screenshots/${prefix}-element-${++elementCount}.png`;
            const position = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
            try {
              const loc = page.locator(selector).first();
              const box = await loc.boundingBox();
              if (!box || box.width * box.height > 12000000) return;
              await loc.screenshot({
                path: path.join(directory, filename),
                mask: masks(),
                timeout: Math.min(o.timeout, 3000),
                animations: 'disabled',
              });
              f.elementScreenshot = filename;
            } catch {
              /* A viewport screenshot is still available. */
            } finally {
              await page.evaluate((p) => window.scrollTo(p.x, p.y), position).catch(() => {});
            }
          };
          try {
            // Validate selectors up front: invalid privacy masks fail closed (no screenshots).
            for (const selector of o.mask) await page.locator(selector).count();
            maskValid = true;
            await ctx.route('**/*', async (route) => {
              const req = route.request();
              if (!requestAllowed(req.method(), req.url(), o)) {
                check.blockedRequests++;
                blocked.add(`${req.method()} ${redact(req.url())}`);
                return route.abort('blockedbyclient');
              }
              if (
                req.isNavigationRequest() &&
                (new URL(req.url()).origin !== origin ||
                  (flow && crawlUrl(req.url(), url, origin, o.exclude) === null))
              ) {
                blocked.add(`Out-of-scope navigation: ${redact(req.url())}`);
                return route.abort('blockedbyclient');
              }
              await route.continue();
            });
            page.on('dialog', (d) => d.dismiss().catch(() => {}));
            page.on('request', (req) => {
              if (important(req)) pending.add(req);
            });
            page.on('requestfinished', (req) => pending.delete(req));
            page.on('pageerror', (error) =>
              add('runtime-error', 'error', error.message, error.message),
            );
            page.on('console', (msg) => {
              if (msg.type() === 'error' && !/^Failed to load resource:/.test(msg.text()))
                add('console-error', 'warning', msg.text(), msg.text());
            });
            page.on('response', (res) => {
              if (res.status() >= 400)
                add(
                  'http-error',
                  new URL(res.url()).origin === origin ? 'error' : 'warning',
                  `${res.status()} · ${res.request().resourceType()} · ${res.url()}`,
                  res.url(),
                  { statusCode: res.status() },
                );
            });
            page.on('requestfailed', (req) => {
              pending.delete(req);
              const reason = req.failure()?.errorText || 'unknown';
              if (!/ERR_ABORTED|BLOCKED_BY_CLIENT/i.test(reason))
                add('request-failed', 'warning', `${reason} · ${req.url()}`, req.url());
            });
            const response = await page.goto(url, {
              waitUntil: 'domcontentloaded',
              timeout: o.timeout,
            });
            check.httpStatus = response?.status() ?? null;
            if (o.waitFor)
              await page
                .locator(o.waitFor)
                .first()
                .waitFor({ state: 'visible', timeout: o.timeout });
            await settle();
            if (new URL(page.url()).origin !== origin)
              throw new Error('Page left the configured origin.');
            check.finalUrl = redact(page.url());
            const collect = async () => {
              const dom = await page.evaluate(inspectDOM);
              samples.push(dom);
              record.title = dom.title;
              if (flow && currentStep && dom.blank)
                add(
                  'page-empty',
                  'warning',
                  'No visible content after this interaction step.',
                  'document',
                );
              for (const img of dom.images) {
                const subject = redact(img.src);
                const http = r.findings.find(
                  (f) =>
                    f.code === 'http-error' &&
                    f.url === redact(url) &&
                    f.viewport === viewport &&
                    f.flow === flow?.name &&
                    f.step === currentStep &&
                    f.subject === subject,
                );
                const f = add(
                  'broken-image',
                  'error',
                  `${img.selector} · ${img.src}${http ? ` · HTTP ${http.statusCode}` : ''}`,
                  img.src,
                  { selector: img.selector },
                );
                if (f && http) r.findings.splice(r.findings.indexOf(http), 1);
                await elementShot(f, img.selector);
              }
              if (dom.overflow.length) {
                const f = add(
                  'horizontal-overflow',
                  'warning',
                  `${VIEWPORTS[viewport].width}px viewport. Suspected elements: ${dom.overflow.map((x) => `${x.selector} (right ${x.right}px)`).join(', ')}. Confirm whether this layout is intentional.`,
                  'document',
                  { elements: dom.overflow, selector: dom.overflow[0].selector },
                );
                await elementShot(f, dom.overflow[0].selector);
              }
              if (o.crawl)
                for (const href of dom.links) {
                  const next = crawlUrl(href, page.url(), origin, o.exclude);
                  if (next && !seen.has(next)) {
                    seen.add(next);
                    if (queue.length < 500) queue.push(next);
                    else r.truncated = true;
                  }
                }
            };
            await collect();
            if (flow) {
              for (const [index, step] of flow.steps.entries()) {
                currentStep = index + 1;
                shot = `screenshots/${prefix}-step-${currentStep}.png`;
                const result = {
                  index: currentStep,
                  action: step.action,
                  selector: redact(step.selector),
                  status: 'passed',
                  screenshot: shot,
                };
                check.steps.push(result);
                try {
                  const blockedBefore = check.blockedRequests + blocked.size;
                  await performStep(page, step, step.timeout ?? o.timeout);
                  await settle();
                  if (
                    new URL(page.url()).origin !== origin ||
                    crawlUrl(page.url(), url, origin, o.exclude) === null
                  )
                    throw new Error('Interaction left scope.');
                  if (check.blockedRequests + blocked.size > blockedBefore)
                    throw new Error('Interaction triggered a blocked request.');
                  check.finalUrl = redact(page.url());
                  await collect();
                } catch (error) {
                  result.failureKind =
                    error.name === 'TimeoutError' ? 'timeout' : 'action-or-policy';
                  result.status = 'failed';
                  result.detail =
                    'Action, expectation or observation failed; check the selector, timeout, expected state and blocked requests.';
                  markIncomplete(
                    `Flow ${redact(flow.name)}, step ${currentStep}: ${result.detail}`,
                  );
                  add('interaction-failed', 'error', result.detail, `step:${currentStep}`, {
                    selector: redact(step.selector),
                  });
                }
                try {
                  if (!maskValid) throw new Error('Invalid mask.');
                  await page.screenshot({
                    path: path.join(directory, shot),
                    mask: masks(),
                    timeout: step.timeout ?? o.timeout,
                    animations: 'disabled',
                  });
                } catch (error) {
                  result.failureKind =
                    error.name === 'TimeoutError' ? 'timeout' : 'action-or-policy';
                  result.status = 'failed';
                  result.screenshot = null;
                  result.detail = 'Step screenshot unavailable.';
                  markIncomplete(
                    `Flow ${redact(flow.name)}, step ${currentStep}: screenshot unavailable.`,
                  );
                  add('screenshot-failed', 'warning', result.detail, `step:${currentStep}`);
                  for (const finding of r.findings.filter((f) => f.screenshot === shot))
                    finding.screenshot = null;
                }
                await observe(result, `${prefix}-step-${currentStep}`);
                await captureRegions(result, `${prefix}-step-${currentStep}`, currentStep);
                if (result.status === 'failed') {
                  for (let rest = index + 1; rest < flow.steps.length; rest++)
                    check.steps.push({
                      index: rest + 1,
                      action: flow.steps[rest].action,
                      selector: redact(flow.steps[rest].selector),
                      status: 'skipped',
                      screenshot: null,
                    });
                  break;
                }
              }
              shot = finalShot;
              currentStep = undefined;
            }
            if (o.scroll) {
              for (let step = 0; step < o.scrollSteps; step++) {
                const before = await page.evaluate(() => ({
                  y: scrollY,
                  bottom: scrollY + innerHeight >= document.documentElement.scrollHeight - 2,
                }));
                if (before.bottom) break;
                await page.evaluate(() => window.scrollBy(0, Math.round(innerHeight * 0.8)));
                await page.waitForTimeout(180);
                await collect();
              }
              check.scrollTruncated = await page.evaluate(
                () => scrollY + innerHeight < document.documentElement.scrollHeight - 2,
              );
              if (check.scrollTruncated)
                check.notes.push(
                  'Scroll budget exhausted; content further down may be unobserved.',
                );
              await settle();
              await collect();
            }
            if (samples.length && samples.every((s) => s.blank))
              add(
                'page-empty',
                'warning',
                'No visible text, media or controls after the configured readiness wait. Confirm manually or set --wait-for.',
                'document',
              );
            if (pending.size)
              markIncomplete(
                `${pending.size} first-party data/script requests still pending after the readiness budget.`,
              );
            await page.evaluate(() => window.scrollTo(0, 0));
          } catch (error) {
            if (/selector|mask/i.test(error.message) && !check.finalUrl) maskValid = false;
            if (flow && !check.steps.length)
              check.steps = flow.steps.map((step, index) => ({
                index: index + 1,
                action: step.action,
                selector: redact(step.selector),
                status: 'skipped',
                screenshot: null,
              }));
            markIncomplete(redact(error.message).slice(0, 1000));
            add('navigation-failed', 'error', error.message, 'navigation');
          }
          if (blocked.size) {
            for (const request of blocked)
              r.skipped.push({ url: redact(url), viewport, reason: `Blocked request: ${request}` });
            markIncomplete(
              'Requests were blocked. Allow required data endpoints explicitly or exclude this page.',
            );
          }
          try {
            if (!maskValid) throw new Error('Invalid privacy mask; screenshots skipped.');
            const height = await page.evaluate(() => document.documentElement.scrollHeight);
            check.screenshotMode = height <= 12000 ? 'full-page' : 'viewport';
            if (height > 12000)
              check.notes.push('Page taller than 12000px; screenshot is limited to viewport.');
            await page.screenshot({
              path: path.join(directory, shot),
              mask: masks(),
              fullPage: height <= 12000,
              timeout: o.timeout,
              animations: 'disabled',
            });
          } catch (error) {
            check.screenshot = null;
            markIncomplete('Screenshot unavailable.');
            add('screenshot-failed', 'warning', error.message, 'screenshot');
            for (const f of r.findings.filter((f) => f.screenshot === finalShot))
              f.screenshot = null;
          }
          await observe(check, prefix);
          await captureRegions(check, prefix, undefined);
          signal?.throwIfAborted();
          active = false;
          await ctx.close();
        }
      }
    }
    r.truncated = r.truncated || queue.length > 0;
    r.remainingPages = queue.length;
    r.durationMs = Date.now() - started;
    r.completedAt = new Date().toISOString();
    applySuppressions(r, o.ignore, started);
    r.summary = {
      suppressed: r.suppressed.length,
      pages: r.pages.length,
      checks: r.pages.reduce((n, p) => n + p.checks.length, 0),
      errors: r.findings.filter((f) => f.severity === 'error').length,
      warnings: r.findings.filter((f) => f.severity === 'warning').length,
      incomplete: r.pages.flatMap((p) => p.checks).filter((c) => c.status !== 'complete').length,
      groups: new Set(
        r.findings.map((f) =>
          hash([f.code, f.url, f.subject, ...(f.flow ? [f.flow, f.step ?? ''] : [])].join('\n')),
        ),
      ).size,
      scrollLimited: r.pages.flatMap((p) => p.checks).filter((c) => c.scrollTruncated).length,
    };
    // Scroll-limited coverage is not sufficient to confirm resolved issues.
    if (baseline) {
      r.comparison = compareReports(r, baseline);
      if (r.summary.scrollLimited || baseline.summary?.scrollLimited) {
        r.comparison.comparable = false;
        r.comparison.resolved = [];
        r.comparison.note =
          'Scroll coverage is partial. Absent findings cannot be treated as resolved.';
      }
    }
    signal?.throwIfAborted();
    await writeReports({ ...r, lang: o.lang }, directory);
    return { ...r, lang: o.lang, runDirectory: directory };
  } finally {
    signal?.removeEventListener('abort', abort);
    await browser.close();
  }
}
