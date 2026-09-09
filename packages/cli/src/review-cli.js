import { parseArgs } from 'node:util';
import { readFile, writeFile, stat, access } from 'node:fs/promises';
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
  const allowed = [
    ...Object.keys(DEFAULTS),
    'url',
    'storageState',
    'baseline',
    'failOn',
    'acceptanceLock',
  ];
  if (Object.keys(options).some((key) => !allowed.includes(key)))
    throw new Error('Unknown review configuration field.');
  let acceptanceLock;
  if (options.acceptanceLock !== undefined) {
    const value = options.acceptanceLock;
    if (
      !value ||
      typeof value !== 'object' ||
      Object.keys(value).sort().join(',') !== 'file,sha256' ||
      typeof value.file !== 'string' ||
      !value.file
    )
      throw new Error('acceptanceLock requires { file, sha256 }.');
    acceptanceLock = { lock: await readJson(path.resolve(dir, value.file)), sha256: value.sha256 };
    delete options.acceptanceLock;
  }
  for (const key of ['output', 'storageState', 'baseline'])
    if (options[key]) options[key] = path.resolve(dir, options[key]);
  options.output ??= path.join(dir, '.shiplens');
  return {
    directory: path.join(options.output, 'reviews'),
    options: validateOptions(options),
    ...(acceptanceLock ? { acceptanceLock } : {}),
  };
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
  lock: 'createPlanLock',
  'lock-check': 'checkPlanLock',
  delivery: 'verifyDelivery',
  'delivery-run': 'getDelivery',
  'delivery-evidence': 'readDeliveryEvidence',
  plan: 'validatePlan',
  verify: 'verify',
  collect: 'collect',
  run: 'getRun',
  runs: 'listRuns',
  evidence: 'readEvidence',
  packet: 'reviewPacket',
  audit: 'auditChecks',
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
      'lock-output': { type: 'string' },
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
        '> --config <file> [--plan <portable case JSON>] [--lock-output <new lock file>] [--input <JSON file>] [--run <id>] [--case <id>] [--previous <runId>] [--format html|json|markdown] [--lang en|zh] [--fail-on error|warning] [--timeout-ms 120000]\nAll commands write JSON to stdout. lock requires --plan and --lock-output, creates an exclusive new file with an approval fingerprint; keep it in a trusted location. lock-check compares --plan with the host acceptanceLock before browser use. Changed locks exit 1; command errors exit 2. plan validates without browser execution; verify reads --plan and optional named values from --input. verify/gate exit 1 while requirements or machine checks remain unresolved; command errors exit 2. delivery reads --plan and optional named inputs, exits 1 for failed/incomplete delivery contracts; delivery-run/delivery-evidence take --input JSON with deliveryId. audit is advisory and exits 0 when completed, including survivors; inspect pageSummary and follow nextOffset.',
    );
    return;
  }
  const command = positionals[0];
  if (positionals.length !== 1 || !Object.hasOwn(methods, command))
    throw new Error('Unknown review command. Run shiplens review --help.');
  for (const [flag, commands] of Object.entries({
    plan: ['plan', 'verify', 'delivery', 'lock', 'lock-check'],
    'lock-output': ['lock'],
    lang: ['report', 'verify'],
    format: ['report', 'verify'],
    'fail-on': ['gate', 'report', 'verify', 'lock', 'lock-check'],
    'timeout-ms': ['collect', 'recheck', 'verify', 'delivery'],
    previous: ['compare', 'recheck', 'report'],
    case: ['case', 'update', 'export', 'recheck'],
    run: ['run', 'evidence', 'packet', 'audit', 'assess', 'save', 'compare', 'report', 'gate'],
  }))
    if (values[flag] !== undefined && !commands.includes(command))
      throw new Error(`--${flag} is not supported by this review command.`);
  const workspace = new ReviewWorkspace(await loadReviewConfig(values.config));
  let input = values.input ? await readJson(values.input) : {};
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Input must be a JSON object.');
  if (['plan', 'verify', 'delivery', 'lock', 'lock-check'].includes(command)) {
    if (!values.plan) throw new Error('This command requires --plan <portable case JSON>.');
    if (['plan', 'lock', 'lock-check'].includes(command) && values.input)
      throw new Error('This command does not accept --input.');
    input = {
      [command === 'delivery' ? 'contract' : 'data']: await readJson(values.plan),
      ...(['verify', 'delivery'].includes(command) ? { inputs: input } : {}),
    };
  }
  if (command === 'import') input = { data: input };
  if (values.run) input.runId = values.run;
  if (values.case) input.caseId = values.case;
  if (values.previous) input.previousRunId = values.previous;
  if (values.format) input.format = values.format;
  if (values.lang) input.lang = values.lang;
  if (values['fail-on']) input.failOn = values['fail-on'];
  if (command === 'lock' && !values['lock-output'])
    throw new Error('lock requires --lock-output <new file>.');
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
    if (command === 'lock')
      await writeFile(path.resolve(values['lock-output']), JSON.stringify(result, null, 2) + '\n', {
        flag: 'wx',
        mode: 0o600,
      });
    console.log(JSON.stringify(result));
    if (command === 'lock-check') process.exitCode = result.passed ? 0 : 1;
    if (command === 'gate') process.exitCode = result.passed ? 0 : 1;
    if (command === 'delivery') process.exitCode = result.passed ? 0 : 1;
    if (command === 'verify') process.exitCode = result.gate.passed ? 0 : 1;
  } catch (error) {
    if (error.code !== 'SHIPLENS_PLAN_LOCK_BLOCKED') throw error;
    console.log(JSON.stringify(error.inspection));
    process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', abort);
    process.removeListener('SIGTERM', abort);
  }
}
