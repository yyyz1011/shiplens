# ShipLens

**Evidence before you ship.** A local website delivery checker using a real Chromium browser.

[Documentation](https://yyyz1011.github.io/shiplens/) · [中文](README.zh-CN.md) · [npm](https://www.npmjs.com/package/shiplens) · [Issues](https://github.com/yyyz1011/shiplens/issues)

ShipLens checks runtime errors, failed resources, visible broken images, suspicious blank pages and horizontal overflow. It saves HTML, JSON and Markdown reports with page and element screenshots. No model account, API key, telemetry or report upload.

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

Repeated observations retain viewport-specific evidence and are grouped across devices. Nested scroll containers are excluded from overflow warnings. Known false positives can be suppressed with `--ignore-rule` or `data-shiplens-ignore` on an intended overflow element.

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

ShipLens does not click buttons or submit forms. Non-read-only HTTP methods are blocked unless explicitly allowed by exact same-origin method/path. Only allow endpoints you know are read-only queries. Use test environments: even GET requests can have side effects.

A Playwright storage-state file can supply cookies and localStorage. Interactive login, sessionStorage, payment flows, business correctness, authorization, full accessibility/security audits and cross-browser compatibility are outside the scope. Mobile uses Chromium emulation. Bounded scrolling cannot inspect every state, especially hidden content, CSS backgrounds or canvas.

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
