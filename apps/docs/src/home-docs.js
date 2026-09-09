import { t } from './i18n.js';
import { h, p, dataTable as table } from './markup.js';
import { summary } from '../public/plan-lock/results.json';

export function homeDocs() {
  return {
    id: 'introduction',
    source: 'home-docs.js',
    group: t('Get started', '开始使用'),
    title: t('Fix the code. Keep the acceptance standard.', '修复代码，守住验收标准。'),
    description: t(
      'An npm toolkit for AI-assisted acceptance. Pin approved requirements, block changed checks before execution, and collect fresh browser evidence for the same standard.',
      '给 AI 辅助验收用的 npm 工具。固定已确认的要求，执行前拦截被修改的断言，再按同一标准采集新浏览器证据。',
    ),
    body:
      `<div class="home-actions"><a class="home-action-primary" href="#/docs/acceptance-lock?section=start">${t('Try the runnable example', '运行实际案例')}</a><a href="#/docs/acceptance-lock?section=proof">${t('Inspect the comparison', '查看对比证据')}</a></div>` +
      h('comparison', 'A green test can hide a changed requirement', '测试变绿了，要求可能也变了') +
      p(
        'The page still shows ¥999. Change the check from “equals ¥129” to “contains ¥” and the current test passes. With an approved lock, ShipLens blocks verification and identifies the changed price check.',
        '页面仍显示 ¥999。把“必须等于 ¥129”改成“包含 ¥”，当前测试就能通过。配置已确认的标准锁后，ShipLens 会阻止验收，并指出 price 断言发生了变化。',
      ) +
      `<dl class="home-evidence"><div><dt>${t('Approved requirement', '已确认的要求')}</dt><dd>equals ¥129</dd></div><div><dt>${t('Changed check', '修改后的断言')}</dt><dd>contains ¥</dd></div><div><dt>${t('Page still shows', '页面实际仍显示')}</dt><dd>¥999</dd></div></dl>` +
      table(
        [
          [
            t('Run the current Playwright tests', '执行当前 Playwright 测试'),
            t('Command succeeds with the changed assertion.', '按修改后的断言执行，命令成功。'),
          ],
          [
            'ShipLens + ' + t('approved lock', '已确认的标准锁'),
            t(
              'Blocked before browser execution: price.checks changed.',
              '打开浏览器前拦截：price.checks 已变更。',
            ),
          ],
          [
            'Playwright + ' + t('a custom standard guard', '自建标准保护层'),
            t(
              'Also blocks it. You implement and maintain the guard.',
              '同样能拦住，需要自行实现和维护保护层。',
            ),
          ],
        ],
        [t('Approach', '方式'), t('Result for this example', '本案例结果')],
      ) +
      `<p class="home-study-note">${t(`Recorded locally: ${summary.changedStandards} changed-standard cases, ${summary.shiplensBlockedBeforeBrowser} blocked before browsing, ${summary.changedStandardRequests} website requests. Three unchanged controls also behaved as expected. No AI model was tested.`, `本地实测：${summary.changedStandards} 种标准变更，${summary.shiplensBlockedBeforeBrowser} 种在浏览器执行前被拦截，产生 ${summary.changedStandardRequests} 次网站请求。另有 3 个未改标准的对照，结果均符合预期。未测试 AI 模型。`)} <a href="#/docs/acceptance-lock?section=proof">${t('Method, cases and raw outputs', '方法、案例与原始输出')}</a></p>` +
      h(
        'advantage',
        'A ready-made guard around AI verification',
        '把 AI 验收需要的保护层直接用起来',
      ) +
      p(
        'Playwright executes browser tests; it can also underpin a custom solution to this problem. ShipLens supplies the reviewed lock, readable differences, enforcement across CLI/API/MCP, and a lock reference in the acceptance report. Keep your existing Playwright tests; add this layer where an assistant edits acceptance plans.',
        'Playwright 执行浏览器测试，也能作为自建方案的基础。ShipLens 提供已评审标准的锁定、可读差异、CLI / API / MCP 统一拦截，以及报告中的标准指纹。保留现有 Playwright 测试，在助手会修改验收文件的地方增加这一层。',
      ) +
      `<div class="reading-paths home-capabilities">${[
        [
          'acceptance-lock',
          'Protect approved requirements',
          '保护已确认的要求',
          'Catch deleted criteria, rewritten assertions, changed selectors and reduced mobile coverage.',
          '发现删除验收项、改写断言、更换选择器和缩小手机端覆盖。',
        ],
        [
          'check-audit',
          'Challenge weak checks',
          '挑战原本就弱的规则',
          'Try counterexamples against passing text checks before you approve them.',
          '确认标准前，用反例检查已通过的文本规则是否过于宽松。',
        ],
        [
          'delivery-proof',
          'Verify saved records',
          '验证保存记录',
          'Connect a UI action, correlated API readback and an injected failure trial.',
          '关联页面操作、API 回读和注入失败分支，验证保存结果。',
        ],
        [
          'mcp',
          'Give your assistant evidence',
          '让助手拿到验收证据',
          'Use MCP to inspect changes, run checks and read linked browser evidence.',
          '通过 MCP 查看变更、执行检查并读取关联浏览器证据。',
        ],
      ]
        .map(
          ([id, en, zh, detail, detailZh]) =>
            `<a href="#/docs/${id}"><strong>${t(en, zh)}</strong><span>${t(detail, detailZh)}</span></a>`,
        )
        .join('')}</div>` +
      h('fit', 'When to use it', '什么情况下值得用') +
      p(
        'Use it when an AI assistant can edit the code and the acceptance plan, but a maintainer or CI host owns the approved standard. No extra model API key is required. Start with the bundled example, then lock a reviewed plan for your own app.',
        '适用于 AI 助手可以修改代码和验收文件，而维护者或 CI 主机掌握已确认标准的工作流。不需要额外的模型 API Key。先运行包内案例，再为自己的应用锁定经过评审的验收文件。',
      ) +
      p(
        'The lock detects definition changes, including legitimate improvements; a maintainer must approve a replacement. It does not decide whether a requirement is correct. Protect both the expected fingerprint and the enforcing host from candidate edits: an actor who controls both can bypass the guard.',
        '标准锁会发现定义变化，包括合理的增强；更换标准需要维护者重新确认。它不判断需求本身是否正确。预期指纹与执行主机必须独立于候选修改受到保护：同时控制两者的人仍可绕过检查。',
      ) +
      `<p><a href="#/docs/acceptance-lock?section=start">${t('Run the example →', '运行案例 →')}</a> · <a href="#/docs/quickstart">${t('Start with a website scan', '从网站扫描开始')}</a></p>` +
      `<div class="reading-meta"><span>Node.js 22.12+</span><span>JavaScript / TypeScript</span><span>MIT</span></div>`,
  };
}
