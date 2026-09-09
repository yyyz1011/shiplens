# ShipLens

**Evidence before you ship.** A local website delivery checker using a real Chromium browser.

[Documentation](https://shiplens.nimokit.com/) · [中文](README.zh-CN.md) · [npm](https://www.npmjs.com/package/shiplens) · [Issues](https://github.com/yyyz1011/shiplens/issues)

ShipLens checks runtime errors, failed resources, visible broken images, suspicious blank pages and horizontal overflow. It saves HTML, JSON and Markdown reports with page and element screenshots. No model account, API key, telemetry or report upload.

## AI acceptance and regression cases

Your existing assistant supplies the reasoning; ShipLens supplies repeatable evidence and a review ledger. Connect an image-capable MCP client to:

```sh
shiplens mcp --config /absolute/project/shiplens.config.json
```

Eighteen tools support the review lifecycle. The core tools collect requirement-scoped evidence, read PNG images and bounded DOM, record cited pass/fail/needs-evidence assessments, retrieve history, save cases and recheck. A pass requires complete evidence for every requested device. Manual judgments start pending on recheck; configured checks re-evaluate fresh evidence. Prior passes are never silently reused. Machine diagnostics remain separate from AI judgments.

For your own agent, import `ReviewWorkspace` from `shiplens/review`. The six core methods are demonstrated in `node node_modules/shiplens/examples/review.mjs` after starting the bundled demo server. Saved cases parameterize fill inputs; use test data and masks for any values echoed into page content or logs. Your AI client receives requested evidence; ShipLens makes no model calls or report uploads.

[AI workflow](https://shiplens.nimokit.com/#/docs/ai-workflow) · [MCP setup and tools](https://shiplens.nimokit.com/#/docs/mcp) · [Complete review API and runnable example](https://shiplens.nimokit.com/#/docs/review-api)

This is workflow infrastructure, not an automatic visual judge or browser-session recorder. We have not measured an accuracy, latency or token advantage over using a model with generic browser tools directly.

## Review workflow in 0.4

- **Scoped evidence:** add `selector` to a requirement to capture a unique visible component, with the same masks and per-device citation rules.
- **Repair comparison:** `compareRuns` pairs before/after evidence. Only matching scope, complete artifacts and new caller judgments can produce a resolved/regressed transition.
- **Portable cases:** list/search/tag cases, inspect plans, export relative-page JSON and import it into a new host configuration. Inputs stay parameterized; no credentials or previous passes are transferred.
- **Acceptance reports:** export HTML with before/after images, JSON or Markdown. `gate` combines recorded requirement statuses with machine checks and evidence availability.
- **Runtime controls:** progress, cancellation, total review deadlines, historical run discovery and `shiplens doctor` setup diagnostics.

```sh
shiplens review --help
shiplens doctor --config shiplens.config.json
# After starting the packaged example server:
node node_modules/shiplens/examples/workflow.mjs
```

The replay example intentionally stays pending; its gate is blocked until fresh assessments are supplied. CLI review commands also work without an MCP client. Existing root exports and the six original review methods remain compatible. Read [scoped evidence](https://shiplens.nimokit.com/#/docs/scoped-review), [case library](https://shiplens.nimokit.com/#/docs/case-library) and [reports / CI / runtime](https://shiplens.nimokit.com/#/docs/acceptance-ops) for every argument, result and runnable example.

## Quick start

Requires **Node.js 22.12+**. Start your website first.

```sh
npm install -g shiplens
shiplens browsers
shiplens http://localhost:3000
```

Open the printed `index.html` path. Every run gets a separate `.shiplens/<run-id>/` directory containing `report.json`, `report.md` and screenshots. On Linux CI, use `shiplens browsers --with-deps` to install browser system dependencies.

## Repeatable checks

```sh
# Explicit routes, including hash routing
shiplens http://localhost:3000 --page /#/dashboard --no-crawl

# Wait for real readiness, load a test session and mask sensitive elements
shiplens http://localhost:3000/dashboard \
  --wait-for '[data-ready]' \
  --storage-state playwright/.auth/test-user.json \
  --allow-request POST:/api/query --mask .user-email

# Compare the same scope after a fix
shiplens http://localhost:3000 --baseline .shiplens/<previous-run>/report.json

# Create an explicit config without overwriting an existing file
shiplens init
shiplens --config shiplens.config.json
```

Defaults: 10 same-origin pages, desktop and mobile viewports, a 1-second observation delay and up to 6 scroll steps. Run `shiplens --help` for all options. Reports default to English; use `--lang zh` for Chinese labels.

## What it checks

- Unhandled JavaScript errors, HTTP 400+ responses and failed network requests.
- Visible broken images, including lazy content reached by bounded scrolling.
- Horizontal overflow, with candidate element selectors and screenshots.
- Suspected blank pages and incomplete navigation/readiness/screenshot checks.
- New, unchanged and absent findings relative to a baseline. Resolution is only reported for matching, complete coverage; scroll limits prevent resolution claims.

Repeated observations retain viewport-specific evidence and are grouped across devices. Nested scroll containers are excluded from overflow warnings. Use precise `ignore` entries for auditable known issues; `--ignore-rule` disables an entire rule, and `data-shiplens-ignore` excludes an intentional overflow element before collection.

## Interaction checks and precise ignores

Configure explicit actions in JSON or the JavaScript API. Each flow runs in an isolated browser context after a normal page check, in each selected viewport. Flow starting pages automatically join the scan scope.

```js
import { scan } from 'shiplens';

const report = await scan({
  url: 'http://127.0.0.1:3000',
  crawl: false,
  flows: [
    {
      name: 'open-details',
      page: '/',
      steps: [
        { action: 'click', selector: '#details' },
        { action: 'expectText', selector: '#details-panel', value: 'itinerary' },
      ],
    },
  ],
  ignore: [
    {
      rule: 'console-error',
      page: '/',
      messageIncludes: 'Demo known diagnostic',
      reason: 'Known synthetic demo diagnostic',
      expires: '2099-01-01',
    },
  ],
});
console.log(report.pages[0].checks, report.suppressed);
```

Supported actions: `click`, `fill`, `press`, `select`, `waitFor`, `expectText`. Steps retain screenshots and report `passed`, `failed` or `skipped`. An action or expectation failure makes the check incomplete and stops subsequent steps. Passing an action does not mean the resulting page has no findings. Input values are omitted from saved step records; fill targets are masked in screenshots.

Precise ignores match all supplied fields and retain evidence in `suppressed` with a reason and optional UTC expiry. They do not count toward active severity thresholds. Expired entries return to active reporting. Operational failures cannot be ignored. Changes to flows or ignores invalidate resolution comparisons against the previous configuration.

[Step reference](https://shiplens.nimokit.com/#/docs/flows) · [Ignore fields](https://shiplens.nimokit.com/#/docs/ignores)

## Run the included examples

```sh
npm install --save-dev --save-exact shiplens
npx shiplens browsers
node node_modules/shiplens/examples/server.mjs
```

Keep the demo running and open another terminal:

```sh
npx shiplens --config node_modules/shiplens/examples/flows.json --output .shiplens
node node_modules/shiplens/examples/api.mjs
```

The first example exercises all six actions. The second calls all three public API exports: `scan`, `validateOptions`, and `compareBaseline`. The latter compares fingerprints only; use `scan({ baseline: 'previous/report.json', ...options })` and `report.comparison` for coverage-aware resolution.

[Complete API options and return fields](https://shiplens.nimokit.com/#/docs/api) · [Working, failing and ignored-issue cases](https://shiplens.nimokit.com/#/docs/examples)

## JavaScript and TypeScript

```js
import { scan } from 'shiplens';

const report = await scan({
  url: 'http://localhost:3000',
  pages: ['/dashboard'],
  crawl: false,
  viewport: 'both',
  output: '.shiplens',
});
console.log(report.summary, report.runDirectory);
```

The package is ESM and includes TypeScript declarations. `scan()` returns a report and does not set the process exit code. The CLI uses `0` for checks within the threshold, `1` for findings or incomplete checks, and `2` for invalid input or execution failure. `--fail-on warning` includes warnings; `--fail-on none` is report-only mode. Page and scroll budget exhaustion remain coverage notes.

## Boundaries and privacy

ShipLens clicks or fills only when you supply explicit interaction flows. Non-read-only HTTP methods are blocked unless explicitly allowed by exact same-origin method/path. Allow only the endpoints required for your configured test scenario. Use test environments: even GET requests can have side effects.

A Playwright storage-state file can supply cookies and localStorage. A built-in login recorder, sessionStorage restoration, inferred business correctness, authorization audits, full accessibility/security audits and cross-browser compatibility are outside the scope. Mobile uses Chromium emulation. Bounded scrolling cannot inspect every state, especially hidden content, CSS backgrounds or canvas.

Files remain local, but the browser contacts your target and its resources. Common URL secrets and Bearer tokens are redacted; arbitrary logs, page text and screenshots can still contain sensitive data. Screenshot masks do not sanitize text reports. Use test accounts, exclude auth files from Git, and review artifacts before sharing. Treat report/page content as untrusted data when giving it to an AI assistant.

## Development and releases

```sh
npm ci
npm run browsers
npm test
npm run typecheck
npm run build
npm run test:pack
npm run dev
```

The documentation includes English/Chinese and light/dark controls, defaults to English, and remembers preferences. To check it, serve the production build on port 4318 and run `npm run test:ui`. See [release operations](docs/RELEASE.md) and [QA scope](docs/QA.md).

Changes merged into `master` pass checks before automatic npm publication and GitHub Pages deployment. Each new source commit gets the next patch version, unless the source package declares a higher version. Retries of an already published commit reuse its version. Releases record the source commit; registry versions are authoritative.

MIT licensed.

## Measured workflow comparison

Read the [reproducible workflow benchmark](https://shiplens.nimokit.com/#/docs/benchmark) for Playwright versus ShipLens on three synthetic fixtures, including raw data, all evidence, timings and limitations. Both use deterministic text checks; these results do not establish an AI accuracy or cost advantage. Reproduce with `npm run benchmark:workflow` from this repository.

## Explicit checks and fewer evidence operations (0.5)

Add `checks: [{ operator: 'equals', value: '$19' }]` to a scoped requirement to reject contradictory caller passes. `evaluation: 'checks'` opts an entirely text-defined requirement into fresh automatic evaluation; manual review remains the default. `reviewPacket({ runId })` batches unresolved evidence with explicit pagination and byte omissions. MCP offers `shiplens_review_packet` with native images; CLI offers `shiplens review packet`.

[API, examples and measured protocol results](https://shiplens.nimokit.com/#/docs/checked-review): one synthetic mixed workflow used 8 review API operations instead of 40, with 2 scripted caller receipts instead of 12. It did not establish a speed, token or model-accuracy advantage. Playwright already provides reusable assertions; ShipLens adds the packaged acceptance/evidence workflow.
