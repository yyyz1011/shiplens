import { t } from './i18n.js';
import { code, p, h, note, table } from './markup.js';
import workflowExample from '../../../packages/cli/examples/workflow.mjs?raw';
const page = (id, en, zh, descriptionEn, descriptionZh, body) => ({
  id,
  source: 'lifecycle-docs.js',
  group: t('AI review', 'AI 验收'),
  title: t(en, zh),
  description: t(descriptionEn, descriptionZh),
  body,
});
export function scopedReviewDocs() {
  return page(
    'scoped-review',
    'Scoped evidence & comparison',
    '局部证据与修复对比',
    'Capture one component and compare the same acceptance state across runs.',
    '采集单个组件，并对比多轮运行中相同的验收状态。',
    h('scope', 'Capture the state that matters', '采集验收所需的状态') +
      code(
        `const run = await workspace.collect({
  requirements: [{ id: 'details', description: 'Details show the itinerary.',
    page: '/', flow: 'open', step: 1, selector: '#details-panel' }],
  flows: [{ name: 'open', page: '/', steps: [{ action: 'click', selector: '#details' }] }],
});`,
        'JavaScript',
      ) +
      p(
        'Use the optional Requirement.selector (1–2000 characters) for exactly one visible element. Omit it to retain whole-page evidence. Each region returns its own PNG, DOM and evidence ID at the requested flow/step/device. Missing, ambiguous or oversized regions remain incomplete; no fallback silently broadens the scope. Read every requested device before assessing.',
        '可选 Requirement.selector（1–2000 字符）限定一个唯一、可见的元素；省略时保持整页取证。每个区域在指定流程、步骤和设备上产生独立 PNG、DOM 与证据 ID。目标缺失、匹配多个元素或区域过大时保留为不完整，不会悄悄扩大范围。判断前读取所有指定设备的证据。',
      ) +
      table([
        [
          'Budgets',
          'DOM: 8,000 characters / 100 elements / 10,000 visited nodes. Region image: at most 12 million pixels and 12,000px height. Evidence reads: PNG 6 MiB, DOM file 256 KiB.',
          'DOM 上限：8,000 字符、100 个元素、遍历 10,000 个节点。区域图片不超过 1,200 万像素与 12,000px 高。读取 PNG 上限 6 MiB，DOM 文件 256 KiB。',
        ],
        [
          'Privacy',
          'Configured masks and fill targets also apply to regional captures. Form values are excluded from DOM text. Frames and shadow DOM are not traversed.',
          '区域截图继续使用配置遮罩与填表目标遮罩，DOM 文本排除表单值，不遍历 iframe 与 Shadow DOM。',
        ],
        [
          'Coverage',
          'A regional pass describes that component only. Machine findings remain page/flow-scoped; limited full-page coverage can still block the final gate.',
          '区域通过只描述该组件。机器诊断仍按页面或流程保留，整页覆盖受限仍可阻止最终验收通过。',
        ],
      ]) +
      h(
        'compare',
        'compareRuns({ runId, previousRunId })',
        'compareRuns({ runId, previousRunId })',
      ) +
      code(`const next = await workspace.recheck({ caseId: saved.caseId });
const delta = await workspace.compareRuns({
  runId: next.runId, previousRunId: run.runId,
});
console.log(delta.criteria[0].transition); // awaiting-review
// Inspect and assess the new evidence, then compare again.
const report = await workspace.exportReport({
  runId: next.runId, previousRunId: run.runId, format: 'html',
});`) +
      p(
        'Returns { runId, previousRunId, criteria, removed, note }. Each criterion includes beforeStatus, afterStatus, comparable, transition and pairs. Pairs contain viewport, beforeEvidenceId, afterEvidenceId, comparable, imageChanged, textChanged and text previews (up to 1,000 characters). Missing comparisons use null. PNG comparison checks bytes; animation or font changes can change pixels without changing correctness.',
        '返回 { runId, previousRunId, criteria, removed, note }。每项包含 beforeStatus、afterStatus、comparable、transition、pairs。配对包含设备、前后证据 ID、可比性、imageChanged、textChanged 以及最多 1,000 字符的文本预览；缺少对比时使用 null。PNG 比较的是文件字节，动画或字体变化可能改变像素，但不代表正确性变化。',
      ) +
      table([
        [
          'awaiting-review',
          'New evidence exists, but the caller has not completed a fresh judgment.',
          '已有新证据，但调用方尚未完成新的判断。',
        ],
        [
          'resolved / regressed',
          'fail → pass / pass → fail with matching criterion definitions, execution profiles, input/auth signatures and complete evidence for all devices.',
          '验收定义、执行配置、输入与登录态签名一致，全部设备证据完整时，对应 fail → pass / pass → fail。',
        ],
        [
          'still-failing / still-passing',
          'Both runs have the same completed verdict under comparable conditions.',
          '条件可比且两轮已完成判断，结论一致。',
        ],
        [
          'not-comparable / added / reviewed',
          'Scope changed or evidence missing / a new criterion / a fresh verdict without a comparable prior completed verdict. Removed IDs are listed separately.',
          '范围变化或缺证 / 新验收项 / 已作新判断但没有对应的先前完整判断。被移除的 ID 单独列出。',
        ],
      ]) +
      p(
        'recheck({ caseId, inputs?, previousRunId? }) defaults to the saved source run. Supply a later run from the same case to compare the next repair; mismatched cases, requirements or host profiles reject. Imported cases have no source baseline. All rechecks start pending. MCP equivalents: shiplens_compare_runs and shiplens_recheck.',
        'recheck({ caseId, inputs?, previousRunId? }) 默认使用保存时的来源轮次。可传入同一案例的后续轮次来验证下一次修复；不同案例、验收定义或宿主配置会拒绝。导入的案例没有来源基线，所有复查仍从 pending 开始。对应 MCP：shiplens_compare_runs、shiplens_recheck。',
      ),
  );
}
export function caseLibraryDocs() {
  return page(
    'case-library',
    'Case library & portability',
    '用例库与迁移',
    'Keep review plans with your project and resume them in a new session.',
    '将验收计划保存在项目中，并在新会话继续使用。',
    h('list', 'Find and read cases or runs', '查找和读取案例、轮次') +
      code(`const cases = await workspace.listCases({ query: 'checkout', tag: 'smoke', limit: 20 });
const runs = await workspace.listRuns({ limit: 20 });
const plan = await workspace.getCase(saved.caseId);
const nextPage = await workspace.listCases({ offset: cases.nextOffset ?? 0 });`) +
      table([
        [
          'listCases({ query?, tag?, offset?, limit? })',
          'Returns { items: CaseInfo[], total, nextOffset }. CaseInfo: caseId, name, createdAt, optional sourceRunId, tags, revision, requirementCount and requiredInputs.',
          '返回 { items: CaseInfo[], total, nextOffset }。CaseInfo 包含 caseId、name、createdAt、可选 sourceRunId、tags、revision、requirementCount、requiredInputs。',
        ],
        [
          'listRuns({ query?, offset?, limit? })',
          'Same pagination shape. Items contain runId, createdAt, optional caseId, requirementCount and requirementIds. Use getRun to read judgments.',
          '同样的分页结构。每项含 runId、createdAt、可选 caseId、requirementCount、requirementIds；判断详情由 getRun 读取。',
        ],
        [
          'Limits',
          'Defaults: query empty, offset 0, limit 20. Query ≤120 characters, tag ≤40, limit 1–100. Search matches metadata case-insensitively; newest first. nextOffset null means finished. Maximum 5,000 artifacts per listing.',
          '默认 query 为空、offset 为 0、limit 为 20。query ≤120 字符，tag ≤40，limit 为 1–100。元数据搜索不区分大小写，按新到旧排序；nextOffset 为 null 表示结束。单次列表最多处理 5,000 个产物。',
        ],
        [
          'getCase(caseId)',
          'Returns CaseInfo plus requirements and parameterized flows; reading never executes browser actions.',
          '返回 CaseInfo、requirements 与参数化 flows；读取不会执行浏览器操作。',
        ],
      ]) +
      h('metadata', 'Save and organize', '保存和整理') +
      code(`const saved = await workspace.saveCase({ runId: run.runId,
  name: 'Checkout confirmation', tags: ['smoke', 'checkout'] });
await workspace.updateCase({ caseId: saved.caseId,
  name: 'Checkout confirmation on mobile', tags: ['critical'] });`) +
      p(
        'saveCase still requires every criterion to be pass/fail. Tags allow up to 20 unique strings of 1–40 characters. updateCase({ caseId, name?, tags? }) returns CaseInfo and requires at least one metadata field; names are 1–120 characters. It increments the metadata revision and preserves the execution plan. To change steps or requirements, collect and save a new case, or edit an exported plan and import it as a new ID.',
        'saveCase 仍要求所有验收项已为 pass/fail。tags 最多 20 个不重复的 1–40 字符字符串。updateCase({ caseId, name?, tags? }) 至少提供一个元数据字段，name 为 1–120 字符，返回 CaseInfo；仅递增元数据版本，不修改执行计划。修改步骤或需求时，重新采集并保存案例，或编辑导出的计划后导入为新 ID。',
      ) +
      h('portable', 'Export and import portable plans', '导出和导入可迁移计划') +
      code(`import { readFile, writeFile } from 'node:fs/promises';
const data = await workspace.exportCase({ caseId: saved.caseId });
await writeFile('checkout.case.json', JSON.stringify(data, null, 2));
const imported = await workspace.importCase({
  data: JSON.parse(await readFile('checkout.case.json', 'utf8')),
});
// Review imported.requiredInputs; supply every key if the plan contains fill steps.
const fresh = await workspace.recheck({ caseId: imported.caseId });`) +
      code(
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: 'shiplens-case',
            name: 'Search',
            tags: ['smoke'],
            requirements: [
              {
                id: 'results',
                description: 'Results show the destination',
                page: '/',
                flow: 'search',
                step: 2,
                selector: '#result',
              },
            ],
            flows: [
              {
                name: 'search',
                page: '/',
                steps: [
                  { action: 'fill', selector: '#query', valueFromInput: 'destination' },
                  { action: 'press', selector: '#query', key: 'Enter' },
                ],
              },
            ],
          },
          null,
          2,
        ),
        'search.case.json',
      ) +
      code(`const fresh = await workspace.recheck({
  caseId: imported.caseId, inputs: { destination: 'Kyoto' },
});`) +
      p(
        'exportCase returns PortableCase { schemaVersion: 1, kind: "shiplens-case", name, tags, requirements, flows }. Pages become root-relative paths on the configured origin. It excludes host policies, credentials, run IDs, screenshots and judgments. importCase({ data }) returns CaseInfo with a new ID, no sourceRunId and no inherited assessments. Imports bind to the receiving configuration; replay can still block disallowed requests.',
        'exportCase 返回 PortableCase { schemaVersion: 1, kind: "shiplens-case", name, tags, requirements, flows }。页面转换为配置来源下的根相对路径，不包含宿主策略、凭据、轮次 ID、截图或判断。importCase({ data }) 返回新 ID 的 CaseInfo，无 sourceRunId，也不继承判断。导入绑定接收方配置，重放仍会阻止未授权请求。',
      ) +
      note(
        'Imports reject unknown fields, unsupported versions, files over 512 KiB, external/secret page URLs, raw fill values, duplicate input keys and invalid flow scope. Inputs are required strings of at most 10,000 characters. Other text such as notes in descriptions, selectors or expected strings may still be sensitive: inspect plans before committing them. Only plans are portable; original evidence stays in its workspace.',
        '导入拒绝未知字段、不支持的版本、超过 512 KiB 的文件、外部或带敏感参数的页面、原始 fill 值、重复输入键及无效流程范围。输入必须是最多 10,000 字符的字符串。描述、选择器或预期文本仍可能敏感，提交前检查计划。迁移的是计划，原始证据留在原工作区。',
      ) +
      h('mcp', 'MCP equivalents', '对应 MCP 工具') +
      table([
        [
          'shiplens_list_cases / shiplens_list_runs',
          'Same object arguments as listCases/listRuns.',
          '参数对象与 listCases/listRuns 一致。',
        ],
        [
          'shiplens_get_case',
          '{ caseId } → CaseInfo + requirements + flows.',
          '{ caseId } → CaseInfo、requirements、flows。',
        ],
        [
          'shiplens_update_case',
          '{ caseId, name?, tags? } → CaseInfo.',
          '{ caseId, name?, tags? } → CaseInfo。',
        ],
        [
          'shiplens_export_case / shiplens_import_case',
          '{ caseId } → PortableCase / { data: PortableCase } → CaseInfo.',
          '{ caseId } → PortableCase / { data: PortableCase } → CaseInfo。',
        ],
      ]),
  );
}
export function acceptanceOpsDocs() {
  return page(
    'acceptance-ops',
    'Reports, CI & runtime',
    '报告、CI 与运行控制',
    'Hand off a review, gate recorded results and recover interrupted work.',
    '交付验收报告、检查记录结果，并处理运行中断。',
    h('report', 'Export an acceptance snapshot', '导出验收快照') +
      p(
        '<a href="./review-example/index.html" target="_blank" rel="noopener">Open the synthetic before/after report →</a>',
        '<a href="./review-example/index.html" target="_blank" rel="noopener">打开模拟页面的修复前后报告 →</a>',
      ) +
      code(`const report = await workspace.exportReport({
  runId: next.runId, previousRunId: run.runId,
  format: 'html', includeImages: true, lang: 'en',
});
console.log(report.file, report.gate, report.warnings);`) +
      p(
        'exportReport({ runId, previousRunId?, format?, includeImages?, lang?, failOn? }) returns { runId, format, file, bytes, gate, warnings }. file is relative to ReviewWorkspace.directory. Formats: html (default), json, markdown. failOn uses the same error/warning threshold as gate (default error). HTML supports en (default) / zh, follows the viewer’s system theme, and embeds images up to a combined 12 MiB budget. includeImages defaults true; omitted/unavailable images are labeled and reported in warnings. JSON and Markdown contain no embedded images; Markdown labels are English. previousRunId adds an explicit comparison, including before/after images in HTML.',
        'exportReport({ runId, previousRunId?, format?, includeImages?, lang?, failOn? }) 返回 { runId, format, file, bytes, gate, warnings }，file 相对于 ReviewWorkspace.directory。格式为 html（默认）、json、markdown。failOn 使用与 gate 一致的 error/warning 阈值（默认 error）。HTML 支持 en（默认）或 zh，跟随系统主题，内嵌图片总预算为 12 MiB；includeImages 默认为 true，省略或不可用图片会标注并写入 warnings。JSON 与 Markdown 不内嵌图片，Markdown 标签使用英文。previousRunId 加入明确的对比，HTML 显示前后图片。',
      ) +
      p(
        'Exports use unique filenames under runs/&lt;runId&gt;/ and do not overwrite older snapshots. They include requirement status, caller notes, evidence IDs, machine summary and assessment history. Re-export after adding judgments. HTML blocks scripts and external requests with CSP. These are local files; ShipLens does not upload them.',
        '每次导出在 runs/&lt;runId&gt;/ 使用唯一文件名，不覆盖旧快照。内容包括验收项状态、调用方备注、证据 ID、机器摘要与判断历史；新增判断后应重新导出。HTML 通过 CSP 阻止脚本与外部请求。文件保存在本地，ShipLens 不会上传。',
      ) +
      h('gate', 'gate({ runId, failOn? })', 'gate({ runId, failOn? })') +
      code(`const gate = await workspace.gate({ runId: next.runId, failOn: 'warning' });
console.log(gate.counts, gate.reasons);
process.exitCode = gate.passed ? 0 : 1;`) +
      p(
        'Returns { runId, passed, counts, failOn, reasons, note }. counts contains pass/fail/pending/needs-evidence. failOn is error (default) or warning for machine findings. Any failed or unreviewed requirement, missing cited artifact, incomplete machine check or truncated page/scroll coverage blocks the gate. A recorded AI pass does not clear machine errors. The gate verifies recorded state and artifact availability, not whether a model reasoned correctly.',
        '返回 { runId, passed, counts, failOn, reasons, note }，counts 包含 pass/fail/pending/needs-evidence。failOn 为机器问题阈值 error（默认）或 warning。失败或未判断需求、引用产物缺失、机器检查未完成、页面或滚动覆盖截断均会阻止通过。AI 记录通过不会清除机器错误。gate 校验记录状态与产物可用性，不验证模型推理是否正确。',
      ) +
      h('cli', 'CLI and CI without an MCP client', '无需 MCP 客户端的 CLI 与 CI') +
      code(`shiplens doctor --config shiplens.config.json
shiplens review collect --config shiplens.config.json --input requirements.json
shiplens review runs --config shiplens.config.json
shiplens review report --config shiplens.config.json --run RUN_ID --format html
shiplens review gate --config shiplens.config.json --run RUN_ID --fail-on warning`) +
      code(
        JSON.stringify(
          {
            requirements: [
              { id: 'title', description: 'Main heading is visible', page: '/', selector: 'h1' },
            ],
          },
          null,
          2,
        ),
        'requirements.json',
      ) +
      table([
        [
          'collect / run / runs / evidence / assess / save',
          'Map to collect/getRun/listRuns/readEvidence/assess/saveCase. Use --input for the documented method argument object, --run for runId.',
          '对应 collect/getRun/listRuns/readEvidence/assess/saveCase。--input 指向方法参数对象 JSON，--run 提供 runId。',
        ],
        [
          'cases / case / update / export / import / recheck',
          'Map to case-library methods. --case supplies caseId. Import reads the PortableCase directly from --input; export prints it to stdout.',
          '对应案例库方法。--case 提供 caseId。import 从 --input 直接读取 PortableCase；export 将其打印到 stdout。',
        ],
        [
          'compare / report / gate',
          'Use --run and --previous for comparisons, --format for report, --fail-on for gate. Extra method fields go in --input.',
          '--run 与 --previous 指定对比，--format 指定报告格式，--fail-on 指定验收阈值；其他方法参数通过 --input 提供。',
        ],
        [
          'Output and exits',
          'All review commands emit JSON. gate exits 0 on pass, 1 when blocked. Invalid input/execution failure exits 2. A recheck command succeeding only means evidence collection completed.',
          '所有 review 命令输出 JSON。gate 通过退出 0，阻塞退出 1；参数或执行错误退出 2。recheck 命令成功只代表完成采集。',
        ],
      ]) +
      code(`shiplens review export --config shiplens.config.json --case CASE_ID > checkout.case.json
shiplens review import --config shiplens.config.json --input checkout.case.json
shiplens review recheck --config shiplens.config.json --case IMPORTED_CASE_ID --timeout-ms 180000`) +
      note(
        'A fresh CI recheck has pending AI judgments. Your existing agent must read and assess that exact run before the acceptance gate can pass. Without an agent, use the ordinary shiplens scan command for deterministic checks and retain the pending review for later. Do not copy old pass receipts into the new run.',
        'CI 复查后 AI 判断为 pending。现有 Agent 必须读取并判断同一轮证据，验收 gate 才能通过。没有 Agent 时，可用普通 shiplens scan 执行确定性检查，并保留待判定验收结果。不要把旧轮次的通过记录复制到新轮次。',
      ) +
      h('runtime', 'Progress, cancellation and deadlines', '进度、取消与总时限') +
      code(`const controller = new AbortController();
const promise = workspace.collect({ requirements }, {
  signal: controller.signal, timeoutMs: 180000,
  onProgress: event => console.error(event),
});
console.log(workspace.getStatus());
// Call controller.abort() or workspace.cancel() to interrupt this instance.
const run = await promise;`) +
      p(
        'collect and recheck accept a second ReviewRuntime argument: signal, onProgress and timeoutMs (default 120,000; range 1,000–1,800,000). getStatus() returns { running, startedAt?, progress }; progress is { url, viewport, page, flow? }. cancel() returns { requested } and closes this instance’s active review browser. Successful cancellation rejects the operation, releases its writer lock and creates no completed run; partial scan artifacts may remain. Completed runs are preserved. Root scan(options, { signal }) also supports cancellation.',
        'collect 与 recheck 接受第二个 ReviewRuntime 参数：signal、onProgress、timeoutMs（默认 120,000，范围 1,000–1,800,000 毫秒）。getStatus() 返回 { running, startedAt?, progress }，progress 为 { url, viewport, page, flow? }。cancel() 返回 { requested } 并关闭当前实例的验收浏览器。成功取消后调用拒绝、释放写锁，不生成已完成轮次；可能保留部分采集文件，已完成轮次不受影响。根 API scan(options, { signal }) 也支持取消。',
      ) +
      p(
        'MCP provides shiplens_status and shiplens_cancel with {} arguments. Its scans have a 120-second total budget and honor client cancellation notifications. CLI handles SIGINT/SIGTERM and accepts --timeout-ms. Abrupt process termination may leave .lock; remove it only after confirming the writer has stopped. doctor checks Node, browser installation, config and lock presence, and storage-state structure if provided; it does not launch a browser or validate login/reachability.',
        'MCP 的 shiplens_status、shiplens_cancel 使用 {} 参数，采集总时限为 120 秒并响应客户端取消通知。CLI 处理 SIGINT/SIGTERM，可设置 --timeout-ms。进程被强制终止可能留下 .lock，确认写入进程已停止后才能删除。doctor 检查 Node、浏览器安装、配置、锁存在情况及提供的登录态结构，不启动浏览器，也不验证登录是否有效或网站是否可访问。',
      ) +
      p(
        'MCP shiplens_export_report and shiplens_gate use the same argument objects as the API methods. Tool failures return isError: true; a blocked gate is a successful tool response with passed: false. All 18 tools are documented across the MCP, scoped evidence, case library and this page.',
        'MCP shiplens_export_report 与 shiplens_gate 使用与 API 相同的参数对象。工具执行错误返回 isError: true；gate 阻塞属于正常返回，passed: false。全部 18 个工具分布在 MCP、局部证据、用例库及本页文档中。',
      ) +
      h('example', 'Run the packaged end-to-end example', '运行包内端到端案例') +
      code(
        'npm install --save-dev --save-exact shiplens\nnpx shiplens browsers\n# Terminal 1\nnode node_modules/shiplens/examples/server.mjs\n# Terminal 2\nnode node_modules/shiplens/examples/workflow.mjs',
      ) +
      p(
        'The example writes a portable case, comparison report and result.json under .shiplens/workflow. It uses a fixture-only text check to demonstrate assessments. The replay deliberately stays pending and its gate is blocked, showing the actual review boundary.',
        '案例在 .shiplens/workflow 下输出可迁移用例、对比报告和 result.json。它使用仅适用于演示页面的文本检查来演示判断接口；复查故意保留 pending，gate 因而阻塞，展示真实的验收边界。',
      ) +
      code(workflowExample, 'examples/workflow.mjs'),
  );
}
