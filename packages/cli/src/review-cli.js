import { parseArgs } from 'node:util';
import { readFile, stat, access } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { ReviewWorkspace } from './review.js';
import { DEFAULTS, validateOptions } from './options.js';
import { VERSION } from './version.js';

export async function readJson(filename) {
  if ((await stat(filename)).size > 512 * 1024) throw new Error('JSON input exceeds 512 KiB.');
  return JSON.parse(await readFile(filename, 'utf8'));
}
export async function loadReviewConfig(filename) {
  if (!filename) throw new Error('An explicit --config file is required.');
  const configPath = path.resolve(filename),
    dir = path.dirname(configPath);
  const options = await readJson(configPath);
  if (!options || typeof options !== 'object' || Array.isArray(options))
    throw new Error('Configuration must be a JSON object.');
  const allowed = [...Object.keys(DEFAULTS), 'url', 'storageState', 'baseline', 'failOn'];
  if (Object.keys(options).some((key) => !allowed.includes(key)))
    throw new Error('Unknown review configuration field.');
  for (const key of ['output', 'storageState', 'baseline'])
    if (options[key]) options[key] = path.resolve(dir, options[key]);
  options.output ??= path.join(dir, '.shiplens');
  return { directory: path.join(options.output, 'reviews'), options: validateOptions(options) };
}
export async function doctor(args) {
  const { values } = parseArgs({ args, strict: true, options: { config: { type: 'string' } } });
  const checks = [
    {
      name: 'node',
      passed:
        Number(process.versions.node.split('.')[0]) > 22 ||
        (Number(process.versions.node.split('.')[0]) === 22 &&
          Number(process.versions.node.split('.')[1]) >= 12),
      detail: process.version,
    },
  ];
  try {
    await access(chromium.executablePath());
    checks.push({ name: 'chromium-installed', passed: true });
  } catch {
    checks.push({ name: 'chromium-installed', passed: false, detail: 'Run shiplens browsers.' });
  }
  if (values.config) {
    try {
      const config = await loadReviewConfig(values.config);
      checks.push({ name: 'configuration', passed: true });
      if (config.options.storageState) {
        const state = await readJson(config.options.storageState);
        checks.push({
          name: 'storage-state-shape',
          passed: Array.isArray(state.cookies) && Array.isArray(state.origins),
          detail: 'Structure only; login validity requires a website check.',
        });
      }
      try {
        await stat(path.join(config.directory, '.lock'));
        checks.push({
          name: 'workspace-lock',
          passed: false,
          detail: 'Writer active or stale lock. Never remove it until the writer has stopped.',
        });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        checks.push({ name: 'workspace-lock', passed: true });
      }
    } catch {
      checks.push({
        name: 'configuration',
        passed: false,
        detail:
          'Check config, artifact permissions and storage-state file. No credential contents are printed.',
      });
    }
  }
  const result = {
    version: VERSION,
    passed: checks.every((c) => c.passed),
    checks,
    note: 'Does not launch Chromium or verify website reachability.',
  };
  console.log(JSON.stringify(result));
  process.exitCode = result.passed ? 0 : 1;
}
const methods = {
  plan: 'validatePlan',
  verify: 'verify',
  collect: 'collect',
  run: 'getRun',
  runs: 'listRuns',
  evidence: 'readEvidence',
  packet: 'reviewPacket',
  assess: 'assess',
  save: 'saveCase',
  recheck: 'recheck',
  cases: 'listCases',
  case: 'getCase',
  update: 'updateCase',
  export: 'exportCase',
  import: 'importCase',
  compare: 'compareRuns',
  report: 'exportReport',
  gate: 'gate',
};
export async function reviewCli(args) {
  const { values, positionals } = parseArgs({
    args,
    strict: true,
    allowPositionals: true,
    options: {
      config: { type: 'string' },
      plan: { type: 'string' },
      input: { type: 'string' },
      run: { type: 'string' },
      case: { type: 'string' },
      previous: { type: 'string' },
      format: { type: 'string' },
      lang: { type: 'string' },
      'fail-on': { type: 'string' },
      'timeout-ms': { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help || !positionals.length) {
    console.log(
      'shiplens review <' +
        Object.keys(methods).join('|') +
        '> --config <file> [--plan <portable case JSON>] [--input <JSON file>] [--run <id>] [--case <id>] [--previous <runId>] [--format html|json|markdown] [--lang en|zh] [--fail-on error|warning] [--timeout-ms 120000]\nAll commands write JSON to stdout. plan validates without browser execution; verify reads --plan and optional named values from --input. verify/gate exit 1 while requirements or machine checks remain unresolved; command errors exit 2.',
    );
    return;
  }
  const command = positionals[0];
  if (positionals.length !== 1 || !Object.hasOwn(methods, command))
    throw new Error('Unknown review command. Run shiplens review --help.');
  for (const [flag, commands] of Object.entries({
    plan: ['plan', 'verify'],
    lang: ['report', 'verify'],
    format: ['report', 'verify'],
    'fail-on': ['gate', 'report', 'verify'],
    'timeout-ms': ['collect', 'recheck', 'verify'],
    previous: ['compare', 'recheck', 'report'],
    case: ['case', 'update', 'export', 'recheck'],
    run: ['run', 'evidence', 'packet', 'assess', 'save', 'compare', 'report', 'gate'],
  }))
    if (values[flag] !== undefined && !commands.includes(command))
      throw new Error(`--${flag} is not supported by this review command.`);
  const workspace = new ReviewWorkspace(await loadReviewConfig(values.config));
  let input = values.input ? await readJson(values.input) : {};
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Input must be a JSON object.');
  if (['plan', 'verify'].includes(command)) {
    if (!values.plan) throw new Error('This command requires --plan <portable case JSON>.');
    if (command === 'plan' && values.input) throw new Error('plan does not accept --input.');
    input = {
      data: await readJson(values.plan),
      ...(command === 'verify' ? { inputs: input } : {}),
    };
  }
  if (command === 'import') input = { data: input };
  if (values.run) input.runId = values.run;
  if (values.case) input.caseId = values.case;
  if (values.previous) input.previousRunId = values.previous;
  if (values.format) input.format = values.format;
  if (values.lang) input.lang = values.lang;
  if (values['fail-on']) input.failOn = values['fail-on'];
  const controller = new AbortController();
  const abort = () => controller.abort(new Error('Review interrupted.'));
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  try {
    const argument = command === 'run' ? input.runId : command === 'case' ? input.caseId : input;
    const result = await workspace[methods[command]](argument, {
      signal: controller.signal,
      timeoutMs: values['timeout-ms'] ? Number(values['timeout-ms']) : 120000,
    });
    console.log(JSON.stringify(result));
    if (command === 'gate') process.exitCode = result.passed ? 0 : 1;
    if (command === 'verify') process.exitCode = result.gate.passed ? 0 : 1;
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }
}
