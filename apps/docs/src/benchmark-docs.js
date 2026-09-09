import { t } from './i18n.js';
import { code, p, h, note, escape } from './markup.js';
import result from '../public/benchmark/results.json';

export function benchmarkDocs() {
  const { summary: s, metadata: m, safety } = result;
  const seconds = (ms) => `${(ms / 1000).toFixed(2)} s`;
  const base = `${import.meta.env.BASE_URL}benchmark/`;
  const grid = (headings, rows) =>
    `<div class="table-scroll"><table><thead><tr>${headings.map((x) => `<th scope="col">${escape(x)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const checks = [
    [
      t('Old-run evidence rejected', '拒绝引用旧轮次证据'),
      safety.filter((x) => x.oldRunEvidence.rejected).length,
    ],
    [
      t('Missing mobile evidence rejected', '拒绝缺少手机证据的通过'),
      safety.filter((x) => x.missingMobile.rejected).length,
    ],
    [
      t('Deleted cited image blocks gate', '删除已引用截图后阻止验收'),
      safety.filter((x) => !x.deletedArtifactGate.passed).length,
    ],
    [
      t('Fresh replay remains pending and blocked', '新复测保持待判断且未通过'),
      safety.filter((x) => x.freshRunStatus === 'pending' && !x.freshRunGate.passed).length,
    ],
    [
      t('Fresh complete honest pass accepted', '接受完整新证据与正确通过判断'),
      safety.filter((x) => x.completeGate.passed).length,
    ],
  ];
  return {
    id: 'benchmark',
    source: 'benchmark-docs.js',
    group: t('AI review', 'AI 验收'),
    title: t('Workflow benchmark', '工作流对照实测'),
    description: t(
      'What a reproducible Playwright comparison shows—and what it cannot establish about AI.',
      '公开可复现的 Playwright 对照结果，以及尚未验证的 AI 收益。',
    ),
    body:
      p(
        'Both approaches found every seeded text defect in this small test. ShipLens added evidence integrity checks and saved review cases; it did not establish a detection advantage.',
        '这组小规模测试中，两种方式都发现了全部预置文本缺陷。ShipLens 提供了证据完整性检查与保存验收案例的流程，但没有证明发现问题更准。',
      ) +
      note(
        'This is an author-run, synthetic, deterministic workflow benchmark. No AI model was invoked. It is not a GPT-only versus GPT + ShipLens trial, an independent evaluation or a customer-project result.',
        '这是由项目作者运行的合成场景、确定性工作流测试，没有调用 AI 模型。它不是“只用 GPT”与“GPT + ShipLens”的对照，不是独立评测，也不代表客户真实项目表现。',
      ) +
      h('results', 'Measured results', '实际测试结果') +
      p(
        `Measured engine: ShipLens ${m.shiplens}; ${m.repetitions} repetitions × ${m.fixtureCount} fixture patterns × 2 states × 2 viewports per arm. The 25 defective observations repeat five failing device/state combinations; they are not 25 unique bugs.`,
        `被测引擎：ShipLens ${m.shiplens}；每组 ${m.repetitions} 次重复 × ${m.fixtureCount} 个场景 × 2 个状态 × 2 种视口。25 次缺陷观测来自重复的五种设备与状态组合，并非 25 个不同的 Bug。`,
      ) +
      grid(
        [t('Metric', '指标'), 'Playwright', 'ShipLens'],
        [
          [
            t('Detected defective observations', '检出的缺陷观测'),
            `${s.playwright.detected}/${s.playwright.defectObservations}`,
            `${s.shiplens.detected}/${s.shiplens.defectObservations}`,
          ],
          [t('Missed defects', '漏检'), s.playwright.missed, s.shiplens.missed],
          [
            t('False alarms on clean observations', '正常观测中的误报'),
            `${s.playwright.falseAlarms}/${s.playwright.cleanObservations}`,
            `${s.shiplens.falseAlarms}/${s.shiplens.cleanObservations}`,
          ],
          [t('Failed cycles', '失败轮次'), s.playwright.failedTrials, s.shiplens.failedTrials],
          [
            t('Median before + after cycle', '修复前后完整轮次中位耗时'),
            seconds(s.playwright.medianCycleMs),
            seconds(s.shiplens.medianCycleMs),
          ],
          [
            t('Cycle range', '完整轮次耗时范围'),
            `${seconds(s.playwright.minCycleMs)}–${seconds(s.playwright.maxCycleMs)}`,
            `${seconds(s.shiplens.minCycleMs)}–${seconds(s.shiplens.maxCycleMs)}`,
          ],
          [
            t('Median after-fix collection + judgment', '修复后采集与判断中位耗时'),
            seconds(s.playwright.medianAfterMs),
            seconds(s.shiplens.medianAfterMs),
          ],
          [
            t('Model tokens / dollar cost / human time', '模型 Token / 费用 / 人工时间'),
            t('Not measured', '未测量'),
            t('Not measured', '未测量'),
          ],
        ],
      ) +
      p(
        'The arms produce different amounts of work. Playwright writes regional PNGs, visible text, assertions and error logs. ShipLens also runs page/flow smoke checks, stores manifests and assessments, and saves a case. These timings describe this workflow on one machine; they do not show equal-work engine performance or a model speed advantage.',
        '两组产出范围不同：Playwright 保存局部 PNG、可见文本、断言和错误日志；ShipLens 还执行页面与交互冒烟检查、保存清单和判断记录，并生成案例。耗时只描述本机上的这一流程，不能代表同工作量引擎性能或模型速度优势。',
      ) +
      h('fixtures', 'The three scenarios', '三个测试场景') +
      grid(
        [t('Fixture', '场景'), t('Before repair', '修复前'), t('After repair', '修复后')],
        [
          [t('Catalog price', '商品价格'), 'Price: $29', 'Price: $19'],
          [
            t('Registration after click', '点击后的注册确认'),
            'Please try again',
            'Registration complete',
          ],
          [
            t('Dashboard status', '仪表盘状态'),
            t(
              'Desktop: Sync complete; mobile: Sync pending',
              '桌面：Sync complete；手机：Sync pending',
            ),
            t('Both: Sync complete', '两端：Sync complete'),
          ],
        ],
      ) +
      p(
        'Both arms use the same predefined exact-visible-text oracle. The dashboard desktop state is already correct before repair, and all after states are clean controls. These checks do not exercise visual aesthetics, exploration, selector discovery, complex business rules or repair generation.',
        '两组使用完全相同的预设可见文本精确匹配断言。仪表盘桌面状态在修复前就是正确的，修复后的所有状态也是正常对照。本测试不考查视觉美观、页面探索、选择器发现、复杂业务规则或自动修复。',
      ) +
      h('integrity', 'What the evidence workflow enforced', '证据流程实际约束了什么') +
      grid(
        [t('Probe', '探测项'), t('Observed outcomes', '实际结果')],
        checks.map(([label, n]) => [label, `${n}/${safety.length}`]),
      ) +
      p(
        'The baseline also reruns its script and produces fresh assertions. It has no custom citation registry or acceptance gate. You can build these around Playwright; ShipLens supplies the packaged workflow. An absent baseline API is not counted as an AI error or a missed defect.',
        '基线同样能重跑脚本并得到新断言，只是没有另写证据引用登记和验收门禁。你可以在 Playwright 上自行建设这些能力，ShipLens 则提供封装好的流程。基线没有某个 API，不会被统计成 AI 错误或漏检。',
      ) +
      note(
        `Limit deliberately tested: all ${safety.filter((x) => x.falseSemanticPassGate.passed).length}/${safety.length} incorrect semantic “pass” submissions with complete current evidence were accepted by the gate. ShipLens checks evidence availability and scope, not whether a caller truly understood the page. A passing gate is not proof of business correctness.`,
        `刻意验证的限制：附带完整当前证据、但业务判断错误的“通过”在 ${safety.filter((x) => x.falseSemanticPassGate.passed).length}/${safety.length} 次探测中都被门禁接受。ShipLens 检查证据可用性与范围，不判断调用方是否真正理解网页；门禁通过不等于业务正确。`,
      ) +
      h('method', 'Method and limitations', '测试方法与局限') +
      p(
        `Executed ${m.timestamp.slice(0, 10)} (UTC) on ${m.cpu}, ${m.platform}/${m.arch}, Node ${m.node}, Playwright ${m.playwright}, Chromium ${m.chromium}. Viewports: 1440 × 900 and 390 × 844, device scale 1. Each phase starts a new browser and isolated contexts; arm order alternates. No parallel benchmark workers.`,
        `运行日期 ${m.timestamp.slice(0, 10)}（UTC）；${m.cpu}，${m.platform}/${m.arch}，Node ${m.node}，Playwright ${m.playwright}，Chromium ${m.chromium}。视口为 1440 × 900 与 390 × 844，像素倍率 1。每个阶段使用新浏览器和独立上下文，两组交替先后运行，无并行基准任务。`,
      ) +
      p(
        'Cycles include browser startup, before/after captures, disk writes, deterministic judgments and ShipLens case saving. HTML export and integrity probes are outside cycle timing. Installation, scripting, diagnosis, code repair, human review and model calls are excluded. Synchronous local fixtures have no authentication, external resources or realistic network latency; crawl, scroll and settle waits are disabled. One author-run batch and repeated fixtures do not support statistical generalization.',
        '轮次耗时包含启动浏览器、修复前后采集、写盘、确定性判断和 ShipLens 案例保存；HTML 导出与完整性探测另行执行，不计入轮次。安装、编写脚本、诊断、修复代码、人工审查与模型调用均未计时。同步本地页面没有登录、外部资源或真实网络延迟，关闭爬取、滚动与 settle 等待。作者单机运行的一批重复场景，不能支持统计泛化。',
      ) +
      p(
        'Two development pilots are retained separately. The first found a benchmark artifact-path error; the second verified the fix. Baseline load waiting was then aligned to DOMContentLoaded before the formal batch. All formal trials are retained. No ShipLens engine changes were made for the test.',
        '另保留两次开发预跑：第一次发现测试脚本的产物路径错误，第二次验证修复；正式运行前将基线页面等待统一为 DOMContentLoaded。正式批次保留全部轮次。本次测试没有修改 ShipLens 引擎。',
      ) +
      h('reproduce', 'Inspect and reproduce', '查看证据与复现') +
      p(
        `<a href="${base}results.json">Download all raw results (JSON)</a> · <a href="${base}report.html" target="_blank" rel="noopener">Open measured before/after report</a>`,
        `<a href="${base}results.json">下载全部原始结果（JSON）</a> · <a href="${base}report.html" target="_blank" rel="noopener">打开本次修复前后报告</a>`,
      ) +
      p(
        `<a href="${base}evidence.zip">Download evidence archive</a>: all 120 observed PNGs with matching JSON records and 15 comparison reports. PNG SHA-256 values match the raw results.`,
        `<a href="${base}evidence.zip">下载全部证据压缩包</a>：含 120 张实际观测 PNG、对应 JSON 记录与 15 份对比报告；PNG 的 SHA-256 与原始结果一致。`,
      ) +
      p(
        `<a href="${base}run.mjs">Read the exact runner</a> · <a href="${base}README.md">Read the full protocol</a> · <a href="${base}pilot-1.json">Pilot 1</a> · <a href="${base}pilot-2.json">Pilot 2</a>`,
        `<a href="${base}run.mjs">查看实际运行脚本</a> · <a href="${base}README.md">查看完整方法</a> · <a href="${base}pilot-1.json">预跑 1</a> · <a href="${base}pilot-2.json">预跑 2</a>`,
      ) +
      code(
        'git clone https://github.com/yyyz1011/shiplens.git\ncd shiplens\nnpm ci\nnpm run browsers\nnpm run benchmark:workflow',
      ) +
      p(
        'The source download is the repository runner, not a standalone script: use the repository command above for its relative imports. Raw metadata pins the tested engine base commit and the runner SHA-256; the docs release version can be newer than the measured engine. Outputs are written to a new artifacts/benchmark-TIMESTAMP directory.',
        '下载的是仓库内运行脚本，并非独立脚本；其相对导入需使用上面的完整仓库命令。原始元数据记录被测引擎基础提交和运行脚本 SHA-256；文档发布版本可能高于被测引擎版本。输出写入新的 artifacts/benchmark-TIMESTAMP 目录。',
      ) +
      h('decision', 'When this is useful', '如何判断是否适合你') +
      p(
        'For a one-off text assertion, the baseline already works. Consider ShipLens when your AI workflow needs a shared evidence format, fresh per-run acceptance, saved cases and a reviewable repair report. Whether that saves your team time or improves your model’s conclusions remains a separate, unmeasured question.',
        '只检查一次文本断言，基线已经能完成任务。当 AI 工作流需要统一证据格式、每轮重新验收、保存案例和可审查的修复对比报告时，可以考虑 ShipLens。它是否节省你团队的时间、改善模型结论，仍是本次尚未测量的问题。',
      ),
  };
}
