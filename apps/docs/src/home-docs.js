import { t } from './i18n.js';
import { h, p } from './markup.js';
import { summary } from '../public/delivery-proof/results.json';

export function homeDocs() {
  const faults = summary.defectiveViewportCases;
  return {
    id: 'introduction',
    source: 'home-docs.js',
    group: t('Get started', '开始使用'),
    title: t('Check that saving actually works.', '验证保存结果，让 AI 有据可查。'),
    description: t(
      'An npm toolkit for your AI. One reusable configuration checks saved records and failure paths, with browser evidence attached.',
      '给 AI 用的网站检查 npm 工具。一份可复用配置，验证保存记录与失败分支，返回关联的浏览器证据。',
    ),
    body:
      `<div class="home-actions"><a class="home-action-primary" href="#/docs/delivery-proof?section=start">${t('Try the example', '试用保存验收')}</a><a href="${import.meta.env.BASE_URL}delivery-proof/false-success/report.html">${t('View real report', '查看实际报告')}</a></div>` +
      h('comparison', 'What the comparison found', '实测对比：发现了哪些问题') +
      `<p class="home-study-scope">${t('Four deliberate save defects, tested on desktop and mobile.', '四种刻意植入的保存故障，分别在桌面与手机视口测试。')}</p>` +
      `<div class="home-comparison"><table aria-labelledby="comparison"><thead><tr><th scope="col">${t('Check used', '检查方式')}</th><th scope="col">${t('Fault cases caught', '拦截故障案例')}</th></tr></thead><tbody><tr><th scope="row">${t('Check only the “Saved” message', '仅检查“保存成功”提示')}</th><td>${faults - summary.uiOnlyFalsePasses} / ${faults}</td></tr><tr><th scope="row">${t('Complete Playwright tests', '完整 Playwright 测试')}</th><td>${faults - summary.playwrightFullFalsePasses} / ${faults}</td></tr><tr class="home-shiplens-row"><th scope="row">${t('ShipLens delivery contract', 'ShipLens 保存验收')}</th><td>${faults - summary.shiplensFalsePasses} / ${faults}</td></tr></tbody></table></div>` +
      `<p class="home-study-note">${t('One maintainer-controlled app, one run per viewport. Both complete approaches also passed the two healthy controls. This is not an AI-model benchmark.', '一个维护者自建应用，每个视口运行一轮。两种完整检查也都通过了两个正常对照；这不是 AI 模型能力测试。')} <a href="#/docs/delivery-proof?section=proof">${t('Read the method and raw results', '查看方法与原始结果')}</a></p>` +
      `<div class="home-advantage"><h3>${t('The advantage: a complete workflow, ready for your AI.', '优势：把完整检查流程交给 AI 直接调用。')}</h3><p>${t('A reusable configuration connects the action, API readback and failure trial. One MCP or API call runs the contract and saves linked evidence. Complete Playwright tests can catch the same faults; ShipLens packages this specific workflow for reuse.', '一份可复用配置关联页面操作、API 回读和失败测试；一次 MCP 或 API 调用执行验收并保存关联证据。完整 Playwright 测试也能发现这些故障，ShipLens 将这套特定流程做成了可直接复用的工具。')}</p></div>` +
      h('checks', 'What you can check', '你可以用它检查什么') +
      `<div class="reading-paths home-capabilities">${[
        [
          'delivery-proof',
          'Did the save create the right record?',
          '保存后，记录真的正确创建了吗？',
          'Correlate a new record with this action, detect missing or duplicate writes, and check error UI after HTTP 503.',
          '关联本轮新增记录，发现未写入、重复记录，以及 HTTP 503 后错误的成功提示。',
        ],
        [
          'check-audit',
          'Would your checks miss a wrong value?',
          '页面数值错了，验收规则能发现吗？',
          'Try concrete counterexamples against passing text rules. See which wrong values a weak check still accepts.',
          '用具体反例挑战已通过的文本规则，找出仍被弱规则接受的错误值。',
        ],
        [
          'quickstart',
          'Does the page break in a browser?',
          '页面有没有报错、坏图或布局溢出？',
          'Inspect JavaScript errors, failed resources and horizontal overflow across desktop and mobile viewports.',
          '在桌面与手机视口检查 JavaScript 异常、失效资源、坏图和横向溢出。',
        ],
        [
          'portable-plans',
          'Did the fix satisfy the same requirements?',
          '修改之后，同一组要求通过了吗？',
          'Replay a saved acceptance plan, collect fresh evidence and keep incomplete or unreviewed results visible.',
          '重放保存的验收文件，采集新证据，并明确保留未完成、未评审的结果。',
        ],
      ]
        .map(
          ([id, en, zh, detail, detailZh]) =>
            `<a href="#/docs/${id}"><strong>${t(en, zh)}</strong><span>${t(detail, detailZh)}</span></a>`,
        )
        .join('')}</div>` +
      h(
        'example',
        'A “Saved” message after a failed request',
        '请求失败了，页面却仍显示“保存成功”',
      ) +
      p(
        'In the recorded example, the normal save succeeds. ShipLens then intercepts the next trial’s request as HTTP 503. The app still displays “Saved”, while independent readback finds no matching record. The delivery contract fails and keeps all three observations together.',
        '在已记录的示例中，正常保存可以通过。随后 ShipLens 将下一分支的请求拦截为 HTTP 503，应用却仍显示“Saved”，独立回读也未找到匹配记录。保存验收因此失败，并保留这三层观察结果。',
      ) +
      `<dl class="home-evidence"><div><dt>${t('Request result', '请求结果')}</dt><dd>HTTP 503</dd></div><div><dt>${t('Captured page text', '页面实际文本')}</dt><dd>Saved</dd></div><div><dt>${t('Matching API records', 'API 匹配记录')}</dt><dd>0</dd></div></dl>` +
      `<p><a href="${import.meta.env.BASE_URL}delivery-proof/false-success/report.html">${t('Inspect the screenshots and request evidence', '查看截图与请求证据')}</a></p>` +
      h('fit', 'Where it fits in your AI workflow', '怎么配合你现有的 AI 工作流') +
      p(
        'Your AI assistant interprets requirements and judges visual or semantic details. ShipLens runs configured checks, records what happened and repeats the case after a fix. Use MCP for assistant-driven work, the CLI for local or CI checks, and JavaScript/TypeScript for integration. No additional model API key is required.',
        'AI 助手理解需求、判断视觉和语义细节；ShipLens 执行配置的检查、记录实际结果，并在修复后重跑案例。助手工作流使用 MCP，本地与 CI 使用 CLI，程序集成使用 JavaScript / TypeScript。无需额外配置模型 API Key。',
      ) +
      p(
        'Save verification needs an editable correlation field and a same-origin JSON readback API; cookie sessions are supported. Run in an authorized test environment because successful trials can create records. Readback verifies the API’s result during the test, not database durability or every business rule. A URL scan alone does not run this save contract.',
        '保存验收需要可填写的关联字段和同源 JSON 回读 API，支持 Cookie 登录态。请在已授权的测试环境运行，成功分支可能创建记录。回读验证测试期间的 API 结果，不保证数据库持久化或所有业务正确性。仅扫描网址不会执行这份保存契约。',
      ) +
      `<p class="home-study-note">${t('The case study does not measure real-user setup time, token savings or market preference.', '该案例没有测量真实用户的接入时间、token 节省或市场偏好。')}</p>` +
      h('start', 'Try it on a working example', '从可运行示例开始') +
      `<div class="reading-paths">${[
        [
          'delivery-proof?section=start',
          'Run the save example',
          '运行保存验收示例',
          'Start the bundled app and run its delivery contract.',
          '启动包内应用，执行保存契约并查看报告。',
        ],
        [
          'mcp',
          'Connect your AI assistant',
          '连接你的 AI 助手',
          'Configure the MCP server and let your assistant read the evidence.',
          '配置 MCP 服务，让助手直接调用检查、读取证据。',
        ],
        [
          'quickstart',
          'Scan your own website',
          '检查你自己的网站',
          'Start with browser errors, resources and layout checks.',
          '先检查浏览器错误、资源和布局问题。',
        ],
      ]
        .map(
          ([id, en, zh, detail, detailZh]) =>
            `<a href="#/docs/${id}"><strong>${t(en, zh)}</strong><span>${t(detail, detailZh)}</span></a>`,
        )
        .join('')}</div>` +
      `<div class="reading-meta"><span>Node.js 22.12+</span><span>JavaScript / TypeScript</span><span>MIT</span></div>`,
  };
}
