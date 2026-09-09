import { t } from './i18n.js';
import { code, p, h, note, table } from './markup.js';
import reviewExample from '../../../packages/cli/examples/review.mjs?raw';

export function aiWorkflowDocs() {
  return {
    id: 'ai-workflow',
    source: 'review-docs.js',
    group: t('AI review', 'AI 验收'),
    title: t('Review with your AI assistant', '与你的 AI 助手一起验收'),
    description: t(
      'Let the model judge. Keep the evidence, scope and regression cases repeatable.',
      '让模型负责判断，让证据、检查范围与回归案例可以重复使用。',
    ),
    body:
      h('roles', 'Reasoning meets repeatable evidence', '判断与可重复证据结合') +
      p(
        'An assistant with browser tools can already inspect a website. ShipLens packages the recurring work around that inspection: scoped browser captures, deterministic diagnostics, criterion-to-evidence links, assessment history and replayable cases. It does not claim to see better than your model.',
        '带浏览器工具的助手已经能够检查网页。ShipLens 将围绕检查反复发生的工作封装起来：按范围采集浏览器证据、确定性诊断、验收项与证据关联、判断历史以及可重放案例。不宣称比你的模型更会看网页。',
      ) +
      table([
        [
          'Your assistant',
          'Understand requirements, explore using its browser tools, inspect images and judge business or visual correctness.',
          '理解需求、使用自己的浏览器工具探索、查看截图并判断业务或视觉是否正确。',
        ],
        [
          'ShipLens',
          'Execute supplied steps, capture evidence, enforce citation scope and record fresh assessments for each run.',
          '执行提供的步骤、采集证据、校验证据引用范围，并逐轮记录新的验收判断。',
        ],
        [
          'Your project',
          'Pin URL, devices, test sessions, request permissions, masks and scan budgets in host configuration.',
          '在宿主配置中固定网址、设备、测试登录态、请求权限、遮罩和扫描预算。',
        ],
      ]) +
      h('start', 'Use the model you already have', '使用你已经在用的模型') +
      p(
        'No additional model API key is required by ShipLens. Connect its <a href="#/docs/mcp">stdio MCP server</a> to an image-capable assistant, or use the <a href="#/docs/review-api">JavaScript review API</a> in your own agent. Your AI client receives the evidence it requests; ShipLens itself does not upload reports.',
        'ShipLens 不要求额外的模型 API Key。将 <a href="#/docs/mcp">stdio MCP 服务</a>接入支持图片的助手，或在自己的 Agent 中调用 <a href="#/docs/review-api">JavaScript 验收 API</a>。你的 AI 客户端会接收它请求的证据；ShipLens 自身不上传报告。',
      ) +
      code(
        t(
          'Review the itinerary page on desktop and mobile. After opening Details, the three-day itinerary must be visible. Use ShipLens evidence for each device, record your judgment with citations, save the assessed steps as a case, and recheck after the fix. Leave anything unobserved as needs-evidence.',
          '验收行程页面的桌面端和手机端。打开详情后应显示三天行程。使用 ShipLens 读取每个设备的证据，引用证据记录判断，将已验收步骤保存为案例，修复后重新检查。未观察到的内容记为 needs-evidence。',
        ),
        t('Example request to your assistant', '发给助手的示例需求'),
      ) +
      h('loop', 'One acceptance loop', '一轮验收闭环') +
      table([
        [
          '1 · collect',
          'Declare exact requirements and optional steps. Every requirement starts pending.',
          '声明精确验收项及可选步骤，每个验收项从 pending 开始。',
        ],
        [
          '2 · readEvidence',
          'Read the matching PNG and bounded DOM for each requested device and state.',
          '读取每个指定设备及页面状态对应的 PNG 和有限页面结构。',
        ],
        [
          '3 · assess',
          'Submit pass, fail or needs-evidence with a reason and run-scoped evidence IDs.',
          '提交 pass、fail 或 needs-evidence，附理由与本轮证据 ID。',
        ],
        [
          '4 · saveCase',
          'Save once every criterion is pass/fail. Confirmed failures are also useful regression cases.',
          '全部验收项为 pass/fail 后保存案例；已确认的失败也可作为回归案例。',
        ],
        [
          '5 · recheck',
          'Replay the steps. New judgments start pending; old evidence stays available via previousRunId.',
          '重放步骤，新判断重新进入 pending；通过 previousRunId 查看旧证据。',
        ],
      ]) +
      note(
        'A pass validates evidence provenance and device coverage, not the truth of the assistant’s reasoning. Machine errors remain visible independently. A new targeted collection creates a separate run; there is no automatic merge of old passes.',
        '通过状态只校验证据来源与设备覆盖，不验证助手推理本身是否正确。机器发现的错误独立保留。补充定向采集会新建一轮，不会自动合并旧的通过结论。',
      ) +
      h(
        'limits',
        'What this release deliberately leaves to the assistant',
        '本版仍由助手负责的工作',
      ) +
      p(
        'Exploration, selector discovery and visual reasoning stay with your assistant. Cases save explicit supplied steps; they do not record an external browser session or repair selectors automatically. DOM observations omit frames and shadow DOM, input values and masked subtrees. Text or element truncation prevents a pass; use narrower checks or needs-evidence. These are scoped acceptance checks, not whole-site certification.',
        '探索、发现选择器和视觉推理仍由助手负责。案例保存显式提供的步骤，不录制外部浏览器会话，也不自动修复选择器。页面结构不遍历 iframe 或 Shadow DOM，不收集输入值与遮罩子树。文本或元素截断不能支持通过结论，应缩小范围或记为 needs-evidence。这是有范围的验收检查，不是全站认证。',
      ) +
      p(
        'For explicit text requirements, see <a href="#/docs/checked-review">checks and batched review packets</a>. Text checks can run automatically; manual criteria still require fresh judgments.',
        '明确的文本要求可使用<a href="#/docs/checked-review">断言与批量证据</a>。文本断言可自动执行，manual 项仍须重新判断。',
      ) +
      h('comparison', 'Evaluate the benefit on your own project', '在自己的项目上验证收益') +
      p(
        'Our <a href="#/docs/benchmark">published workflow benchmark</a> compares a reusable Playwright script with ShipLens on three synthetic fixtures. It includes timings, raw data and evidence-integrity failures. Both use deterministic text checks; no model accuracy or cost claim is established.',
        '查看已公开的<a href="#/docs/benchmark">工作流对照实测</a>：用三个合成场景比较可复用 Playwright 脚本与 ShipLens，包含耗时、原始数据及证据完整性探测。两组都使用确定性文本断言，没有建立模型准确率或成本优势结论。',
      ) +
      p(
        'Use the same model, website version, requirements, browser permissions and time budget in two runs: generic browser tools alone, then those tools plus ShipLens. Plant known defects and retain the expected answers. Compare missed defects, unsupported conclusions, time to repeat after a fix, total tool/model cost and usable regression cases. We have tested the engineering workflow, but have not measured an accuracy, speed or token advantage over direct model testing.',
        '使用相同模型、网站版本、验收项、浏览器权限和时间预算做两组检查：只用通用浏览器工具，以及增加 ShipLens。预置已知缺陷并保留标准答案，比较漏检、无证据结论、修复后复查耗时、工具与模型总成本和可用回归案例。我们验证了工程流程，但尚未测出相对直接使用模型的准确率、速度或 Token 优势。',
      ),
  };
}

