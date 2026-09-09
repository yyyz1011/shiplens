import { t } from './i18n.js';
import { code, p, h, note, table, escape } from './markup.js';
import data from '../public/checked-review/results.json';
export function checkedDocs() {
  const s = data.summary,
    seconds = (arm) => (s[arm].medianCycleMs / 1000).toFixed(2) + ' s';
  const base = `${import.meta.env.BASE_URL}checked-review/`;
  return {
    id: 'checked-review',
    source: 'checked-docs.js',
    group: t('AI review', 'AI 验收'),
    title: t('Checks & review packets', '断言与批量证据'),
    description: t(
      'Automate explicit text acceptance and batch the evidence that still needs a reviewer. Available in 0.5.0.',
      '自动检查明确的文本要求，批量读取仍需判断的证据。0.5.0 起提供。',
    ),
    body:
      p(
        'Use explicit checks for exact text requirements. Keep appearance, exploration and unconfigured business decisions with your reviewer. Existing requirements without checks keep their manual review behavior.',
        '明确的文本要求可以交给断言执行。视觉质量、页面探索和未配置的业务判断仍由审查者负责。未添加断言的现有验收项保留原来的判断流程。',
      ) +
      h('checks', 'Define text checks', '定义文本断言') +
      code(
        `const run = await workspace.collect({
  requirements: [{
    id: 'price', description: 'Displayed price is $19.',
    page: '/checkout', selector: '#price',
    checks: [{ operator: 'equals', value: '$19' }],
    evaluation: 'checks',
  }],
});
console.log(run.requirements[0].status);
console.log(run.requirements[0].verification);
// No caller assessment is needed for this explicit text check.
const gate = await workspace.gate({ runId: run.runId });`,
        'JavaScript',
      ) +
      table([
        [
          'checks',
          'Optional array of 1–10 { operator, value } objects. Operators: equals, contains, excludes. Values: nonblank strings, max 2,000 characters. No regex, scripts or provider configuration.',
          '可选的 1–10 个 { operator, value } 对象。operator 为 equals、contains、excludes；value 为非空字符串，最多 2,000 字符。不接受正则、脚本或模型配置。',
        ],
        [
          'evaluation: manual',
          'Default. Failed/incomplete checks block caller passes. Successful checks still leave a new run pending until a reviewer assesses it.',
          '默认值。断言失败或证据不完整时，拒绝调用方提交通过。断言成功后，新轮次仍待人工或 AI 判断。',
        ],
        [
          'evaluation: checks',
          'Requires checks. Fresh evidence determines status automatically; assessment stays null and no caller receipt is generated. assess cannot override this mode, even with fail or needs-evidence.',
          '必须配置 checks。根据新证据自动确定状态，assessment 为 null，不伪造调用方判断记录。assess 不能覆盖此模式，包括 fail 或 needs-evidence。',
        ],
        [
          'verification',
          '{ source: "deterministic-checks", status, evidenceIds, results }. Per-device results contain viewport, optional evidenceId/checkIndex, status and reason. Failure wins over incomplete; otherwise incomplete becomes needs-evidence.',
          '{ source: "deterministic-checks", status, evidenceIds, results }。每端结果含 viewport、可选 evidenceId/checkIndex、status 与 reason。已发现失败优先，其余不完整证据为 needs-evidence。',
        ],
      ]) +
      p(
        'Text comparisons normalize whitespace and preserve case. They inspect the complete visible, unmasked text in the specified evidence scope on every requested viewport. Missing images, missing/ambiguous scopes, unavailable files and truncated text/elements cannot pass. Excludes means absent from this observed text, not absent from hidden content, masked data, frames or the whole application.',
        '文本比较会统一空白，区分大小写，并检查指定证据范围内每种请求视口的完整、可见、未遮罩文本。缺图、目标缺失或不唯一、文件不可用、文本或元素截断均不能通过。excludes 仅表示在这些已观察文本中不存在，不代表隐藏内容、遮罩数据、iframe 或整个应用中不存在。',
      ) +
      note(
        'Checks enforce the expectations you supplied. They cannot tell whether those expectations were correct. Never convert a visual or subjective requirement into a text-only check just to obtain a pass. Use manual evaluation with checks as guardrails when review is still needed.',
        '断言约束的是你提供的预期，不能判断预期本身是否正确。不要为了通过，把视觉或主观要求降为纯文本检查。仍需审查时，使用 manual 模式并把 checks 作为不可绕过的明确条件。',
      ) +
      h('replay', 'Save, replay and gate', '保存、复测与验收') +
      code(
        `const saved = await workspace.saveCase({ runId: run.runId, name: 'Price' });
const next = await workspace.recheck({ caseId: saved.caseId });
const comparison = await workspace.compareRuns({
  runId: next.runId, previousRunId: run.runId,
});
console.log(next.requirements[0].verification.status);
console.log(comparison.criteria[0].transition);
const report = await workspace.exportReport({ runId: next.runId });`,
        'JavaScript',
      ) +
      p(
        'Checks and evaluation mode travel with saved and portable cases; import requires 0.5+. Recheck evaluates newly captured evidence and does not inherit a pass. Manual criteria still start pending. Changed checks make comparisons non-comparable. getRun and gate revalidate check evidence on read, so deleting an artifact invalidates a past automatic pass. Reports separate configured checks from caller judgments.',
        '断言和 evaluation 模式随案例保存与导出，导入端需要 0.5+。复测使用新采集证据重新计算，不继承通过。manual 项仍从待判断开始。断言变化会使对比不可比。getRun 与 gate 读取时会重新验证断言证据，因此删除产物会使之前的自动通过失效。报告区分配置的断言和调用方判断。',
      ) +
      h('packet', 'reviewPacket({ runId, ... })', 'reviewPacket({ runId, ... })') +
      code(
        `let offset = 0;
do {
  const packet = await workspace.reviewPacket({ runId: next.runId, offset });
  for (const item of packet.items) {
    if (item.readSeparately) {
      const full = await workspace.readEvidence({
        runId: next.runId, evidenceId: item.evidence.evidenceId,
      });
      // Give full evidence to the reviewer; do not silently skip omissions.
    } else {
      // Give item.image and item.observation to the reviewer.
    }
  }
  offset = packet.nextOffset;
} while (offset !== null);
// Assess remaining manual criteria, then call gate.`,
        'JavaScript',
      ) +
      table([
        [
          'offset / limit',
          'Evidence offset ≥ 0 (default 0); limit 1–10 (default 6). Follow nextOffset until null. total is the number of matching evidence items.',
          '证据偏移 offset ≥ 0，默认 0；limit 为 1–10，默认 6。沿 nextOffset 读取到 null。total 为匹配证据项数量。',
        ],
        [
          'includePassed',
          'Default false: return only unresolved requirements and their evidence. true also includes passed requirements. Machine findings still require gate, even with an empty packet.',
          '默认 false，仅返回未通过的验收项及其证据；true 也包含已通过项。即使证据包为空，机器问题仍需 gate 检查。',
        ],
        [
          'includeImages',
          'Default true. API items contain PNG base64 images. false gives text/index evidence only and still requires images for visual review.',
          '默认 true，API items 含 PNG base64 图片。false 仅返回文本和索引，视觉审查仍须读取图片。',
        ],
        [
          'maxBytes / bytes',
          'Default 2 MiB; range 16 KiB–8 MiB. Budget applies to serialized API JSON including base64. bytes is that payload size, not token count or MCP wire size. Metadata exceeding the budget rejects.',
          '默认 2 MiB，范围 16 KiB–8 MiB。限制序列化 API JSON（含 base64）的大小。bytes 为该大小，不是 Token 数或 MCP 传输大小。元数据超过预算会拒绝。',
        ],
        [
          'items / omitted / readSeparately',
          'Items contain evidence, observation, findings, suppressed, warning and optional image. Budget omissions are named; unavailable or omitted proof sets readSeparately. Fetch it individually or recollect. No silent complete-review claim.',
          'items 含 evidence、observation、findings、suppressed、warning 和可选 image。超预算省略内容列在 omitted；不可用或省略证据会设置 readSeparately。需逐条补读或重采，不能静默视为审查完整。',
        ],
        [
          'requirements / nextOffset',
          'Requirement definitions, status and optional verification; omits assessment history. nextOffset pages evidence, not requirements. Packet membership is based on statuses at read time.',
          '返回验收项定义、状态和可选 verification，不含判断历史。nextOffset 对证据分页，不对验收项分页。内容按读取时的状态筛选。',
        ],
      ]) +
      p(
        'MCP: shiplens_review_packet uses the same inputs and returns native image blocks. Each item.imageIndex maps to zero-based native-image order; API image fields are removed from the text payload. Do not change assessments while paging the default unresolved list; changing statuses changes its membership. Read all pages first, then assess. CLI accepts packet options through --input JSON.',
        'MCP：shiplens_review_packet 使用相同参数，返回原生图片块。item.imageIndex 对应从零开始的图片顺序，文本载荷不重复携带 API 的图片字段。默认分页期间不要修改判断状态，否则未通过列表会变化；先读完所有页，再判断。CLI 可通过 --input JSON 指定参数。',
      ) +
      code(
        'shiplens review packet --config shiplens.config.json --run RUN_ID\n# Optional --input: { "includePassed": true, "limit": 10 }',
      ) +
      h('measured', 'Measured protocol changes', '实际测得的流程变化') +
      p(
        'Five repetitions of one synthetic checkout; six requirements, two viewports, before/after repair. Five criteria use explicit checks in 0.5.0 and one deliberately remains manual. All caller judgments are scripted text assertions; no AI model is invoked. Each arm records 120 observations: 10 repeated defective observations and 110 clean controls.',
        '一个合成结算页面重复五次，包含六项要求、两种视口、修复前后两种状态。0.5.0 中五项使用显式断言，一项刻意保留 manual。所有调用方判断均为脚本文本断言，没有调用 AI。每组 120 次观测，包含 10 次重复缺陷观测与 110 次正常对照。',
      ) +
      `<div class="table-scroll"><table><thead><tr><th>${t('Metric', '指标')}</th><th>Playwright</th><th>0.4.1</th><th>0.5.0</th></tr></thead><tbody>${[
        [
          t('Review API operations / cycle', '每轮 review API 操作'),
          '—',
          s['0.4.1'].reviewApiCallsPerCycle,
          s['0.5.0'].reviewApiCallsPerCycle,
        ],
        [
          t('Caller receipts / cycle', '每轮调用方判断记录'),
          '—',
          s['0.4.1'].callerAssessmentsPerCycle,
          s['0.5.0'].callerAssessmentsPerCycle,
        ],
        [
          t('Median cycle time', '完整轮次中位耗时'),
          seconds('playwright'),
          seconds('0.4.1'),
          seconds('0.5.0'),
        ],
        [
          t('Misses / false alarms', '漏检 / 误报'),
          `${s.playwright.missed} / ${s.playwright.falseAlarms}`,
          `${s['0.4.1'].missed} / ${s['0.4.1'].falseAlarms}`,
          `${s['0.5.0'].missed} / ${s['0.5.0'].falseAlarms}`,
        ],
        [
          t('False price-pass overrides rejected', '拒绝错误价格通过覆盖'),
          '—',
          `${s['0.4.1'].falsePassRejections}/5`,
          `${s['0.5.0'].falsePassRejections}/5`,
        ],
      ]
        .map((row) => `<tr>${row.map((x) => `<td>${escape(x)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>` +
      note(
        '40 → 8 is an 80% reduction in review API operations in this scripted protocol. It is not an 80% reduction in model calls, tokens or cost. A custom wrapper can batch old operations too. Timings overlap and do not establish a speed improvement. Playwright already supports reusable assertions and remains the lighter baseline here.',
        '40 → 8 表示本脚本协议中的 review API 操作减少 80%，不表示模型调用、Token 或费用减少 80%。旧版也可由自定义封装批量执行。耗时范围重叠，未证明速度提升；Playwright 本来就支持可复用断言，在这里仍是更轻的基线。',
      ) +
      p(
        `Measured ${data.metadata.timestamp.slice(0, 10)} UTC on ${data.metadata.cpu}, ${data.metadata.platform}, Node ${data.metadata.node}, Chromium ${data.metadata.chromium}. Package installation, diagnosis, actual code repair, export and safety probes are outside timing. ShipLens generates extra reports and a ledger. Raw trials retain timing ranges and every failure; this does not prove model accuracy, customer time savings or general superiority.`,
        `测量于 ${data.metadata.timestamp.slice(0, 10)} UTC；${data.metadata.cpu}，${data.metadata.platform}，Node ${data.metadata.node}，Chromium ${data.metadata.chromium}。安装、诊断、实际修复代码、导出和安全探测不计时，ShipLens 还会额外生成报告和验收记录。原始轮次保留耗时范围与所有失败；本测试不能证明模型准确率、客户时间收益或全面优势。`,
      ) +
      p(
        `<a href="${base}results.json">Raw results</a> · <a href="${base}run.mjs">Exact runner</a> · <a href="${base}README.md">Protocol & reproduction</a> · <a href="${base}evidence.zip">360 screenshots</a> · <a href="${base}pilot.json">Development pilot</a>`,
        `<a href="${base}results.json">原始结果</a> · <a href="${base}run.mjs">实际脚本</a> · <a href="${base}README.md">方法与复现</a> · <a href="${base}evidence.zip">360 张截图</a> · <a href="${base}pilot.json">开发预跑</a>`,
      ) +
      h('example', 'Run the packaged example', '运行包内示例') +
      code(
        'npm install --save-dev shiplens@0.5.0\nnpx shiplens browsers\n# Terminal 1\nnode node_modules/shiplens/examples/server.mjs\n# Terminal 2\nnode node_modules/shiplens/examples/checks.mjs',
      ) +
      p(
        'The example checks itinerary text, saves a case, rechecks fresh evidence and prints the gate with zero caller assessments. It validates only the configured text requirement.',
        '示例检查行程文本、保存案例、重采证据，并在零调用方判断记录的情况下输出验收结果。它只验证配置的文本要求。',
      ),
  };
}
