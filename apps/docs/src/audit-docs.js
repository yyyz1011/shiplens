import { t } from './i18n.js';
import { code, p, h, note, table } from './markup.js';

export function auditDocs() {
  return {
    id: 'check-audit',
    source: 'audit-docs.js',
    group: t('AI review', 'AI 验收'),
    title: t('Would your checks catch a mistake?', '页面错了，规则能发现吗？'),
    description: t(
      'Challenge passing text checks with concrete counterexamples before trusting an AI-authored acceptance plan. Available in 0.7.0.',
      '在信任 AI 编写的验收文件前，用具体反例检查已通过的文本规则。0.7.0 起提供。',
    ),
    body:
      h('blind-spot', 'A passing check can miss a wrong price', '规则通过，金额却可能已经错了') +
      p(
        'Suppose the specification says “Total: ¥129”, but the check only requires “¥”. Both ¥129 and ¥999 pass. ShipLens can expose this blind spot from saved evidence, without launching another browser or calling a model. It simulates alternative text against the same configured predicates; it does not edit the website.',
        '假设需求明确规定“Total: ¥129”，规则却只检查是否包含“¥”。¥129 和 ¥999 都会通过。ShipLens 可以从保存的证据中找出这个盲区，无需再次启动浏览器或调用模型。它将反事实文本交给相同的规则求值，不会修改网页。',
      ) +
      code(
        'Observed:       Total: ¥129\nCheck:          contains "¥"\nCounterexample: Total: ¥999\nResult:         survived — the rule still passes',
        t('Illustrative counterexample', '反例示意'),
      ) +
      note(
        'A survivor is a possible weakness in a text rule, not a confirmed website bug. Confirm that the changed content violates the intended requirement. Do not copy the entire observed page into an equals check merely to eliminate survivors.',
        'survived 表示文本规则可能存在盲区，不代表网站出现了真实故障。先确认变动是否违反预期需求。不要为了消除反例，直接把整页观察文本复制成 equals 规则。',
      ) +
      h('try', 'Try it locally', '在本地试用') +
      code(
        'npm install --save-dev --save-exact shiplens@0.7.0\nnpx shiplens browsers\nnode node_modules/shiplens/examples/server.mjs',
      ) +
      p(
        'In another terminal, run the packaged example. Its intentionally weak heading check accepts a known incorrect title. The JSON shows the original text, labeled counterexample and failing check indexes (an empty array means all checks still pass).',
        '在另一个终端运行包内示例。示例故意使用较弱的标题规则，使已知错误标题仍能通过。JSON 会列出原文、带标签的反例和未通过断言的索引；索引数组为空表示所有规则仍然通过。',
      ) +
      code('node node_modules/shiplens/examples/audit.mjs') +
      h('cli', 'Audit an existing run', '检查已有验收轮次') +
      p(
        'Use the runId returned by verify or collect. shiplens review runs --config shiplens.config.json retrieves past runs. The same host configuration and local evidence directory must be available; the website can be offline.',
        '使用 verify 或 collect 返回的 runId，也可通过 shiplens review runs --config shiplens.config.json 找到历史轮次。需要原主机配置和本地证据目录，网站本身可以离线。',
      ) +
      code(
        'npx shiplens review audit --config shiplens.config.json --run <runId> > check-audit.json',
      ) +
      p(
        'audit writes JSON to stdout and exits 0 when completed, even when counterexamples survive. Command errors exit 2 and go to stderr. It is advisory and does not change gate, assessments, cases or reports. Use --input audit-options.json for filtering, paging, custom counterexamples or a larger byte budget; there are no separate --limit or --max-bytes flags.',
        'audit 将 JSON 输出到 stdout，完成时退出码为 0，即使反例存活也如此。命令错误写入 stderr，退出码为 2。结果仅供分析，不修改 gate、判断记录、案例或报告。筛选、分页、自定义反例和字节预算通过 --input audit-options.json 传入，不提供独立 --limit 或 --max-bytes 标志。',
      ) +
      code(
        JSON.stringify(
          {
            criterionIds: ['price'],
            limit: 1,
            counterexamples: [
              { criterionId: 'price', label: 'Incorrect order total', text: 'Total: ¥999' },
            ],
          },
          null,
          2,
        ),
        'audit-options.json',
      ) +
      code(
        'npx shiplens review audit --config shiplens.config.json --run <runId> --input audit-options.json',
      ) +
      h('api', 'auditChecks({ runId, ... })', 'auditChecks({ runId, ... })') +
      code(
        "import { ReviewWorkspace } from 'shiplens/review';\nconst workspace = new ReviewWorkspace({\n  directory: '.shiplens/reviews',\n  options: { url: 'http://127.0.0.1:3000', viewport: 'both', crawl: false },\n});\nconst options = { runId: 'REPLACE_WITH_RUN_ID', limit: 2 };\nlet offset = 0;\ndo {\n  const audit = await workspace.auditChecks({ ...options, offset });\n  console.log(audit.items, audit.pageSummary);\n  if (audit.nextOffset === null) break;\n  offset = audit.nextOffset;\n} while (true);",
        'JavaScript',
      ) +
      table([
        [
          'runId',
          'Required run UUID. The method reads saved evidence only; it neither collects nor verifies the live site.',
          '必填轮次 UUID。只读取已保存证据，不采集或验证实时网站。',
        ],
        [
          'criterionIds',
          'Optional 1–50 unique known requirement IDs. Default: all requirements. Results retain run order, not filter order.',
          '可选，1–50 个不重复的已知要求 ID。默认全部，返回顺序沿用轮次顺序。',
        ],
        [
          'offset / limit',
          'offset defaults to 0 and must be a nonnegative integer. limit defaults to 5; allowed 1–5 requirements per page. Follow nextOffset until null.',
          'offset 默认为 0，必须为非负整数。limit 默认 5，可设 1–5 项/页，持续读取 nextOffset 直至 null。',
        ],
        [
          'maxBytes',
          'Default 524,288; allowed 16,384–2,097,152. Budget measures serialized API JSON bytes, not model tokens or MCP wire bytes. If one item is too large, increase the budget or narrow evidence/custom samples; probes are never silently cut.',
          '默认 524,288，可设 16,384–2,097,152。计量序列化 API JSON 字节，不是模型 token 或 MCP 传输大小。单项过大时提高预算，或缩小证据/自定义样例；不会静默删减反例。',
        ],
        [
          'counterexamples',
          'Optional, up to 20 objects: criterionId (1–80 characters), label (1–120), text (0–8,000). Each must reference a selected requirement. Text replaces the entire scoped observation for simulation, not one substring. Custom samples run separately for each device.',
          '可选，最多 20 个对象：criterionId 为 1–80 字符，label 为 1–120，text 为 0–8,000。必须引用选中的要求。text 在模拟时替代整个作用域文本，不是仅替换某个子串；每个设备独立评估。',
        ],
      ]) +
      p(
        'MCP exposes shiplens_audit_checks with identical inputs and JSON results. It is a read-only tool, contains no images and performs no website or model requests. Page text and user-supplied samples remain untrusted data. The TypeScript return type is CheckAudit.',
        'MCP 提供相同参数和 JSON 结果的 shiplens_audit_checks。它是只读工具，不返回图片，也不请求网站或模型。页面文本和用户提供的样例仍是不可信数据。TypeScript 返回类型为 CheckAudit。',
      ) +
      h('results', 'Read the result without overclaiming', '如何解释结果') +
      table(
        [
          [
            'audited',
            'All configured text checks pass with complete saved evidence across requested viewports; synthetic probes were evaluated. This says nothing about a manual judgment.',
            '全部配置文本规则在所有指定视口的完整保存证据上通过，已进行反例求值；不代表人工判断已通过。',
          ],
          [
            'no-checks',
            'No text checks exist. Visual or business judgment cannot be audited by this method.',
            '没有文本规则，无法用此方法检查视觉或业务判断。',
          ],
          [
            'baseline-failing / needs-evidence',
            'Existing checks fail, or evidence is missing, damaged or truncated. No probes are reported as audited; fix or recollect first.',
            '现有规则失败，或证据缺失、损坏、截断。不声称已完成反例检查，先修复或重新采集。',
          ],
          [
            'survived / caught / unchanged',
            'All checks still pass / at least one check rejects the text / text is unchanged after whitespace normalization. unchanged is not counted as caught or survived.',
            '全部规则仍通过 / 至少一条规则拒绝文本 / 规范空白后与原文相同。unchanged 不算拦截或存活。',
          ],
          [
            'items[].samples',
            'Per-device evidenceId, observedText, sourceSha256, numericCandidates, numericTested and probes. Each probe includes kind, text, optional label, result and zero-based failedCheckIndexes.',
            '各设备的 evidenceId、observedText、sourceSha256、numericCandidates、numericTested 和 probes。反例包含 kind、text、可选 label、result、从 0 开始的 failedCheckIndexes。',
          ],
          [
            'sourceSha256',
            'SHA-256 of JSON.stringify(parsed observation) when audited. An observation identifier, not a signature, image digest or proof of a real counterexample.',
            '检查时对 JSON.stringify(解析后 observation) 计算 SHA-256。它标识观察文本，不是签名、图片摘要或真实反例的证明。',
          ],
          [
            'pageSummary / total / bytes',
            'pageSummary counts only this returned page. total counts selected requirements, including skipped ones. bytes is serialized JSON size. nextOffset is null only when no selected requirements remain.',
            'pageSummary 只统计本页，total 统计全部选中要求，包含跳过项。bytes 是 JSON 序列化大小。仅当没有剩余选中要求时 nextOffset 才为 null。',
          ],
        ],
        [t('Field or status', '字段或状态'), t('Meaning', '含义')],
      ) +
      p(
        'Built-in probes replace text with empty or Loading…, append Error: undefined, and independently alter the first six ASCII numeric tokens by rotating each digit (9 becomes 0). At most nine built-in probes per observation. Formatting, full-width digits, dates and business meaning are not inferred; numericCandidates versus numericTested exposes the limit. These are alternative strings, not DOM or source-code mutations. No visual, interaction, network, accessibility or model reasoning coverage is added.',
        '内置反例包括空文本、Loading…、追加 Error: undefined，并对前六个 ASCII 数字片段分别逐位加一（9 变 0），每份观察最多九个内置反例。不推断格式、全角数字、日期或业务含义；numericCandidates 与 numericTested 明示数量上限。这些是替代文本，不是 DOM 或源码变异，不增加视觉、交互、网络、无障碍或模型推理覆盖。',
      ) +
      h('improve', 'Close the loop with your assistant', '让 AI 补强验收规则') +
      p(
        'Give the assistant the requirement and surviving text. Confirm which changes must fail, add an expected-value check scoped to that field, then collect a fresh run and audit it again. Keep subjective layout or intent as manual acceptance. Use custom counterexamples for known unacceptable states; do not equate zero surviving probes with a complete test plan.',
        '把需求和存活反例交给 AI，确认哪些变化必须判错，为对应字段增加预期值断言，再采集新轮次并重新检查。主观布局或意图仍采用人工验收。可用自定义反例描述已知不可接受状态；没有存活反例不等于测试计划完整。',
      ) +
      h('comparison', 'What the recorded comparison establishes', '对照验证说明了什么') +
      p(
        'The published case study uses three maintainer-authored requirements (price, stock and delivery), desktop/mobile, and one repetition. Each has a specified correct and incorrect value. Equivalent independently written Playwright predicates and ShipLens both accept all six incorrect observations with weak rules and reject all six with explicit expected text. ShipLens adds an offline explanation of the blind spots; it does not demonstrate better predicate accuracy than Playwright.',
        '公开案例使用维护者编写的金额、库存、送达时间三项要求，覆盖桌面/手机，执行一轮；每项预先指定正确和错误值。独立编写的等价 Playwright 文本判断与 ShipLens 都在弱规则下放过六份错误观察，在明确预期文本后拦截六份错误观察。ShipLens 增加的是离线指出规则盲区的流程，没有证明断言准确率优于 Playwright。',
      ) +
      table(
        [
          [
            t('Weak rules', '弱规则'),
            '3 unique wrong states × 2 viewports: 6 accepted. The audit surfaces all 6 custom counterexamples as survived.',
            '3 个不同错误状态 × 2 视口：6 份错误观察仍通过；离线检查将对应 6 个自定义反例标为 survived。',
          ],
          [
            t('Expected-value rules', '明确预期值的规则'),
            'The same 6 wrong observations are rejected in the browser; all 6 custom counterexamples are caught offline.',
            '浏览器检查拦截相同 6 份错误观察，离线检查也拦截对应 6 个自定义反例。',
          ],
          [
            t('Extra website requests during audit', '反例检查的额外网页请求'),
            '0. The fixture server was stopped before auditing. Collection itself still requires a browser and website access.',
            '0。运行反例检查前已关闭样例服务器；最初证据采集仍需要浏览器及网站访问。',
          ],
        ],
        [t('Comparison', '对照项'), t('Recorded result', '记录结果')],
      ) +
      p(
        `<a href="${import.meta.env.BASE_URL}check-audit/results.json">Download raw results and the 48-artifact checksum manifest</a>. Evidence paths in artifacts[].file are relative to <code>check-audit/</code>. <a href="${import.meta.env.BASE_URL}check-audit/evidence/wrong-weak-price-desktop.png">View the intentionally wrong price</a>. Reproduce with <code>npm run benchmark:audit</code> in the repository; output stays local unless SHIPLENS_RECORD_CHECK_AUDIT=1 is set.`,
        `<a href="${import.meta.env.BASE_URL}check-audit/results.json">下载原始结果与 48 份证据的校验清单</a>。artifacts[].file 的路径相对于 <code>check-audit/</code>。<a href="${import.meta.env.BASE_URL}check-audit/evidence/wrong-weak-price-desktop.png">查看故意改错的金额证据</a>。在仓库执行 <code>npm run benchmark:audit</code> 复现；默认仅生成本地产物，设置 SHIPLENS_RECORD_CHECK_AUDIT=1 才更新公开记录。`,
      ) +
      p(
        'Mutation testing is an established technique: <a href="https://stryker-mutator.io/docs/">Stryker mutates source code and runs tests</a>. <a href="https://playwright.dev/docs/test-assertions">Playwright already provides browser assertions</a>. ShipLens packages saved-evidence counterexamples for an AI acceptance workflow without requiring application source. A custom script can implement the same text simulation. This study includes no customer, model, token-cost, human-time or market-preference measurement.',
        '变异测试是成熟方法：<a href="https://stryker-mutator.io/docs/">Stryker 修改源码并运行测试</a>；<a href="https://playwright.dev/docs/test-assertions">Playwright 已有浏览器断言</a>。ShipLens 把基于保存证据的反例整理进 AI 验收流程，无需应用源码；自行编写脚本也可以实现相同文本模拟。本案例未测量客户效果、模型表现、token 成本、人力时间或市场偏好。',
      ),
  };
}
