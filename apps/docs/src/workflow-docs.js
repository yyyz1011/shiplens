import { t } from './i18n.js';
import { code, p, h, note, table } from './markup.js';
import demoConfig from '../../../packages/cli/examples/flows.json';
export function interactionDocs() {
  return {
    id: 'flows',
    source: 'workflow-docs.js',
    group: t('Checks & evidence', '检查与证据'),
    title: t('Interaction steps', '交互步骤'),
    description: t(
      'Check the states that appear after a click, input or form action.',
      '检查点击、输入或表单操作之后出现的页面状态。',
    ),
    body:
      h('first-flow', 'Your first flow', '第一个交互流程') +
      p(
        'Add flows to your JSON configuration or scan() options. Each flow has a unique name, an exact starting page and ordered steps. The page is automatically added to the explicit scan scope.',
        '在 JSON 配置或 scan() 参数中添加 flows。每个流程包含唯一名称、精确起始页面和有序步骤；起始页面自动加入指定扫描范围。',
      ) +
      code(
        JSON.stringify(
          {
            url: 'http://127.0.0.1:3000',
            crawl: false,
            flows: [
              {
                name: 'open-details',
                page: '/',
                steps: [
                  { action: 'click', selector: '#details' },
                  { action: 'expectText', selector: '#details-panel', value: 'itinerary' },
                ],
              },
            ],
          },
          null,
          2,
        ),
        'shiplens.config.json',
      ) +
      code('npx shiplens --config shiplens.config.json') +
      p(
        'This example targets the bundled demo. <a href="#/docs/examples">Start the demo and run it unchanged →</a>',
        '此例针对包内演示站。<a href="#/docs/examples">启动演示站即可原样运行 →</a>',
      ) +
      h('actions', 'Six supported actions', '六种操作') +
      table([
        [
          'click',
          'Click one element after browser actionability checks.',
          '等待元素可操作后点击。',
        ],
        [
          'fill',
          'Set an input or textarea to value (string); an empty string clears it.',
          '使用字符串 value 填写输入框，空字符串表示清空。',
        ],
        [
          'press',
          'Send key, such as Enter or Tab, to the selected element.',
          '向匹配元素发送 key，例如 Enter 或 Tab。',
        ],
        [
          'select',
          'Select a native select option by its string value.',
          '通过字符串 value 选择原生 select 选项。',
        ],
        [
          'waitFor',
          'Wait for state: visible (default) or hidden. Hidden also accepts a detached element.',
          '等待 state：visible（默认）或 hidden；元素已移除也满足 hidden。',
        ],
        [
          'expectText',
          'Wait for a visible element whose textContent contains value. Matching is case-sensitive and preserves whitespace.',
          '等待可见元素的 textContent 包含 value，区分大小写，保留空白字符。',
        ],
      ]) +
      p(
        'Every step requires action and selector. Prefer stable CSS selectors such as data-testid. Locators use Playwright syntax; an action matching multiple elements fails rather than choosing arbitrarily. Optional timeout is 1000–120000 ms and defaults to the scan timeout. Unknown action fields are rejected.',
        '每步必须包含 action 和 selector，推荐 data-testid 等稳定 CSS 选择器。定位器使用 Playwright 语法；操作匹配多个元素会失败，不会随意选一个。可选 timeout 为 1000–120000 毫秒，默认沿用扫描超时。未知操作字段会报错。',
      ) +
      h('isolation', 'Order, isolation and coverage', '顺序、隔离与覆盖') +
      p(
        'For each page and viewport, ShipLens first performs the normal page check, then runs each matching flow in a fresh browser context with the same imported storage state. Flows do not share changes to cookies, localStorage or the DOM. Each context runs readiness, observes the initial state, then performs its steps and observes after each one. Optional scrolling follows the steps.',
        '每个页面和视口先执行普通页面检查，再为每个匹配流程新建浏览器上下文，加载相同登录态。流程之间不共享 Cookie、localStorage 或 DOM 的修改。每个上下文先等待就绪、检查初始状态，再逐步操作并观察；可选滚动在步骤之后执行。',
      ) +
      p(
        'Up to 20 flows, each with 1–30 steps and a unique 1–80 character name. Flow pages must be same-origin, not excluded and fit within maxPages. Each flow runs in every selected viewport. With one page, two flows and both viewports, the report contains six checks.',
        '最多 20 个流程，每个包含 1–30 步，名称唯一且为 1–80 个字符。起始页面必须同源、未被排除，并能容纳在 maxPages 中。每个流程在全部选定视口执行：一个页面、两个流程、双视口会产生六次检查。',
      ) +
      h('results', 'Read step results', '阅读步骤结果') +
      p(
        'Find results in pages[].checks[].steps or the HTML Interaction results section. passed means the configured action/expectation completed; runtime or layout findings may still exist. A failed action or expectation produces interaction-failed and marks that check incomplete. Subsequent steps are skipped. Screenshot failure also makes the check incomplete.',
        '在 pages[].checks[].steps 或 HTML 的“交互结果”中查看结果。passed 只表示配置的操作或预期完成，仍可能存在运行时或布局问题。操作或预期失败会生成 interaction-failed，并标记检查未完成，后续步骤为 skipped。截图失败也会导致检查未完成。',
      ) +
      p(
        'Each executed step retains a viewport screenshot. Findings observed during a step include flow and step and link to that step’s evidence. Baseline comparability includes the flow configuration; changing a value, selector or step prevents absent findings being called resolved.',
        '每个已执行步骤保存视口截图。步骤中发现的问题附带 flow 和 step，并链接到对应证据。基线可比性包含流程配置；修改输入值、选择器或步骤后，不会将未观察到的问题标记为已解决。',
      ) +
      h('requests', 'Requests and sensitive inputs', '请求与敏感输入') +
      note(
        'Flows run only when explicitly configured. Request restrictions remain active: allow required first-party write endpoints with allowRequests and use test environments for data changes. New tabs, downloads and cross-origin journeys are not covered.',
        '仅执行显式配置的流程，请求限制仍然生效。所需同源写接口通过 allowRequests 放行，修改数据请使用测试环境。不覆盖新标签页、下载或跨域旅程。',
      ) +
      p(
        'Step values are omitted from saved configuration and failure messages; only a configuration fingerprint is retained. Password inputs and fill targets are masked in screenshots. Values may still be echoed elsewhere by your application or logs, so add mask selectors for those locations. This is not full content sanitization.',
        '保存的配置和步骤失败说明不包含 value，仅保留配置指纹。密码输入框和 fill 目标会在截图中遮盖。但应用可能在其他位置或日志中回显输入，请为这些位置添加 mask；这不是完整内容脱敏。',
      ),
  };
}
export function ignoreDocs() {
  return {
    id: 'ignores',
    source: 'workflow-docs.js',
    group: t('Checks & evidence', '检查与证据'),
    title: t('Precise ignores', '精确忽略'),
    description: t(
      'Keep known issues visible without failing every run.',
      '保留已知问题记录，避免每次运行都被同一问题阻塞。',
    ),
    body:
      h('configure', 'Add an ignore entry', '添加忽略条目') +
      code(
        JSON.stringify(
          {
            ignore: [
              {
                rule: 'console-error',
                page: '/',
                messageIncludes: 'Demo known diagnostic',
                reason: 'Known diagnostic from the synthetic demo',
                expires: '2099-01-01',
              },
            ],
          },
          null,
          2,
        ),
        'Merge into shiplens.config.json',
      ) +
      p(
        'The date above is for the demo. Choose a real review deadline for your project. ignore works in JSON configuration and scan() options. It is applied after evidence collection, before summary counts, baseline comparison and CLI exit thresholds.',
        '上面的日期仅用于演示，请为项目设置实际复核期限。ignore 可用于 JSON 配置和 scan() 参数，在证据收集后、汇总计数、基线比较与退出码判断前生效。',
      ) +
      h('matching', 'Matching fields', '匹配字段') +
      table([
        [
          'rule',
          'Required rule code. Operational failures cannot be ignored.',
          '必填规则编码，不允许忽略运行失败。',
        ],
        [
          'reason',
          'Required nonempty explanation, retained in every report format.',
          '必填非空说明，保留在所有报告格式中。',
        ],
        [
          'page',
          'Exact starting-page URL, or path resolved against url. Includes query and hash route.',
          '精确起始页面 URL，或相对 url 解析的路径，包含查询参数与 hash 路由。',
        ],
        ['viewport', 'desktop or mobile; omitted means either.', 'desktop 或 mobile，省略则均可。'],
        [
          'selector',
          'Exact finding selector. An aggregated overflow finding only matches if every candidate has that selector.',
          '精确匹配问题选择器；聚合溢出问题只有全部候选均匹配时才忽略。',
        ],
        [
          'messageIncludes',
          'Case-sensitive substring of the recorded, redacted finding detail; not a regular expression.',
          '脱敏后问题 detail 的区分大小写子串，不是正则。',
        ],
        [
          'fingerprint',
          'Exact 16-character fingerprint from a finding.',
          '问题中的完整 16 字符指纹。',
        ],
        [
          'expires',
          'Optional YYYY-MM-DD, valid through the end of that UTC date. Omitted means no expiry.',
          '可选 YYYY-MM-DD，在该 UTC 日期结束前有效；省略表示不过期。',
        ],
      ]) +
      p(
        'At least one match field (page, viewport, selector, messageIncludes or fingerprint) is required. All supplied fields must match. The first active matching entry wins. Maximum 200 entries; dates and unknown fields are validated before a browser opens.',
        '至少提供一个匹配字段（page、viewport、selector、messageIncludes 或 fingerprint），所提供字段必须全部匹配。采用第一个有效命中条目，最多 200 条；启动浏览器前校验日期和未知字段。',
      ) +
      h('audit', 'Ignored is not resolved', '忽略不等于修复') +
      p(
        'Active findings remain in findings. Matched observations move to suppressed, retain screenshots and gain suppression.index (1-based), reason and optional expires. summary.suppressed records their count. They do not contribute to errors, warnings or the exit threshold. HTML and Markdown include a separate suppressed-issues section.',
        '活动问题保留在 findings。命中问题移至 suppressed，保留截图，并附带 suppression.index（从 1 开始）、reason 和可选 expires。summary.suppressed 为命中数量；不计入错误、提醒与失败阈值。HTML 和 Markdown 单独展示忽略记录。',
      ) +
      p(
        'Expired entries stop suppressing findings and appear in ignoreWarnings. Adding, changing, removing or expiring an ignore entry makes the previous baseline scope non-comparable. navigation-failed, screenshot-failed and interaction-failed cannot be ignored.',
        '过期条目不再忽略问题，并在 ignoreWarnings 中提示。新增、修改、删除或到期都会使旧基线范围不可比。navigation-failed、screenshot-failed、interaction-failed 均不可忽略。',
      ) +
      h('existing', 'Existing broad exclusions', '已有范围排除') +
      p(
        'ignoreRules still disables an entire non-operational rule before collection, so there is no retained suppressed evidence for it. data-shiplens-ignore still excludes intentional overflow elements. Use precise ignore entries when you need an auditable exception for one known issue.',
        'ignoreRules 仍会在采集前关闭整个非运行失败规则，因此不会保留对应 suppressed 证据。data-shiplens-ignore 仍用于排除预期溢出元素。需要可追踪的单个问题例外时，请使用精确 ignore。',
      ),
  };
}
export function exampleDocs() {
  return {
    id: 'examples',
    source: 'workflow-docs.js',
    group: t('Integrations', '集成'),
    title: t('Runnable examples', '可运行案例'),
    description: t(
      'Use the included local application to try the API and interaction checks.',
      '使用包内本地演示站，实际运行 API 与交互检查。',
    ),
    body:
      p(
        `<a href="${import.meta.env.BASE_URL}interaction-example/index.html" target="_blank" rel="noopener">Open a real generated interaction report →</a>`,
        `<a href="${import.meta.env.BASE_URL}interaction-example/index.html" target="_blank" rel="noopener">查看实际生成的交互报告 →</a>`,
      ) +
      h('setup', 'Start the included demo', '启动包内演示站') +
      code(
        'npm install --save-dev --save-exact shiplens\nnpx shiplens browsers\nnode node_modules/shiplens/examples/server.mjs',
      ) +
      p(
        'Keep this terminal running. The synthetic site listens at http://127.0.0.1:3000. Use a second terminal for the following commands. If the port is occupied, stop the conflicting demo or set PORT and update url in your copied config.',
        '保持此终端运行，演示站监听 http://127.0.0.1:3000。在另一个终端执行后续命令。如端口占用，请停止冲突的演示进程，或设置 PORT 并更新复制配置中的 url。',
      ) +
      h('working', 'Search, select and open details', '搜索、选择与展开详情') +
      code('npx shiplens --config node_modules/shiplens/examples/flows.json --output .shiplens') +
      p(
        'Expected: zero errors and complete checks, with a normal check plus one nine-step flow in each viewport (four checks). The CLI output override keeps reports in your project; relative output paths in JSON otherwise resolve beside that JSON file.',
        '预期结果：零错误且检查完成，每个视口包含一次普通检查和一个九步流程，共四次检查。命令行 output 覆盖确保报告保存在你的项目中；否则 JSON 内相对输出路径从 JSON 目录解析。',
      ) +
      code(JSON.stringify(demoConfig, null, 2), 'examples/flows.json') +
      h('failure', 'Reproduce an interaction-only bug', '复现仅操作后出现的问题') +
      p(
        'Save this as broken-flow.json and run the command below. The initial page is healthy, but the configured click triggers an error. The text expectation then fails and the last click is skipped. Expected exit code: 1.',
        '保存为 broken-flow.json 并执行下面命令。初始页面正常，配置的点击会触发异常；随后文字预期失败，最后一个点击不执行。预期退出码为 1。',
      ) +
      code(
        JSON.stringify(
          {
            url: 'http://127.0.0.1:3000',
            crawl: false,
            scroll: false,
            viewport: 'desktop',
            timeout: 1000,
            flows: [
              {
                name: 'broken-button',
                page: '/',
                steps: [
                  { action: 'click', selector: '#broken' },
                  { action: 'expectText', selector: '#result', value: 'Saved' },
                  { action: 'click', selector: '#details' },
                ],
              },
            ],
          },
          null,
          2,
        ),
        'broken-flow.json',
      ) +
      code('npx shiplens --config broken-flow.json') +
      h('known', 'Try a precise ignore', '体验精确忽略') +
      code(
        JSON.stringify(
          {
            url: 'http://127.0.0.1:3000',
            crawl: false,
            viewport: 'desktop',
            flows: [
              {
                name: 'known-diagnostic',
                page: '/',
                steps: [{ action: 'click', selector: '#known' }],
              },
            ],
            ignore: [
              {
                rule: 'console-error',
                page: '/',
                messageIncludes: 'Demo known diagnostic',
                reason: 'Known synthetic diagnostic',
                expires: '2099-01-01',
              },
            ],
          },
          null,
          2,
        ),
        'known-issue.json',
      ) +
      code('npx shiplens --config known-issue.json --fail-on warning') +
      p(
        'Expected: one suppressed observation and no active warnings. Change expires to 2000-01-01 and rerun: the warning becomes active, ignoreWarnings explains the expiry and --fail-on warning exits with 1.',
        '预期：一条忽略记录，没有活动提醒。将 expires 改为 2000-01-01 再运行，提醒恢复，ignoreWarnings 解释到期原因，--fail-on warning 返回 1。',
      ) +
      h('api-example', 'Run all three API exports', '运行三个公开 API') +
      code('node node_modules/shiplens/examples/api.mjs') +
      p(
        'The included ESM script calls validateOptions(), runs scan() twice and compares fingerprints with compareBaseline(). It also loads the first saved report as a baseline so you can inspect the coverage-aware comparison. <a href="#/docs/api">Read signatures and return fields →</a>',
        '包内 ESM 脚本调用 validateOptions()，执行两次 scan()，再通过 compareBaseline() 比较指纹；同时将第一次保存的报告作为基线，以查看含覆盖检查的比较结果。<a href="#/docs/api">查看签名和返回字段 →</a>',
      ),
  };
}