export function mcpDocs() {
  return {
    id: 'mcp',
    source: 'review-docs.js',
    group: t('AI review', 'AI 验收'),
    title: t('MCP setup & tools', 'MCP 配置与工具'),
    description: t(
      'Seventeen project-scoped tools for your existing image-capable AI client.',
      '十七个限定项目范围的工具，供现有支持图片的 AI 客户端调用。',
    ),
    body:
      h('install', 'Install in the target project', '安装到目标项目') +
      code(
        'npm install --save-dev --save-exact shiplens\nnpx shiplens browsers\nnpx shiplens init',
      ) +
      code(
        JSON.stringify(
          {
            url: 'http://127.0.0.1:3000',
            crawl: false,
            viewport: 'both',
            maxPages: 5,
            settle: 300,
            mask: ['.user-email'],
            output: '.shiplens',
          },
          null,
          2,
        ),
        'shiplens.config.json',
      ) +
      p(
        'Start the website first. This configuration pins the target origin, request policy and budgets. Add test storageState or allowRequests only when your intended flow needs them. The tools cannot change those policies. Additional tool-supplied flows must have names distinct from configured flows.',
        '先启动网站。配置会固定目标来源、请求策略和预算。按实际流程需要添加测试 storageState 或 allowRequests，工具不能修改这些策略。工具额外传入的流程名称不能与配置中的流程重复。',
      ) +
      h('client', 'Connect over stdio', '通过 stdio 连接') +
      code(
        JSON.stringify(
          {
            mcpServers: {
              shiplens: {
                command: 'node',
                args: [
                  '/absolute/project/node_modules/shiplens/src/cli.js',
                  'mcp',
                  '--config',
                  '/absolute/project/shiplens.config.json',
                ],
              },
            },
          },
          null,
          2,
        ),
        t(
          'For clients using the mcpServers JSON format',
          '适用于采用 mcpServers JSON 格式的客户端',
        ),
      ) +
      p(
        'Replace both absolute paths. Use the absolute Node executable if your client does not inherit PATH. Other clients use different configuration formats; the process command and arguments are the same. Restart or reconnect the client, then confirm all 18 tools are listed. The server uses stdout only for MCP protocol messages and supports legacy and modern MCP clients.',
        '替换两个绝对路径。客户端未继承 PATH 时，使用 Node 可执行文件的绝对路径。其他客户端可能采用不同配置格式，但启动命令与参数相同。重启或重新连接后，确认十七个工具全部出现。服务的 stdout 只用于 MCP 协议消息，支持旧版及新版 MCP 客户端。',
      ) +
      h('tools', 'Six core review tools', '六个核心验收工具') +
      table([
        [
          'shiplens_collect',
          '{ requirements, flows? } → run with pending criteria and an evidence index.',
          '{ requirements, flows? } → 含待判定验收项与证据索引的新一轮结果。',
        ],
        [
          'shiplens_get_run',
          '{ runId } → current statuses, history, evidence index and machine summary.',
          '{ runId } → 当前状态、判断历史、证据索引及机器摘要。',
        ],
        [
          'shiplens_read_evidence',
          '{ runId, evidenceId, includeImage? } → native PNG image content (default true), bounded DOM and scoped findings (a final-state capture includes findings from earlier steps of that flow).',
          '{ runId, evidenceId, includeImage? } → 原生 PNG 图片内容（默认 true）、有限页面结构与对应机器发现（最终状态包含该流程之前步骤的发现）。',
        ],
        [
          'shiplens_assess',
          '{ runId, criterionId, status, evidenceIds, note } → refreshed run. Status is pass, fail or needs-evidence.',
          '{ runId, criterionId, status, evidenceIds, note } → 更新后的本轮结果。状态为 pass、fail 或 needs-evidence。',
        ],
        [
          'shiplens_save_case',
          '{ runId, name } → caseId, sourceRunId and requiredInputs.',
          '{ runId, name } → caseId、sourceRunId 及 requiredInputs。',
        ],
        [
          'shiplens_recheck',
          '{ caseId, inputs? } → fresh pending run with previousRunId and a machine baseline comparison.',
          '{ caseId, inputs? } → 新的待判定结果，含 previousRunId 与机器基线对比。',
        ],
      ]) +
      p(
        'The server also exposes the review_website prompt. The package contains AGENT_GUIDE.md. Full parameter limits, return fields and a runnable example appear in the <a href="#/docs/review-api">review API reference</a>. MCP failures return isError: true; they are never reported as a passing check.',
        '服务还提供 review_website 提示词，包内附带 AGENT_GUIDE.md。完整参数限制、返回字段及可运行示例见 <a href="#/docs/review-api">验收 API 参考</a>。MCP 调用失败返回 isError: true，不会被记为检查通过。',
      ) +
      p(
        'Additional tools cover <a href="#/docs/scoped-review">comparisons</a>, <a href="#/docs/case-library">case/run discovery and portable plans</a>, and <a href="#/docs/acceptance-ops">reports, gates, status and cancellation</a>.',
        '新增工具覆盖<a href="#/docs/scoped-review">修复对比</a>、<a href="#/docs/case-library">案例与轮次查询及迁移</a>、<a href="#/docs/acceptance-ops">报告、验收检查、状态与取消</a>。',
      ) +
      h('storage', 'Artifacts and recovery', '产物与恢复') +
      p(
        'Review state is stored in &lt;output&gt;/reviews: runs/&lt;runId&gt;/run.json, append-only assessments, cases/&lt;caseId&gt;.json and scans/ with original browser reports. Relative configuration paths resolve beside the config. Default output is .shiplens beside that file. Restarting preserves runs and cases; use stored IDs to resume. The review workflow uses its source run as the recheck baseline; config baseline and failOn do not determine AI judgments.',
        '验收状态保存在 &lt;output&gt;/reviews：runs/&lt;runId&gt;/run.json、只追加的 assessments、cases/&lt;caseId&gt;.json 及保存浏览器报告的 scans/。配置内相对路径以配置所在目录为基准，默认 output 为该目录下的 .shiplens。重启后仍保留结果与案例，可用已有 ID 恢复。复查以案例来源轮次为基线；配置的 baseline 与 failOn 不决定 AI 判断。',
      ) +
      note(
        'One writer per workspace. Busy operations return an error; retry after completion. Following a crash, remove .lock only after that writer has stopped. A scan may exceed your client’s default timeout; configure a suitable timeout and small page/step budgets. Use shiplens_cancel or client cancellation; MCP scans also have a 120-second total deadline. Use test data and masks: inputs echoed elsewhere, logs, notes and your client’s tool history may contain sensitive content.',
        '每个工作区同一时刻仅允许一个写入操作，忙碌时返回错误，完成后再重试。进程崩溃后，确认写入进程已停止才能删除 .lock。扫描可能超过客户端默认超时，请设置合理超时与较小页面、步骤预算；可调用 shiplens_cancel 或由客户端发送取消，MCP 扫描另有 120 秒总时限。使用测试数据与遮罩：其他位置回显的输入、日志、备注和客户端工具历史可能包含敏感内容。',
      ),
  };
}

