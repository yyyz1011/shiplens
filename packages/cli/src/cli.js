#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { scan } from './scan.js';
import { VERSION } from './version.js';

const help = `
  ShipLens ${VERSION} — Evidence before you ship.

  shiplens <url> [options]
  shiplens scan <url> [options]
  shiplens browsers [--with-deps]  Install Chromium (and Linux dependencies)
  shiplens mcp --config <file>    Serve AI review tools over stdio
  shiplens init                   Create shiplens.config.json

  --page <path-or-url>            Add explicit same-origin pages (repeatable)
  --no-crawl                     Only inspect explicitly requested pages
  --max-pages <n>                 Page budget, default 10 (1–100)
  --viewport <both|desktop|mobile> Default both
  --timeout <ms>                  Navigation/selector/screenshot timeout, default 15000
  --settle <ms>                   Minimum observation wait, default 1000
  --wait-for <selector>           Wait for a visible ready-state element
  --no-scroll                    Disable bounded lazy-content scrolling
  --scroll-steps <n>              Scroll budget per viewport, default 6 (0–30)
  --storage-state <file>          Playwright cookies/localStorage JSON
  --allow-request <METHOD:/path>  Allow an exact first-party data endpoint (repeatable)
  --mask <selector>               Mask sensitive elements in screenshots (repeatable)
  --ignore-rule <rule>            Suppress a non-operational rule (repeatable)
  --exclude </prefix>             Exclude path/hash-route prefixes (repeatable)
  --output <dir>                  Report parent directory, default .shiplens
  --config <file>                 Explicit JSON configuration (also flows and ignore)
  --baseline <report.json>        Compare against a previous run with coverage checks
  --fail-on <error|warning|none>   Exit threshold, default error
  --lang <en|zh>                  Report language, default en
  --json                         JSON only on stdout
  --help / --version              Show help/version

  Exit: 0 within threshold · 1 findings/incomplete checks · 2 configuration/runtime failure
  Interactions run only through explicit flows in JSON configuration.
`;
async function main() {
  if (process.argv[2] === 'mcp') {
    const { startMcp } = await import('./mcp.js');
    return startMcp(process.argv.slice(3));
  }
  const { values: v, positionals } = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      page: { type: 'string', multiple: true },
      'no-crawl': { type: 'boolean' },
      'max-pages': { type: 'string' },
      viewport: { type: 'string' },
      timeout: { type: 'string' },
      settle: { type: 'string' },
      'wait-for': { type: 'string' },
      'no-scroll': { type: 'boolean' },
      'scroll-steps': { type: 'string' },
      'storage-state': { type: 'string' },
      'allow-request': { type: 'string', multiple: true },
      mask: { type: 'string', multiple: true },
      'ignore-rule': { type: 'string', multiple: true },
      exclude: { type: 'string', multiple: true },
      output: { type: 'string' },
      config: { type: 'string' },
      baseline: { type: 'string' },
      'fail-on': { type: 'string' },
      lang: { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      'with-deps': { type: 'boolean' },
    },
  });
  if (v.version) return console.log(VERSION);
  if (v.help || (!positionals.length && !v.config)) return console.log(help);
  const command = positionals[0];
  if (command === 'browsers') {
    if (positionals.length !== 1) throw new Error('browsers takes no positional arguments.');
    const require = createRequire(import.meta.url),
      cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
    const child = spawn(
      process.execPath,
      [cli, 'install', ...(v['with-deps'] ? ['--with-deps'] : []), 'chromium'],
      { stdio: 'inherit' },
    );
    const rc = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    process.exitCode = rc === 0 ? 0 : 2;
    return;
  }
  if (v['with-deps']) throw new Error('--with-deps is only supported by the browsers command.');
  if (command === 'init') {
    if (positionals.length !== 1) throw new Error('init takes no positional arguments.');
    await writeFile(
      'shiplens.config.json',
      JSON.stringify(
        {
          url: 'http://localhost:3000',
          pages: [],
          maxPages: 10,
          viewport: 'both',
          settle: 1000,
          scroll: true,
          exclude: ['/logout'],
          allowRequests: [],
          mask: [],
          flows: [],
          ignore: [],
          output: '.shiplens',
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
    console.log('Created shiplens.config.json. Run shiplens --config shiplens.config.json');
    return;
  }
  const args = command === 'scan' ? positionals.slice(1) : positionals;
  if (args.length > 1) throw new Error('Use --page to add extra URLs.');
  const config = v.config ? JSON.parse(await readFile(v.config, 'utf8')) : {};
  if (!config || Array.isArray(config) || typeof config !== 'object')
    throw new Error('Configuration must be a JSON object.');
  const allowed = [
    'url',
    'pages',
    'crawl',
    'captureDom',
    'maxPages',
    'viewport',
    'timeout',
    'settle',
    'waitFor',
    'scroll',
    'scrollSteps',
    'storageState',
    'allowRequests',
    'mask',
    'ignoreRules',
    'flows',
    'ignore',
    'output',
    'exclude',
    'baseline',
    'failOn',
    'lang',
  ];
  for (const key of Object.keys(config))
    if (!allowed.includes(key)) throw new Error(`Unknown configuration key: ${key}`);
  const options = { ...config };
  if (args[0]) options.url = args[0];
  // File paths in JSON resolve against its own directory; CLI paths resolve against cwd.
  if (v.config) {
    const dir = path.dirname(path.resolve(v.config));
    for (const k of ['storageState', 'baseline', 'output'])
      if (options[k]) options[k] = path.resolve(dir, options[k]);
  }
  for (const [flag, key] of [
    ['page', 'pages'],
    ['max-pages', 'maxPages'],
    ['viewport', 'viewport'],
    ['timeout', 'timeout'],
    ['settle', 'settle'],
    ['wait-for', 'waitFor'],
    ['scroll-steps', 'scrollSteps'],
    ['storage-state', 'storageState'],
    ['mask', 'mask'],
    ['ignore-rule', 'ignoreRules'],
    ['output', 'output'],
    ['exclude', 'exclude'],
    ['baseline', 'baseline'],
    ['lang', 'lang'],
  ])
    if (v[flag] !== undefined) options[key] = v[flag];
  if (v['no-crawl']) options.crawl = false;
  if (v['no-scroll']) options.scroll = false;
  if (v['allow-request'])
    options.allowRequests = v['allow-request'].map((value) => {
      const i = value.indexOf(':');
      return { method: value.slice(0, i).toUpperCase(), path: value.slice(i + 1) };
    });
  const threshold = v['fail-on'] ?? config.failOn ?? 'error';
  if (!['error', 'warning', 'none'].includes(threshold))
    throw new Error('fail-on must be error, warning or none.');
  if (!v.json) {
    console.error(`\n  ◉ ShipLens ${VERSION}\n`);
    options.onProgress = ({ url, viewport, page, flow }) =>
      console.error(
        `  ${String(page).padStart(2, '0')} ${viewport.padEnd(7)} ${url}${flow ? ` · ${flow}` : ''}`,
      );
  }
  const r = await scan(options);
  if (v.json) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(
      `\n  ${r.summary.pages} pages · ${r.summary.groups} issue groups · ${r.summary.errors} error observations · ${r.summary.warnings} warnings · ${r.summary.incomplete} incomplete checks\n`,
    );
    console.log(
      `  HTML  ${r.runDirectory}/index.html\n  JSON  ${r.runDirectory}/report.json\n  AI    ${r.runDirectory}/report.md\n`,
    );
    if (r.truncated)
      console.log('  Page budget exhausted. Increase --max-pages for wider coverage.');
    if (r.summary.scrollLimited)
      console.log('  Some pages exceed the scroll budget; see coverage notes.');
  }
  process.exitCode =
    threshold === 'none'
      ? 0
      : r.summary.errors || r.summary.incomplete || (threshold === 'warning' && r.summary.warnings)
        ? 1
        : 0;
}
main().catch((error) => {
  console.error(`ShipLens: ${error.message}`);
  process.exitCode = 2;
});
