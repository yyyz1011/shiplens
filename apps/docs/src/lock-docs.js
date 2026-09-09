import { t } from './i18n.js';
import { h, p, code, note, dataTable as table } from './markup.js';
import results from '../public/plan-lock/results.json';

export function lockDocs() {
  return {
    id: 'acceptance-lock',
    source: 'lock-docs.js',
    group: t('Get started', '开始使用'),
    title: t('Acceptance standard lock', '验收标准锁'),
    description: t(
      'Detect changed requirements before an AI-assisted verification can pass under a different standard.',
      '在 AI 辅助验收按另一套标准通过前，发现验收要求的变化。',
    ),
    body:
      h('why', 'What this adds to Playwright', '相比直接使用 Playwright，增加了什么') +
      p(
        'A browser test evaluates its current assertions. If “equals ¥129” becomes “contains ¥”, a ¥999 page can pass. ShipLens compares the candidate plan and host policy with an independently approved lock before it opens a browser. A changed check yields a structured difference and a blocked verification.',
        '浏览器测试执行当前断言。如果“等于 ¥129”变成“包含 ¥”，¥999 的页面也能通过。ShipLens 在打开浏览器前，先将候选验收文件与主机策略和独立确认的标准锁比对。断言变更会返回结构化差异并阻止验收。',
      ) +
      p(
        'This is a packaged policy layer, not a browser capability Playwright cannot reproduce. Playwright already provides <a href="https://playwright.dev/docs/test-agents">test agents</a> and <a href="https://playwright.dev/docs/test-assertions">assertions</a>. A custom standard guard can match this behavior, as our comparison shows. ShipLens supplies lock creation, field differences, CLI/API/MCP enforcement and report linkage together.',
        '这是一层现成的验收策略，并非 Playwright 无法复现的浏览器能力。Playwright 已有 <a href="https://playwright.dev/docs/test-agents">测试代理</a> 和 <a href="https://playwright.dev/docs/test-assertions">断言</a>。自建标准保护层也能达到相同行为，下方对照已验证。ShipLens 将锁定、字段差异、CLI / API / MCP 拦截与报告关联一起提供。',
      ) +
      h('start', 'Run the bundled example', '运行包内案例') +
      code(
        'npm install --save-dev shiplens\nnpx shiplens browsers\nnode node_modules/shiplens/examples/plan-lock-server.mjs',
      ) +
      p(
        'Leave the demo running on port 3002. In a second terminal:',
        '让案例应用在 3002 端口保持运行，在第二个终端执行：',
      ) +
      code('node node_modules/shiplens/examples/plan-lock.mjs') +
      p(
        'Expected JSON: originalPassed is false because the page shows ¥999; changedBlocked is true after the example weakens the price check. originalReport points to the browser report. inspection identifies the changed price.checks field. The demo creates its own lock only to illustrate the API; production must supply an independently approved fingerprint.',
        '预期 JSON：页面显示 ¥999，因此 originalPassed 为 false；示例把金额断言改松后，changedBlocked 为 true。originalReport 指向浏览器报告，inspection 指出 price.checks 发生变化。案例现场生成锁仅用于演示 API；生产流程必须提供独立确认的指纹。',
      ) +
      h('cli', 'Create and enforce a reviewed lock', '创建并执行已确认的标准锁') +
      p(
        'Create shiplens.config.json below and review the bundled locked-plan.json before approving it. The server from the previous section supplies this example’s page.',
        '创建下方 shiplens.config.json，确认包内 locked-plan.json 的要求后再批准它。本例使用上一节启动的案例页面。',
      ) +
      code(
        JSON.stringify(
          {
            url: 'http://127.0.0.1:3002',
            viewport: 'both',
            crawl: false,
            scroll: false,
            settle: 0,
            timeout: 1000,
            output: '.shiplens',
          },
          null,
          2,
        ),
        'shiplens.config.json',
      ) +
      code(
        'npx shiplens review lock --config shiplens.config.json --plan node_modules/shiplens/examples/locked-plan.json --lock-output approved.lock.json',
      ) +
      p(
        'The command writes a new file exclusively and prints its manifest, including sha256. It never overwrites an existing lock. Preserve the approved file and copy its fingerprint into a separately controlled host configuration. Add this field to the same config and save it as locked.config.json:',
        '命令以禁止覆盖的方式写入新文件，并输出包含 sha256 的完整清单。保存已确认的文件，将指纹固定在独立控制的主机配置中。在相同配置中增加下面字段，保存为 locked.config.json：',
      ) +
      code(
        '"acceptanceLock": {\n  "file": "approved.lock.json",\n  "sha256": "REPLACE_WITH_THE_REVIEWED_64_CHARACTER_SHA256"\n}',
        'Configuration field',
      ) +
      code(
        'npx shiplens review lock-check --config locked.config.json --plan node_modules/shiplens/examples/locked-plan.json\nnpx shiplens review verify --config locked.config.json --plan node_modules/shiplens/examples/locked-plan.json',
      ) +
      p(
        'lock-check compares without browsing or creating a run. verify checks the lock first, then runs unchanged plans with fresh evidence. The deliberately wrong demo makes verify exit 1 even when the lock matches. lock and lock-check do not accept --input; verify accepts --input inputs.json containing a JSON object of named values. --fail-on error|warning is part of the locked policy and defaults to the approved threshold.',
        'lock-check 只比对，不访问网页或创建运行。verify 先检查标准锁，再为未变化的文件采集新证据。案例页面刻意显示错误金额，因此即使标准匹配，verify 也会退出 1。lock 与 lock-check 不接受 --input；verify 支持 --input inputs.json，该文件包含命名值的 JSON 对象。--fail-on error|warning 属于锁定策略，默认使用已确认的阈值。',
      ) +
      table(
        [
          [
            '0',
            t(
              'Lock written; comparison matched; or verification gate passed.',
              '锁写入成功、比对匹配，或验收门禁通过。',
            ),
          ],
          [
            '1',
            t(
              'Changed/invalid candidate in lock-check; changed standard or failed/pending verification in verify.',
              'lock-check 候选变化或无效；verify 标准变化，或验收失败 / 待确认。',
            ),
          ],
          [
            '2',
            t(
              'Configuration, fingerprint, input file or other invocation error.',
              '配置、指纹、输入文件或其他调用错误。',
            ),
          ],
        ],
        [t('Exit', '退出码'), t('Meaning', '含义')],
      ) +
      p(
        'The lock path is relative to the config file; --lock-output and --plan are relative to the command’s working directory. Lock files are limited to 512 KiB. CLI output is JSON. A mismatch contains no website verdict because no browser ran.',
        '锁文件路径相对于配置文件；--lock-output 与 --plan 相对于命令工作目录。锁文件上限为 512 KiB。CLI 输出 JSON。不匹配时没有网站验收结论，因为浏览器尚未执行。',
      ) +
      h('api', 'JavaScript / TypeScript API', 'JavaScript / TypeScript API') +
      code(
        `import { readFile } from 'node:fs/promises';
import { ReviewWorkspace } from 'shiplens/review';
const data = JSON.parse(await readFile('acceptance.json', 'utf8'));
const lock = JSON.parse(await readFile('/trusted/approved.lock.json', 'utf8'));
const expected = process.env.SHIPLENS_APPROVED_LOCK_SHA256;
if (!expected) throw new Error('Trusted fingerprint is required');
const workspace = new ReviewWorkspace({
  directory: '.shiplens/reviews',
  options: { url: 'http://127.0.0.1:3002', viewport: 'both',
    crawl: false, scroll: false, settle: 0, timeout: 1000 },
  acceptanceLock: { lock, sha256: expected }
});
const inspection = workspace.checkPlanLock({ data });
console.log(inspection);
try {
  const result = await workspace.verify({ data });
  console.log(result.gate.planLock, result.report.file);
} catch (error) {
  if (error.code !== 'SHIPLENS_PLAN_LOCK_BLOCKED') throw error;
  console.log(error.inspection);
  process.exitCode = 1;
}`,
        'JavaScript',
      ) +
      table(
        [
          [
            'createPlanLock({ data, failOn? })',
            t(
              'Synchronous; returns AcceptanceLock. Call on an unlocked ReviewWorkspace after reviewing the plan and host policy. No file writes or browser. Example: const lock = host.createPlanLock({ data, failOn: "error" }).',
              '同步返回 AcceptanceLock。在未锁定的 ReviewWorkspace 中，确认文件与主机策略后调用。不写文件、不打开浏览器。例如 const lock = host.createPlanLock({ data, failOn: "error" })。',
            ),
          ],
          [
            'checkPlanLock({ data, failOn? })',
            t(
              'Synchronous; requires a host lock. Returns PlanLockCheck: passed, status, lockSha256, definitionSha256/policySha256 when parseable, changes, totalChanges, changesTruncated and note.',
              '同步调用，需要主机标准锁。返回 PlanLockCheck：passed、status、lockSha256、可解析时的 definitionSha256 / policySha256、changes、totalChanges、changesTruncated 与 note。',
            ),
          ],
          [
            'verify({ data, inputs?, failOn? })',
            t(
              'With a lock, rejects changes before side effects using SHIPLENS_PLAN_LOCK_BLOCKED and error.inspection. Matching plans use normal acceptance checks. Unlocked hosts retain the existing behavior.',
              '锁定时在产生执行副作用前拒绝变化，错误码 SHIPLENS_PLAN_LOCK_BLOCKED，差异位于 error.inspection。匹配后执行正常验收。未锁定主机保留原有行为。',
            ),
          ],
          [
            'gate({ runId, failOn? }) / getRun(runId)',
            t(
              'Runs store planLock digests. A locked gate validates the receipt, current policy/profile and approved requirements; returns planLock: { sha256, matched }. Missing or incompatible receipts block. HTML/Markdown reports show this validation when exported by the locked host.',
              '运行保存 planLock 指纹。锁定门禁验证凭据、当前策略 / 配置指纹与已确认要求，返回 planLock: { sha256, matched }。凭据缺失或不兼容会拦截。通过锁定主机导出的 HTML / Markdown 报告展示该验证。',
            ),
          ],
        ],
        [t('Method', '方法'), t('Behavior', '行为')],
      ) +
      p(
        'Each change gives kind, field, optional criterionId, and JSON-string before/after previews (null for an absent side). Output retains at most 200 differences and 500 characters per preview; totalChanges and changesTruncated expose omitted details. Any change blocks, including those beyond the display limit. Invalid candidate shape returns status invalid-plan; invalid locks or duplicate identifiers throw.',
        '每条变更包含 kind、field、可选 criterionId，以及 JSON 字符串形式的 before / after 预览（缺失的一侧为 null）。最多展示 200 条差异，每侧 500 字符；totalChanges 与 changesTruncated 表明是否省略。所有变化都会阻止验收，包括未展示的部分。候选结构无效返回 invalid-plan；锁无效或标识重复会抛错。',
      ) +
      h('policy', 'What stays fixed', '锁定哪些内容') +
      table(
        [
          [
            t('Acceptance definition', '验收定义'),
            t(
              'Every requirement field and all portable flows: descriptions, pages, selectors, viewports, checks, evaluation mode and steps.',
              '每个验收项的全部字段及所有可移植流程：描述、页面、选择器、视口、断言、判断方式与步骤。',
            ),
          ],
          [
            t('Host policy', '主机策略'),
            'entry (path/search/hash), pages, viewport, exclude, ignoreRules, ignore, mask, allowRequests, maxPages, crawl, scroll, scrollSteps, waitFor, timeout, settle, failOn',
          ],
          [
            t('Allowed metadata changes', '允许的元信息变化'),
            t(
              'Plan name, tags, object-key order and requirement order.',
              '验收文件名称、标签、对象键顺序与验收项顺序。',
            ),
          ],
          [
            t('Runtime values are not pinned', '未锁定的运行时内容'),
            t(
              'Origin, output directory, presentation language, authentication state and runtime input values. Host flows are replaced by the plan’s flows during verify. Moving to another preview origin needs a fresh verification; historical run profiles remain checked.',
              '来源域名、输出目录、展示语言、登录态与运行时输入值。verify 使用验收文件流程替换主机流程。更换预览域名后需重新验收，历史记录仍会核对配置指纹。',
            ),
          ],
        ],
        [t('Area', '范围'), t('Rule', '规则')],
      ) +
      note(
        'This is an identity check, not a judgment that a change weakens a requirement. Added or stronger requirements also need a reviewed replacement lock. A lock does not validate the correctness of its initial requirements, runtime input values or AI judgments.',
        '这是定义一致性检查，不判断某次变更是否削弱要求。新增或增强要求也需要重新确认标准锁。锁不会验证初始需求、运行时输入值或 AI 判断本身是否正确。',
      ) +
      h('mcp', 'MCP and trusted CI integration', 'MCP 与可信 CI 集成') +
      p(
        'Start shiplens mcp --config locked.config.json. The 25-tool server adds shiplens_check_plan_lock({ data, failOn? }), a read-only tool returning the same comparison. shiplens_verify enforces the host lock automatically; a mismatch isError response includes structuredContent with the inspection. There is no MCP create/update-lock tool. collect, recheck and verifyDelivery are unavailable in a locked workspace; use verify. Use a separate host for delivery contracts.',
        '运行 shiplens mcp --config locked.config.json。共 25 个工具，其中新增只读 shiplens_check_plan_lock({ data, failOn? })，返回相同比对结构。shiplens_verify 自动执行主机标准锁；不匹配时 isError 响应通过 structuredContent 返回差异。MCP 没有创建或更新锁的工具。锁定工作区不可调用 collect、recheck 与 verifyDelivery，需使用 verify；保存契约使用独立主机。',
      ) +
      p(
        'For CI, the trusted host loads an approved lock from a protected baseline checkout and its expected SHA-256 from separately reviewed CI configuration. It then loads only the candidate plan and app from the proposed change. Keep the enforcing script, dependencies, policy and pin outside that change’s control. A maintainer reviews any intentional standard change and updates the approved file and pin together. Do not regenerate the pin from the candidate lock on each run.',
        'CI 中，可信主机从受保护的基线检出中加载已确认标准锁，从独立评审的 CI 配置读取预期 SHA-256，再从待合并修改中加载候选验收文件与应用。执行脚本、依赖、策略和指纹都需独立于候选修改受到控制。有意修改标准时，由维护者评审后同步更新文件与指纹。不要每次从候选锁文件现场重新生成预期指纹。',
      ) +
      p(
        'The package does not configure branch protection or create a security boundary against an actor controlling the host. If an assistant can rewrite the lock, expected digest and enforcement code, it can bypass this guard. Report fingerprints are references checked by a trusted host, not signed, tamper-proof audit records.',
        '本包不会配置分支保护，也无法防御已经控制执行主机的行为方。若助手能重写锁、预期指纹和执行代码，它仍可绕过检查。报告指纹是可信主机核对的引用，并非签名或不可篡改的审计记录。',
      ) +
      h('proof', 'Recorded comparison and raw outputs', '已记录对照与原始输出') +
      p(
        'One maintainer-controlled order-summary app, Playwright Test running real desktop/mobile assertions, and a pinned ShipLens host. Each case ran once. Six candidate changes made native test commands succeed; all six were blocked before browsing by ShipLens and by a separately coded standard guard. The three unchanged controls were healthy, unfixed wrong value, and metadata-only edits. This measures contract enforcement, not AI-model accuracy, user setup time or broad competitor superiority.',
        '一个维护者自建订单摘要应用，Playwright Test 实际运行桌面 / 手机断言，并对比固定标准的 ShipLens 主机。每个案例运行一轮。六种候选变更使原生测试命令成功；ShipLens 与独立编写的标准保护层都在浏览器执行前拦住六种变更。三个未改标准的对照分别是正常页面、错误值未修复、仅元信息调整。这测量标准执行，不测量 AI 模型准确率、用户接入耗时或广泛的竞品优劣。',
      ) +
      table(
        results.cases.map((c) => [
          c.id,
          String(c.nativeExit),
          c.shiplens.blockedBeforeBrowser
            ? t('Blocked before browser', '浏览器执行前拦截')
            : String(c.shiplens.gate?.passed),
          `<a href="${import.meta.env.BASE_URL}plan-lock/${c.id}/native-result.json">Playwright JSON</a> · <a href="${import.meta.env.BASE_URL}plan-lock/${c.id}/lock-result.json">ShipLens JSON</a>`,
        ]),
        [
          t('Case', '案例'),
          t('Native exit', '原生命令退出码'),
          'ShipLens',
          t('Raw output', '原始输出'),
        ],
      ) +
      `<p><a href="${import.meta.env.BASE_URL}plan-lock/results.json">${t('Complete manifest, methods and artifact SHA-256 checksums', '完整清单、方法与产物 SHA-256 校验值')}</a> · <a href="https://github.com/yyyz1011/shiplens/tree/master/benchmarks/plan-lock">${t('Reproduction source', '复现源码')}</a></p>` +
      p(
        'Native JSON contains the actual assertion results and skipped-test counts. Omitting the mobile criterion produces an explicit mobile skip; narrowing the host removes its mobile project. Artifact paths were normalized before hashing. Reproduce from the repository with npm ci, npm run browsers and npm run benchmark:lock; npm run benchmark:verify verifies the published artifact checksums.',
        '原生 JSON 包含真实断言结果与跳过测试数。省略手机端要求会产生明确的手机测试跳过；缩小主机范围则移除手机项目。产物中的路径在计算指纹前已归一化。在仓库中执行 npm ci、npm run browsers 与 npm run benchmark:lock 即可复现；npm run benchmark:verify 验证公开产物的校验值。',
      ),
  };
}