export function reviewApiDocs() {
  return {
    id: 'review-api',
    source: 'review-docs.js',
    group: t('AI review', 'AI 验收'),
    title: t('Review API & example', '验收 API 与案例'),
    description: t(
      'Complete method reference for the optional shiplens/review entry point.',
      '可选 shiplens/review 入口的完整方法参考。',
    ),
    body:
      h(
        'constructor',
        'new ReviewWorkspace({ directory, options })',
        'new ReviewWorkspace({ directory, options })',
      ) +
      code(
        "import { ReviewWorkspace } from 'shiplens/review';\nimport type { Requirement, ReviewRun, EvidenceResult, SavedCase } from 'shiplens/review';\n\nconst workspace = new ReviewWorkspace({\n  directory: '.shiplens/reviews',\n  options: { url: 'http://127.0.0.1:3000', crawl: false, viewport: 'both' },\n});",
        'TypeScript / ESM',
      ) +
      p(
        'directory is required and resolves from the process working directory. options uses <a href="#/docs/api?section=options">ScanOptions</a>; the constructor validates and copies it. Review collection forces captureDom: true, writes scans inside directory/scans and uses per-call runtime.onProgress for progress. Browser installation is still required. Root imports remain scan, validateOptions and compareBaseline; the review API is a separate entry point.',
        'directory 必填，相对路径基于进程工作目录。options 使用 <a href="#/docs/api?section=options">ScanOptions</a>，构造器校验并复制参数。验收采集强制 captureDom: true，将扫描写入 directory/scans，通过每次调用的 runtime.onProgress 提供进度。仍需安装浏览器。根入口保留 scan、validateOptions、compareBaseline，验收 API 使用独立入口。',
      ) +
      h('collect', 'collect({ requirements, flows? })', 'collect({ requirements, flows? })') +
      code(
        "const run = await workspace.collect({\n  requirements: [{ id: 'details', description: 'Details reveal the itinerary.',\n    page: '/', flow: 'open', step: 1, viewports: ['desktop', 'mobile'] }],\n  flows: [{ name: 'open', page: '/', steps: [{ action: 'click', selector: '#details' }] }],\n});",
        'JavaScript',
      ) +
      table([
        [
          'requirements',
          '1–50 items. id is unique (1–80 characters); description is 1–2000 characters; page is a same-origin URL/path, not excluded.',
          '1–50 项。id 唯一（1–80 字符）；description 为 1–2000 字符；page 为同源且未被排除的 URL/路径。',
        ],
        [
          'flow / step',
          'Optional existing flow name on that page; optional 1-based step in that flow. Without flow, cite the ordinary page check; without step, cite the final flow state.',
          '可选该页面已有流程名；step 为该流程内从 1 开始的步骤序号。不含 flow 时对应普通页面检查；不含 step 时对应流程最终状态。',
        ],
        [
          'viewports',
          'Optional nonempty subset of configured desktop/mobile devices; defaults to all configured devices. Exact state/device matching is required for citations.',
          '可选配置中 desktop/mobile 的非空子集，默认全部配置设备；引用必须精确匹配状态与设备。',
        ],
        [
          'flows',
          'Optional additional InteractionFlow[]. Unique names across configured and supplied flows, at most 20 total, 1–30 steps each. Requirements add their pages to the explicit page budget.',
          '可选额外 InteractionFlow[]。与配置流程合计名称唯一、最多 20 个，每个 1–30 步。验收项页面加入显式页面预算。',
        ],
      ]) +
      p(
        'Returns Promise&lt;ReviewRun&gt;. Every requirement is pending; no AI judgment is performed. Invalid scope, duplicate names, missing flow steps, secret query parameters or an insufficient maxPages budget reject before scanning.',
        '返回 Promise&lt;ReviewRun&gt;。所有验收项均为 pending，不执行 AI 判断。范围无效、名称重复、缺失流程步骤、带敏感查询参数或 maxPages 不足时，在扫描前拒绝。',
      ) +
      h('get-run', 'getRun(runId)', 'getRun(runId)') +
      code(
        'const current = await workspace.getRun(run.runId);\nconsole.log(current.requirements, current.history, current.machine);',
      ) +
      p(
        'Returns Promise&lt;ReviewRun&gt; with runId, createdAt, requirements (status and latest assessment), evidence, history, requiredInputs and machine { summary, truncated, comparison? }. Rechecks also include previousRunId and caseId. The index includes requirement-matched states; otherEvidenceCount counts captures outside those criteria. Evidence entries have evidenceId, page, viewport, optional flow/step, criterionIds, complete, screenshot/observation relative paths, screenshotMode, status and notes. An evidence entry being complete does not mean its requirement passes.',
        '返回 Promise&lt;ReviewRun&gt;，含 runId、createdAt、requirements（状态及最近判断）、evidence、history、requiredInputs、machine { summary, truncated, comparison? }。复查还含 previousRunId 与 caseId。索引仅返回匹配验收项的状态，otherEvidenceCount 记录其余截图数量。证据含 evidenceId、page、viewport、可选 flow/step、criterionIds、complete、screenshot/observation 相对路径、screenshotMode、status、notes。证据 complete 不等于验收通过。',
      ) +
      h(
        'read-evidence',
        'readEvidence({ runId, evidenceId, includeImage? })',
        'readEvidence({ runId, evidenceId, includeImage? })',
      ) +
      code(
        'const item = run.evidence.find(e => e.criterionIds.includes("details"));\nconst proof = await workspace.readEvidence({ runId: run.runId, evidenceId: item.evidenceId });\nconsole.log(proof.observation?.text, proof.findings);\n// Send proof.image to an image-capable model using your own client adapter.',
      ) +
      p(
        'Returns Promise&lt;EvidenceResult&gt;: evidence, observation or null, findings, suppressed, warning and optional image { type: "image", mimeType: "image/png", data: base64 }. includeImage defaults true; false avoids loading the PNG. Observation contains capturedAt, url, scope, text, elements (selector, tag, role, text, disabled, bounds), textTruncated and elementsTruncated. No arbitrary filesystem paths are accepted. Images are capped at 6 MiB; observation files at 256 KiB.',
        '返回 Promise&lt;EvidenceResult&gt;：evidence、observation 或 null、findings、suppressed、warning 及可选 image { type: "image", mimeType: "image/png", data: base64 }。includeImage 默认为 true，false 时不加载 PNG。Observation 包含 capturedAt、url、scope、text、elements（selector、tag、role、text、disabled、bounds）、textTruncated、elementsTruncated。不接受任意文件路径。图片上限 6 MiB，结构证据文件上限 256 KiB。',
      ) +
      h(
        'assess',
        'assess({ runId, criterionId, status, evidenceIds, note })',
        'assess({ runId, criterionId, status, evidenceIds, note })',
      ) +
      code(
        "await workspace.assess({ runId: run.runId, criterionId: 'details',\n  status: 'needs-evidence', evidenceIds: [],\n  note: 'Inspect both device images before judging visual readability.' });",
      ) +
      p(
        'Returns the refreshed ReviewRun. status is pass, fail or needs-evidence. note is required (1–4000 characters). evidenceIds contains up to 100 unique IDs from this exact run and criterion scope. Pass/fail needs at least one citation; needs-evidence may use []. Pass must cover every requested viewport with complete evidence, PNG and non-truncated DOM. Failed/skipped actions, incomplete checks, scroll limits or missing artifacts cannot support pass. Fail may cite incomplete evidence. Each call appends a receipt with assessmentId, recordedAt and source: caller-assessment; later judgments preserve the earlier history.',
        '返回更新后的 ReviewRun。status 为 pass、fail 或 needs-evidence；note 必填（1–4000 字符）。evidenceIds 最多 100 个唯一 ID，必须属于当前轮次与验收项范围。pass/fail 至少引用一项，needs-evidence 可为 []。通过必须使用完整证据、PNG 与未截断 DOM 覆盖所有指定视口。失败或跳过的操作、不完整检查、滚动限制、缺失产物均不能支持通过。失败判断可引用不完整证据。每次追加含 assessmentId、recordedAt、source: caller-assessment 的记录，后续修改判断仍保留历史。',
      ) +
      h('save-case', 'saveCase({ runId, name })', 'saveCase({ runId, name })') +
      code(
        "const saved = await workspace.saveCase({ runId: run.runId, name: 'Itinerary details' });\nconsole.log(saved.caseId, saved.requiredInputs);",
      ) +
      p(
        'Returns Promise&lt;SavedCase&gt;: caseId, name, sourceRunId and requiredInputs [{ key, flow, selector }]. name is 1–120 characters. All criteria must already be pass/fail; confirmed failures are allowed. The workspace configuration must match. Every fill value is replaced in the saved plan with valueFromInput: input_N; raw fill values are not stored in the plan. Descriptions, selectors, other action arguments, notes and visible evidence are still persisted: use test data and masks.',
        '返回 Promise&lt;SavedCase&gt;：caseId、name、sourceRunId 与 requiredInputs [{ key, flow, selector }]。name 为 1–120 字符。全部验收项必须已为 pass/fail，允许保存已确认失败，工作区配置必须一致。保存计划时将每个 fill 值替换为 valueFromInput: input_N，不在计划中保存原始 fill 值。描述、选择器、其他操作参数、备注与可见证据仍会持久化，请使用测试数据和遮罩。',
      ) +
      h('recheck', 'recheck({ caseId, inputs? })', 'recheck({ caseId, inputs? })') +
      code(
        "const next = await workspace.recheck({ caseId: saved.caseId });\n// For a case with fill steps, supply each saved.requiredInputs key:\n// await workspace.recheck({ caseId: saved.caseId, inputs: { input_1: 'test query' } });\nconsole.log(next.requirements.map(item => item.status)); // pending\nconst previous = await workspace.getRun(next.previousRunId);",
      ) +
      p(
        'Returns Promise&lt;ReviewRun&gt; from a new scan. inputs is a string-to-string object; every required key must be supplied, unknown keys reject. No environment fallback. Changed host configuration rejects the case; changed inputs or imported auth state may make machine baselines non-comparable. Rechecks default to sourceRunId; optional previousRunId selects a later run from the same case. Imported cases have no source baseline. New assessment history is empty. All methods reject with Error for invalid IDs, missing artifacts or invalid state; mutations also reject while a workspace writer is active.',
        '新扫描返回 Promise&lt;ReviewRun&gt;。inputs 为字符串键值对象，每个必需键都要提供，未知键会拒绝，不从环境变量兜底。宿主配置改变会拒绝案例；输入或导入登录态改变可能使机器基线不可比。复查默认对比 sourceRunId，可用 previousRunId 选择同一案例后续轮次；导入案例无来源基线。新判断历史为空。ID 无效、产物缺失或状态错误时，各方法均以 Error 拒绝；工作区有其他写入操作时，修改方法也会拒绝。',
      ) +
      p(
        'See <a href="#/docs/scoped-review">scoped capture and comparison</a>, <a href="#/docs/case-library">all case-library methods</a>, and <a href="#/docs/acceptance-ops">exportReport, gate and runtime controls</a> for the 0.4 additions and complete examples.',
        '0.4 新增 API 与完整案例见<a href="#/docs/scoped-review">局部取证与对比</a>、<a href="#/docs/case-library">用例库方法</a>及<a href="#/docs/acceptance-ops">exportReport、gate 与运行控制</a>。',
      ) +
      h('example', 'Run the complete packaged example', '运行完整的包内案例') +
      code(
        'npm install --save-dev shiplens\nnpx shiplens browsers\n# Terminal 1\nnode node_modules/shiplens/examples/server.mjs\n# Terminal 2\nnode node_modules/shiplens/examples/review.mjs',
      ) +
      p(
        'This example exercises the six core methods against the packaged demo and writes .shiplens/demo-review/demo-result.json. Its explicit string check demonstrates the API; it is not a model judgment or proof of visual quality. Replace that block with your assistant’s image-and-requirement assessment. The second run intentionally remains pending.',
        '案例针对包内演示站执行六个核心方法，并写入 .shiplens/demo-review/demo-result.json。显式字符串检查仅演示 API，不是模型判断，也不能证明视觉质量。实际使用时应替换为助手结合截图和需求的判断。第二轮故意保留为 pending。',
      ) +
      code(reviewExample, 'node_modules/shiplens/examples/review.mjs'),
  };
}
