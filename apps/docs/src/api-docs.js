import { t } from './i18n.js';
import { code, p, h, note, table } from './markup.js';
import apiExample from '../../../packages/cli/examples/api.mjs?raw';
export function apiDocs() {
  return {
    id: 'api',
    source: 'api-docs.js',
    group: t('Integrations', '集成'),
    title: t('JavaScript API', 'JavaScript API'),
    description: t(
      'Signatures, complete options and report fields for every public export.',
      '每个公开导出的签名、完整参数与报告字段。',
    ),
    body:
      h('imports', 'Install and import', '安装与导入') +
      code('npm install --save-dev --save-exact shiplens\nnpx shiplens browsers') +
      code(
        "import { scan, validateOptions, compareBaseline } from 'shiplens';\nimport type { ScanOptions, Report, InteractionFlow, IgnoreEntry } from 'shiplens';",
        'TypeScript / ESM',
      ) +
      p(
        'Requires Node.js 22.12+. The package exposes these three runtime functions from its root ESM entry. TypeScript declarations are included; CommonJS require and importing the scanner into a frontend browser bundle are not supported.',
        '需要 Node.js 22.12+。包从根 ESM 入口公开三个运行时函数，包含 TypeScript 声明。不支持 CommonJS require，也不支持将扫描器导入前端浏览器打包产物。',
      ) +
      h('scan', 'scan(options)', 'scan(options)') +
      p(
        '<code>scan(options: ScanOptions): Promise&lt;Report&gt;</code>',
        '<code>scan(options: ScanOptions): Promise&lt;Report&gt;</code>',
      ) +
      code(
        "const report = await scan({\n  url: 'http://127.0.0.1:3000',\n  crawl: false,\n  viewport: 'both',\n  output: '.shiplens',\n  onProgress: ({ url, viewport, page, flow }) => {\n    console.log({ url, viewport, page, flow });\n  }\n});\nconsole.log(report.summary, report.runDirectory);\nprocess.exitCode = report.summary.errors || report.summary.incomplete ? 1 : 0;",
        'JavaScript',
      ) +
      p(
        'Starts Chromium, checks the scope and writes HTML, JSON, Markdown and screenshot files before returning. Findings and incomplete page/step checks are returned in Report; they do not reject the promise. Invalid options, unreadable state/baseline files, browser launch failures and report write errors reject it. An exception from onProgress also rejects the scan. Use try/catch for execution failures.',
        '启动 Chromium，检查指定范围，写完 HTML、JSON、Markdown 和截图后返回。发现问题或页面/步骤检查未完成时返回 Report，不会拒绝 Promise；参数无效、登录态/基线不可读、浏览器启动或报告写入失败会拒绝 Promise，onProgress 抛错也会终止扫描。请用 try/catch 处理执行失败。',
      ) +
      p(
        'scan() never sets process.exitCode. Decide your own threshold using summary.errors, warnings and incomplete. For strict coverage also check truncated and summary.scrollLimited. The same page is checked once normally plus once per matching flow, in each selected viewport.',
        'scan() 不修改 process.exitCode。请用 summary.errors、warnings 和 incomplete 决定阈值。严格覆盖检查还需查看 truncated 和 summary.scrollLimited。同一页面在每个选定视口先普通检查一次，再为每个匹配流程检查一次。',
      ) +
      h(
        'validate-options',
        'validateOptions(options): ScanOptions',
        'validateOptions(options): ScanOptions',
      ) +
      code(
        "const options = validateOptions({\n  url: 'http://127.0.0.1:3000',\n  pages: ['/dashboard'],\n  viewport: 'mobile'\n});\nconsole.log(options.maxPages); // 10\nconsole.log(options.pages); // absolute URLs\nawait scan(options);",
        'JavaScript',
      ) +
      p(
        'Synchronous validation with defaults. Returns a new top-level options object, normalizes URLs, deduplicates pages and adds flow starting pages. Throws Error for malformed supported options. It does not open a browser, read files, validate selectors against a DOM or confirm that a website is reachable. Numeric scan limits accept numeric strings at runtime; TypeScript callers should pass numbers.',
        '同步校验并补齐默认值，返回新的顶层参数对象，规范化 URL、去重页面并加入流程起始页面。支持的参数格式错误时抛出 Error。不启动浏览器、不读取文件、不在 DOM 上验证选择器，也不确认站点可访问。运行时扫描数值参数接受数字字符串，TypeScript 调用请传数字。',
      ) +
      h(
        'compare-baseline',
        'compareBaseline(findings, baseline)',
        'compareBaseline(findings, baseline)',
      ) +
      code(
        "import { readFile } from 'node:fs/promises';\nconst baseline = JSON.parse(await readFile('previous/report.json', 'utf8'));\nconst changes = compareBaseline(report.findings, baseline);\nconsole.log(changes.new);       // fingerprint[]\nconsole.log(changes.unchanged); // fingerprint[]\nconsole.log(changes.absent);   // fingerprint[]",
        'JavaScript',
      ) +
      p(
        'Synchronous in-memory fingerprint comparison. findings is Finding[] from the current scan. baseline needs schemaVersion: 1 or 2 and findings containing string fingerprints. Returns { new, unchanged, absent }, each an array of fingerprint strings. It does not read a path, write files, inspect coverage or return resolved. Invalid baseline structure throws Error.',
        '同步内存指纹比较。findings 为当前扫描的 Finding[]；baseline 需要 schemaVersion 为 1 或 2，且 findings 含字符串指纹。返回 { new, unchanged, absent }，每项均为指纹字符串数组。不读取路径、不写文件、不检查覆盖，也不返回 resolved。基线结构错误时抛出 Error。',
      ) +
      note(
        'For resolution claims, use scan({ ...options, baseline: "previous/report.json" }) and inspect report.comparison.comparable and resolved. Absence alone is not evidence of repair.',
        '需要判断修复时，请使用 scan({ ...options, baseline: "previous/report.json" })，查看 report.comparison.comparable 与 resolved；仅本次未发现不能证明已修复。',
      ) +
      p(
        'For AI acceptance criteria and replayable cases, see the separate <a href="#/docs/review-api">shiplens/review API</a>.',
        'AI 验收项与可重放案例见独立的 <a href="#/docs/review-api">shiplens/review API</a>。',
      ) +
      h('options', 'Every ScanOptions field', '全部 ScanOptions 字段') +
      table([
        [
          'url',
          'Required HTTP(S) starting URL without embedded credentials.',
          '必填 HTTP(S) 起始 URL，不允许嵌入账号密码。',
        ],
        [
          'pages',
          'string[], default []; exact extra URLs/paths, including hash routes.',
          'string[]，默认 []；额外精确 URL/路径，支持 hash 路由。',
        ],
        [
          'captureDom',
          'boolean, default false; save bounded visible DOM observations beside screenshots. ReviewWorkspace enables this automatically. Failed capture produces evidence-failed and an incomplete check. PageCheck and StepResult may contain an observation relative path.',
          'boolean，默认 false；在截图旁保存有限的可见页面结构。ReviewWorkspace 自动启用。采集失败生成 evidence-failed 并将检查标为未完成。PageCheck 与 StepResult 可包含 observation 相对路径。',
        ],
        [
          'crawl',
          'boolean, default true; follow same-origin anchors.',
          'boolean，默认 true；发现同源链接。',
        ],
        [
          'maxPages',
          'number, default 10; integer 1–100, including entry and flow pages.',
          'number，默认 10；整数 1–100，包含入口与流程页面。',
        ],
        [
          'viewport',
          'both (default), desktop (1440×900) or mobile (390×844).',
          'both（默认）、desktop（1440×900）、mobile（390×844）。',
        ],
        [
          'timeout',
          'number, default 15000; integer 1000–120000 ms for navigation, readiness, screenshots and steps unless overridden.',
          'number，默认 15000；整数 1000–120000 毫秒，用于导航、就绪、截图及未单独设超时的步骤。',
        ],
        [
          'settle',
          'number, default 1000; integer 0–10000 ms minimum observation delay. Pending first-party script/data requests get an additional bounded wait.',
          'number，默认 1000；整数 0–10000 毫秒最短观察等待。第一方脚本/数据请求未结束时另有有限等待。',
        ],
        [
          'waitFor',
          'string, default empty; wait for the first matching visible ready element before checks and flows.',
          'string，默认空；在普通检查和流程开始前等待第一个匹配的就绪元素可见。',
        ],
        [
          'scroll',
          'boolean, default true; bounded window scrolling.',
          'boolean，默认 true；有限窗口滚动。',
        ],
        ['scrollSteps', 'number, default 6; integer 0–30.', 'number，默认 6；整数 0–30。'],
        [
          'storageState',
          'Optional path to Playwright cookies/localStorage JSON; defaults to anonymous.',
          '可选 Playwright Cookie/localStorage JSON 路径，默认匿名。',
        ],
        [
          'allowRequests',
          'Array of {method, path}, default []; exact same-origin POST/PUT/PATCH/DELETE endpoint. Paths exclude query/hash; all queries on that path are allowed.',
          '{method, path} 数组，默认 []；精确同源 POST/PUT/PATCH/DELETE 接口。path 不含查询/hash，该路径所有查询参数均可匹配。',
        ],
        [
          'mask',
          'string[], default []; screenshot mask selectors, plus automatic password and flow fill-target masks.',
          'string[]，默认 []；截图遮盖选择器，另自动遮盖密码框和流程 fill 目标。',
        ],
        [
          'ignoreRules',
          'string[], default []; disable whole non-operational rules before collection.',
          'string[]，默认 []；在采集前关闭整个非运行失败规则。',
        ],
        [
          'flows',
          'InteractionFlow[], default []; see the interaction-step reference.',
          'InteractionFlow[]，默认 []；详见交互步骤参考。',
        ],
        [
          'ignore',
          'IgnoreEntry[], default []; see precise-ignore matching and expiry.',
          'IgnoreEntry[]，默认 []；详见精确忽略匹配与到期规则。',
        ],
        [
          'output',
          'string, default .shiplens; parent for a unique run directory.',
          'string，默认 .shiplens；每次独立运行目录的父目录。',
        ],
        [
          'exclude',
          'string[], default []; path/hash-route prefixes starting with /.',
          'string[]，默认 []；以 / 开头的路径/hash 路由前缀。',
        ],
        [
          'baseline',
          'Optional report.json path for coverage-aware comparison.',
          '可选 report.json 路径，用于含覆盖检查的比较。',
        ],
        ['lang', 'en (default) or zh; report labels.', 'en（默认）或 zh；报告标签语言。'],
        [
          'onProgress',
          'Optional synchronous ({url, viewport, page, flow?}) callback before each check. page is 1-based; flow is absent for ordinary checks.',
          '每次检查前可选同步回调 ({url, viewport, page, flow?})；page 从 1 开始，普通检查无 flow。',
        ],
      ]) +
      p(
        'API file paths resolve from process.cwd(). CLI JSON file paths resolve from the config directory, while CLI path overrides resolve from cwd. JSON accepts these fields except onProgress, plus failOn: error | warning | none (CLI only). CLI-only output controls such as --json are not scan options. <a href="#/docs/cli">Full CLI reference →</a>',
        'API 文件路径从 process.cwd() 解析；CLI JSON 文件路径从配置目录解析，CLI 覆盖路径从 cwd 解析。JSON 接受除 onProgress 外的上述字段，并增加仅 CLI 使用的 failOn: error | warning | none。--json 等 CLI 输出控制不是 scan 参数。<a href="#/docs/cli">完整 CLI 参考 →</a>',
      ) +
      h('report', 'Report return value', 'Report 返回值') +
      table([
        [
          'schemaVersion / version',
          'Report schema (2) and generating npm package version.',
          '报告结构版本（2）与生成报告的 npm 包版本。',
        ],
        [
          'target / lang',
          'Redacted starting URL and report language.',
          '脱敏起始 URL 与报告语言。',
        ],
        [
          'startedAt / completedAt / durationMs',
          'ISO timestamps and elapsed milliseconds.',
          'ISO 时间戳与耗时毫秒。',
        ],
        [
          'runDirectory',
          'Absolute run folder; returned by scan(), omitted from saved report.json.',
          '运行目录绝对路径，仅 scan() 返回，不写入 report.json。',
        ],
        [
          'options',
          'Recorded scan scope. Authentication, original targets, flow values and precise-ignore configuration use fingerprints for comparability.',
          '记录的扫描范围；登录态、原始目标、流程值与精确忽略配置用指纹判断可比性。',
        ],
        [
          'summary',
          'pages, checks, errors, warnings, incomplete, groups, scrollLimited, suppressed. Counts include all selected viewport/flow checks.',
          'pages、checks、errors、warnings、incomplete、groups、scrollLimited、suppressed，计数覆盖所选视口和流程。',
        ],
        [
          'pages',
          'Array of {url, title?, discoveredFrom, checks}. URLs are redacted; discoveredFrom describes explicit input or a same-origin link.',
          '{url, title?, discoveredFrom, checks} 数组，URL 已脱敏，discoveredFrom 标识显式输入或同源链接。',
        ],
        [
          'findings',
          'Active Finding[] used for severity counts and baseline comparison.',
          '活动 Finding[]，用于级别计数和基线比较。',
        ],
        [
          'suppressed',
          'Retained findings with suppression: {index, reason, expires?}; index is 1-based.',
          '保留的忽略问题，附 suppression: {index, reason, expires?}，index 从 1 开始。',
        ],
        [
          'ignoreWarnings',
          'string[] describing expired ignore entries.',
          'string[]，说明已到期忽略条目。',
        ],
        [
          'skipped',
          'Array of {url, viewport, reason} for blocked requests/navigation.',
          '{url, viewport, reason} 数组，记录被阻止的请求/导航。',
        ],
        [
          'truncated / remainingPages',
          'Whether page discovery exceeded the budget; remainingPages is the bounded pending queue, not a total site page count.',
          '是否超出页面发现预算；remainingPages 是有限待处理队列数，不是全站页面总数。',
        ],
        [
          'comparison',
          'Present with a baseline: new, unchanged, absent, resolved fingerprint arrays; comparable boolean; note string.',
          '提供基线时存在：new、unchanged、absent、resolved 指纹数组，comparable 布尔值及 note 说明。',
        ],
      ]) +
      h('check-fields', 'PageCheck and StepResult', 'PageCheck 与 StepResult') +
      p(
        'Each pages[].checks[] item includes viewport, status (complete | incomplete), screenshot (relative path or null), scrollTruncated, notes and blockedRequests. Optional httpStatus is a number or null; finalUrl is the last recorded destination; screenshotMode is full-page | viewport. Flow checks also include flow (name) and steps.',
        'pages[].checks[] 每项包含 viewport、status（complete | incomplete）、screenshot（相对路径或 null）、scrollTruncated、notes 和 blockedRequests。可选 httpStatus 为数字或 null，finalUrl 为最后记录的目标，screenshotMode 为 full-page | viewport。流程检查另含 flow 名称与 steps。',
      ) +
      p(
        'Each step contains index (1-based), action, selector, status (passed | failed | skipped), screenshot and optional detail. Input values are omitted. A passed step can still produce browser findings; use the whole report when deciding whether a check passed.',
        '每步包含从 1 开始的 index、action、selector、status（passed | failed | skipped）、screenshot 与可选 detail，不保存输入 value。步骤通过仍可能产生浏览器问题，判断整体通过请查看完整报告。',
      ) +
      h('finding-fields', 'Finding fields', 'Finding 字段') +
      p(
        'A finding includes code, severity (error | warning), title, detail, subject, url, viewport, screenshot (path or null) and fingerprint. Optional fields: selector, elementScreenshot, statusCode, elements (overflow candidates with selector/right/width), flow and step. Paths are relative to runDirectory. A step finding refers to the starting page plus flow/step, even if the action navigated to another route; inspect finalUrl and the screenshot for destination evidence.',
        '问题包含 code、severity（error | warning）、title、detail、subject、url、viewport、screenshot（路径或 null）和 fingerprint。可选字段为 selector、elementScreenshot、statusCode、elements（含 selector/right/width 的溢出候选）、flow、step。路径相对 runDirectory。即便操作跳到其他路由，步骤问题仍以起始页面和 flow/step 标识，目标证据请查看 finalUrl 和截图。',
      ) +
      h('complete-example', 'Complete executable example', '完整可执行案例') +
      code(apiExample, 'examples/api.mjs') +
      p(
        '<a href="#/docs/examples">Start the included demo and execute this file directly →</a>',
        '<a href="#/docs/examples">启动包内演示站并直接执行此文件 →</a>',
      ),
  };
}
