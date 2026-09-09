import { t } from './i18n.js';
import { code, p, h, note, table } from './markup.js';
import example from '../../../packages/cli/examples/acceptance.json';

export function planDocs() {
  return {
    id: 'portable-plans',
    source: 'plan-docs.js',
    group: t('AI review', 'AI 验收'),
    title: t('One-command verification', '一条命令完成复测'),
    description: t(
      'Keep an acceptance plan in Git. Run it on a fresh machine and receive a gate and report without managing case IDs. Available in 0.6.0.',
      '将验收文件保存在 Git，在新机器上直接执行并得到验收结果与报告，无需管理案例 ID。0.6.0 起提供。',
    ),
    body:
      h('start', 'Try the packaged plan', '运行包内验收文件') +
      p(
        'Install the package and browser, then start the included local example in one terminal.',
        '安装包和浏览器，在一个终端启动包内的本地示例。',
      ) +
      code(
        'npm install --save-dev --save-exact shiplens@0.6.0\nnpx shiplens browsers\nnode node_modules/shiplens/examples/server.mjs',
      ) +
      p(
        'Create shiplens.config.json in your project. URL and request policy belong to the host configuration, separate from the portable plan.',
        '在项目中创建 shiplens.config.json。URL 与请求策略由主机配置控制，与可迁移的验收文件分开。',
      ) +
      code(
        JSON.stringify(
          { url: 'http://127.0.0.1:3000', viewport: 'both', crawl: false, output: '.shiplens' },
          null,
          2,
        ),
        'shiplens.config.json',
      ) +
      p(
        'In a second terminal, validate without launching a browser, then execute. Each verify invocation collects fresh evidence and writes a report. The supplied plan checks only the itinerary text after clicking Details.',
        '在另一个终端先校验文件，再执行。plan 不启动浏览器；每次 verify 重新采证并生成报告。这个示例只检查点击详情后的行程文本。',
      ) +
      code(
        'npx shiplens review plan --config shiplens.config.json --plan node_modules/shiplens/examples/acceptance.json\nnpx shiplens review verify --config shiplens.config.json --plan node_modules/shiplens/examples/acceptance.json',
      ) +
      h('file', 'Commit your own acceptance.json', '保存自己的 acceptance.json') +
      p(
        'Copy this file into your repository and replace its requirements and selectors with reviewed expectations for your app. Existing exportCase output works directly. There is no new plan format and no prior run or imported case is required.',
        '将下列文件复制到仓库，把要求和选择器替换为已经确认的应用预期。已有 exportCase 的输出可直接使用，无需新增格式、历史运行或先导入案例。',
      ) +
      code(JSON.stringify(example, null, 2), 'acceptance.json') +
      note(
        'Only use evaluation: checks when text fully expresses the requirement. Leave visual and subjective criteria manual. A file that validates is not proof that its selectors exist, its login works or its expectations are correct.',
        '仅在文本足以表达要求时使用 evaluation: checks。视觉和主观要求保留 manual。文件校验通过，不代表选择器存在、登录有效或预期正确。',
      ) +
      h('inputs', 'Provide inputs at runtime', '运行时提供输入') +
      p(
        'Portable fill steps use a unique valueFromInput name instead of a raw value. Pass a JSON object containing exactly those names through --input; the values must be strings up to 10,000 characters. Do not commit credentials or personal data. Evidence may contain values echoed by the app, so keep using test data and masks.',
        '可迁移的 fill 步骤使用唯一的 valueFromInput 名称，不保存原始 value。通过 --input 提供恰好包含这些名称的 JSON 对象，值为不超过 10,000 字符的字符串。不要提交凭据或个人信息；应用回显的值仍可能出现在证据中，因此继续使用测试数据和遮罩。',
      ) +
      p(
        'To try this with the example above, append the following fill step after the existing click step in acceptance.json → flows[0].steps. Keep requirements[0].step set to 1, so acceptance still checks the opened itinerary. Then create inputs.json and run the command below. Do not pass query to the original click-only plan: it has no named inputs and will reject that extra value.',
        '要在上面的示例中尝试输入，请将下列 fill 步骤追加到 acceptance.json 的 flows[0].steps 中，放在现有 click 步骤之后。保持 requirements[0].step 为 1，仍检查展开后的行程。然后创建 inputs.json，再执行下方命令。不要向原来的纯点击计划传 query，它没有命名输入，会拒绝这个额外值。',
      ) +
      code('{ "action": "fill", "selector": "#query", "valueFromInput": "query" }', 'Plan step') +
      code('{ "query": "Sample destination" }', 'inputs.json') +
      code(
        'npx shiplens review verify --config shiplens.config.json --plan acceptance.json --input inputs.json --format html --lang en --fail-on warning --timeout-ms 180000',
      ) +
      h('result', 'Use the result and exit code', '读取结果与退出码') +
      table([
        ['0', 'Gate passed for this run and configured scope.', '本轮在配置范围内通过验收。'],
        [
          '1',
          'Run completed but gate blocked: failed/manual/incomplete requirements, machine findings at the selected threshold, or limited coverage. JSON and a report are still returned.',
          '执行完成但未通过：要求失败、待判断、证据不完整、达到阈值的机器问题或覆盖不足。仍输出 JSON 和报告。',
        ],
        [
          '2',
          'Command could not complete: invalid config/plan/input, busy workspace, cancellation or artifact failure. Inspect stderr; do not parse it as a completed verification.',
          '命令无法完成：配置、验收文件或输入无效，工作区忙碌、取消或产物错误。查看 stderr，不要当成已完成的验收。',
        ],
      ]) +
      p(
        'stdout contains JSON with runId, plan, gate, report, unresolved and next. report.file is relative to &lt;output&gt;/reviews. The default report is HTML; json and markdown are also supported. Open the returned file, not a guessed latest-report path. Reports are immutable snapshots; export a new report after further assessments.',
        'stdout 输出 JSON，包含 runId、plan、gate、report、unresolved 与 next。report.file 相对于 &lt;output&gt;/reviews，默认 HTML，也支持 json、markdown。打开返回的文件，不要猜测最新报告路径。报告是不可变快照，后续判断后需重新导出。',
      ) +
      p(
        'unresolved lists requirement IDs, statuses and optional verification results. next is a reviewPacket request when requirements remain unresolved. A null next or empty unresolved list does not imply a passing gate: machine findings can still block it. Inspect gate.reasons and the report.',
        'unresolved 列出未通过要求的 ID、状态和可选断言结果；需要继续审查时，next 提供 reviewPacket 的请求。next 为 null 或 unresolved 为空，不代表 gate 通过，机器问题仍可阻断。查看 gate.reasons 与报告。',
      ) +
      h(
        'api',
        'validatePlan({ data }) and verify({ data, ... })',
        'validatePlan({ data }) 与 verify({ data, ... })',
      ) +
      code(
        "import { readFile } from 'node:fs/promises';\nimport { ReviewWorkspace } from 'shiplens/review';\n\nconst data = JSON.parse(await readFile('acceptance.json', 'utf8'));\nconst workspace = new ReviewWorkspace({\n  directory: '.shiplens/reviews',\n  options: { url: 'http://127.0.0.1:3000', viewport: 'both', crawl: false },\n});\nconst plan = workspace.validatePlan({ data }); // synchronous, no artifact writes\nconst result = await workspace.verify({ data, format: 'html' });\nif (result.next) {\n  const packet = await workspace.reviewPacket(result.next.input);\n  // Review all pages of fresh evidence, then assess manual criteria.\n}\nconsole.log(result.gate, result.report.file);",
        'JavaScript',
      ) +
      table([
        [
          'validatePlan',
          'Returns name, sha256, requirementCount, flowCount, requiredInputs, automaticRequirements, manualRequirements and note. Validates schema, relative paths, host exclusions, flow scope and page budget. Performs no filesystem writes or browser requests.',
          '返回 name、sha256、requirementCount、flowCount、requiredInputs、automaticRequirements、manualRequirements、note。检查格式、相对路径、主机排除规则、流程范围和页面预算。不写文件、不请求网页。',
        ],
        [
          'verify',
          'Returns Promise&lt;PlanVerification&gt;. data is required; inputs defaults to {}; failOn defaults to error (or warning); format defaults to html (or json/markdown); lang defaults to en (or zh). All statuses come from fresh evidence. No saved-case entry is created.',
          '返回 Promise&lt;PlanVerification&gt;。data 必填；inputs 默认为 {}；failOn 默认为 error，可选 warning；format 默认为 html，可选 json/markdown；lang 默认为 en，可选 zh。所有状态依据新证据产生，不新增已保存案例。',
        ],
        [
          'runtime',
          'Optional second argument: signal, onProgress, timeoutMs. Browser collection defaults to 120,000 ms; allowed 1,000–1,800,000 ms. Report generation follows collection. A failed export may leave a completed run; listRuns retrieves it for recovery.',
          '第二个参数可传 signal、onProgress、timeoutMs。浏览器采集默认 120,000 毫秒，可设 1,000–1,800,000 毫秒，之后生成报告。导出失败可能留下完整轮次，可用 listRuns 找回。',
        ],
        [
          'plan.sha256',
          'SHA-256 of the parsed portable JSON with recursively sorted object keys; array order is retained. Name/tags are included. Host config, runtime inputs and evidence are not included. Stored with run.planSource and included in reports; this is an identifier, not a signature.',
          '对解析后的验收 JSON 递归排序对象键后计算 SHA-256，保留数组顺序，包含名称与标签。不包含主机配置、运行输入和证据。存入 run.planSource 并显示在报告中；它是标识，不是签名。',
        ],
      ]) +
      p(
        'MCP exposes shiplens_validate_plan and shiplens_verify with the same inputs and results. Verification can execute the plan’s explicit actions under host policy: review imported actions before running. Plan flows replace configured flows, matching importCase behavior; host URL, masks, request allowlists and other limits remain in force. MCP collection retains its 120-second budget.',
        'MCP 提供相同参数与结果的 shiplens_validate_plan 和 shiplens_verify。verify 会在主机策略内执行文件中的显式操作，运行前需审查导入动作。文件中的 flows 替换配置 flows，与 importCase 一致；主机 URL、遮罩、请求白名单和其他限制仍然生效。MCP 采集仍采用 120 秒预算。',
      ) +
      h('ci', 'Add it to an existing CI job', '接入现有 CI 任务') +
      p(
        'Commit acceptance.json, a non-secret host config, package.json and the lockfile. After npm ci, browser installation, application startup and its readiness check, add this step. Each fresh checkout can run the same file; previous .shiplens data is unnecessary.',
        '提交 acceptance.json、无敏感信息的主机配置、package.json 和锁文件。在 npm ci、安装浏览器、启动应用并等待就绪后，添加以下步骤。每个新检出目录可直接执行同一文件，不依赖之前的 .shiplens 数据。',
      ) +
      code(
        '- name: Verify acceptance\n  run: npx shiplens review verify --config shiplens.config.json --plan acceptance.json --fail-on warning',
        'GitHub Actions step',
      ) +
      p(
        'Retain .shiplens/reviews as a CI artifact even when verification exits 1, using your CI’s always-run artifact upload. Review stored evidence for sensitive content before sharing. Manual criteria intentionally block unattended CI until a reviewer supplies fresh assessments; choose an explicitly text-only release plan only where that matches your acceptance requirements.',
        '即使 verify 返回 1，也应通过 CI 的始终执行产物上传保留 .shiplens/reviews。共享前检查证据是否包含敏感内容。manual 项会阻止无人审查的 CI 通过，直到审查者提交本轮判断；只有在确实符合验收要求时，才采用纯文本规则的发布计划。',
      ) +
      h('proof', 'Application integration check', '应用集成验证') +
      p(
        'The repository includes a reproducible integration check against the built ShipLens documentation app. It checks three real hash routes on desktop and mobile, then verifies that a deliberately altered Quick start title in the served JavaScript blocks the gate. This is a maintainer-controlled regression check, not a customer study or an AI accuracy comparison.',
        '仓库包含针对构建后 ShipLens 文档应用的可复现集成检查：覆盖三个真实 hash 路由的桌面与手机端，并验证服务端故意改错 Quick start 标题后会阻断验收。这是维护者控制的回归检查，不是客户研究或 AI 准确率对比。',
      ) +
      code('npm run build\nnpm run test:plan-docs') +
      p(
        `<a href="${import.meta.env.BASE_URL}plan-verification/results.json">Inspect the recorded integration result</a>. The existing <a href="#/docs/checked-review">0.5 workflow benchmark</a> remains separate; no new speed, model-cost or detection-superiority claim is made.`,
        `<a href="${import.meta.env.BASE_URL}plan-verification/results.json">查看记录的集成结果</a>。此前的 <a href="#/docs/checked-review">0.5 工作流对照</a>单独保留，本次不新增速度、模型费用或检测优越性的结论。`,
      ),
  };
}
