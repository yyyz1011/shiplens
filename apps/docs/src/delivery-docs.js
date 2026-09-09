import { t } from './i18n.js';
import { code, p, h, note, table } from './markup.js';
import contract from '../../../packages/cli/examples/delivery.json';

export function deliveryDocs() {
  return {
    id: 'delivery-proof',
    source: 'delivery-docs.js',
    group: t('AI review', 'AI 验收'),
    title: t('Did the save actually work?', '页面说保存成功，记录真的有了吗？'),
    description: t(
      'Connect browser feedback to an independent API readback, then exercise the failure path. A reusable delivery contract for your AI assistant, available in 0.8.0.',
      '把页面反馈与独立接口回读关联起来，再主动验证失败分支。给 AI 助手使用的可复用保存契约，0.8.0 起提供。',
    ),
    body:
      h('why', 'Follow the record, not just the message', '沿着本轮记录验证保存结果') +
      p(
        'A success banner can appear when a request was never sent, a record was lost, or a duplicate was created. ShipLens generates a unique reference for each trial, fills it into the form, verifies an authorized mutation and independently reads the matching record through a JSON API. It then starts a fresh browser context, injects HTTP 503 and checks the error UI and absence of that trial’s record.',
        '页面可能在请求没发出、记录没写入或重复创建时依然显示成功。ShipLens 为每个分支生成唯一标记并填入表单，验证已授权的写入请求，再通过独立 JSON API 读取对应记录。之后使用新浏览器上下文注入 HTTP 503，检查错误提示以及该分支的记录是否不存在。',
      ) +
      table(
        [
          [
            t('Before the action', '操作前'),
            'The independent readback must contain zero records matching the generated reference. Old records cannot satisfy this precondition.',
            '独立回读中必须没有匹配本轮标记的记录，旧记录不能满足该前置条件。',
          ],
          [
            t('Successful action', '成功分支'),
            'Exactly one matching mutation completes with a 2xx response, configured visible text passes, and exactly one matching API record has the expected scalar fields.',
            '恰好一个匹配的写入请求以 2xx 完成，配置的可见文本通过，且接口中恰好一条匹配记录的字段符合预期。',
          ],
          [
            t('Injected failure', '注入失败'),
            'The matching request is intercepted as HTTP 503. Error text must pass, the success state must not pass, and no matching record may appear. An unexercised fault cannot pass.',
            '匹配请求被拦截为 HTTP 503。错误提示必须通过，成功状态不能通过，且不能出现匹配记录。没有实际触发注入请求，不算通过。',
          ],
        ],
        [t('Stage', '阶段'), t('Required evidence', '所需证据')],
      ) +
      note(
        'Use an authorized test environment. Each successful viewport trial can create a real test record; the tool does not delete it. Readback proves the configured API projection, not database durability, payment settlement or unrelated business correctness. No extra model API key is used.',
        '在已授权的测试环境运行。每个视口的成功分支都可能创建真实测试记录，工具不会自动删除。回读证明的是配置 API 返回的结果，不是数据库持久化保证、支付结算或其他业务正确性。无需额外配置模型 API Key。',
      ) +
      h('start', 'Try the file-backed example', '试用带文件存储的示例') +
      code(
        'npm install --save-dev --save-exact shiplens@0.8.0\nnpx shiplens browsers\nnode node_modules/shiplens/examples/delivery-server.mjs',
      ) +
      p(
        'The example runs at http://127.0.0.1:3001 and stores disposable records in .shiplens/delivery-demo-data/records.json. In a second terminal, run the packaged contract. The example API script prints JSON; report is relative to the configured review workspace directory.',
        '示例运行在 http://127.0.0.1:3001，临时测试记录保存在 .shiplens/delivery-demo-data/records.json。在第二个终端执行包内契约。示例 API 脚本输出 JSON，report 路径相对于配置的 review 工作区目录。',
      ) +
      code('node node_modules/shiplens/examples/delivery.mjs') +
      p(
        'For CLI use, create this host configuration. The exact write endpoint must be allowed by the host before a contract can run. Other mutation endpoints are blocked during a delivery trial even if a broader scan configuration allows them. This contract supports a single mutation operation, with setup authentication supplied through storageState when needed.',
        '使用 CLI 时，先创建下面的主机配置。运行前必须由主机允许精确的写入端点。保存分支会阻止其他写入端点，即使普通扫描配置允许它们。本契约覆盖一次写入操作，需要登录时通过 storageState 提供事先准备的登录态。',
      ) +
      code(
        JSON.stringify(
          {
            url: 'http://127.0.0.1:3001',
            viewport: 'both',
            crawl: false,
            settle: 0,
            timeout: 3000,
            output: '.shiplens',
            allowRequests: [{ method: 'POST', path: '/api/records' }],
          },
          null,
          2,
        ),
        'shiplens.config.json',
      ) +
      code(
        'npx shiplens review delivery --config shiplens.config.json --plan node_modules/shiplens/examples/delivery.json',
      ) +
      h('contract', 'Keep the contract with your project', '将保存契约放入项目') +
      p(
        'Copy the example and replace selectors, endpoint paths, readback pointers and expectations from your application specification. The app must submit the generated referenceInput field and return it in its readback records. If your app cannot correlate a submitted marker with a readable record, this contract cannot establish the relationship for you.',
        '复制示例，并按照应用需求替换选择器、接口路径、回读指针和预期值。应用必须提交 referenceInput 对应的标记字段，并在回读记录中返回它。如果应用无法将提交标记与可读取的记录关联，本契约无法替你建立这个关系。',
      ) +
      code(JSON.stringify(contract, null, 2), 'delivery.json') +
      table([
        [
          'schemaVersion / kind / name',
          'Use 1 / shiplens-delivery / a 1–120 character name. This is a delivery contract, distinct from a shiplens-case acceptance plan. Maximum serialized contract size: 64 KiB.',
          '分别为 1 / shiplens-delivery / 1–120 字符名称。这是保存契约，与 shiplens-case 验收文件不同。序列化契约最大 64 KiB。',
        ],
        [
          'page',
          'A non-secret relative page on the configured origin, outside host exclusions. Explicit actions must stay within that origin and exclusions.',
          '配置域名下无敏感信息的相对页面路径，不能被主机排除。显式操作的导航仍受同源和排除规则限制。',
        ],
        [
          'referenceInput',
          'Names one fill step’s valueFromInput. ShipLens generates a fresh UUID per viewport and success/failure trial. Do not provide this key in runtime inputs.',
          '指定某个 fill 步骤的 valueFromInput。每个视口、每个成功/失败分支生成新的 UUID；运行输入不能传入此键。',
        ],
        [
          'steps',
          '1–30 existing click/fill/press/select/waitFor/expectText steps. Every fill uses a unique valueFromInput and no raw value. Supply exactly all other named string inputs, up to 10,000 characters each.',
          '1–30 个已有 click/fill/press/select/waitFor/expectText 步骤。每个 fill 使用唯一 valueFromInput，不能保存原始 value。其余命名输入在运行时完整提供，每项字符串最长 10,000 字符。',
        ],
        [
          'request',
          'POST, PUT or PATCH with an exact same-origin pathname. No query/hash in the configured path. Only this mutation is allowed in the trial; exactly one request is expected.',
          'POST、PUT 或 PATCH，配合同源精确 pathname；配置路径不能带 query/hash。分支只允许这项写入，并要求恰好一次请求。',
        ],
        [
          'readback.path / queryKey',
          'Same-origin GET endpoint; optional queryKey adds the generated UUID as a query value. Readback runs outside app JavaScript, uses matching browser cookies including HttpOnly, requests no-cache and does not follow redirects. Application-added bearer headers are not copied.',
          '同源 GET 端点；可选 queryKey 将本轮 UUID 加为查询参数。回读在应用 JavaScript 之外执行，使用匹配的浏览器 Cookie（包括 HttpOnly），请求不使用缓存且不跟随重定向。不复制应用自行添加的 bearer 请求头。',
        ],
        [
          'readback.items / reference',
          'JSON Pointers selecting the returned record array and each record’s reference field. Reference matching is exact string equality. HTTP 200 and JSON content type required; at most 1 MiB response body and 10,000 array items.',
          'JSON Pointer 分别选取返回的记录数组及每条记录的标记字段，使用字符串精确相等匹配。要求 HTTP 200 和 JSON Content-Type；响应体最多 1 MiB，数组最多 10,000 项。',
        ],
        [
          'readback.checks',
          '1–10 { pointer, equals } checks evaluated on the unique matching record. equals is a JSON scalar: string (up to 2,000 characters), finite number, boolean or null. JSON Pointers support the empty root, ~0 and ~1. No scripts or inferred schemas.',
          '对唯一匹配记录执行 1–10 项 { pointer, equals } 检查。equals 为 JSON 标量：最多 2,000 字符的字符串、有限数字、布尔或 null。JSON Pointer 支持空根指针、~0 和 ~1，不执行脚本或推断数据结构。',
        ],
        [
          'success / failure',
          'Each has one visible selector and 1–10 text checks; at least one equals/contains check is required. Text follows the existing visible, unmasked, whitespace-normalized, case-sensitive semantics. Failure success-state checks use the success selector separately.',
          '各包含一个可见选择器与 1–10 条文本规则，至少有一条 equals/contains。沿用可见、未遮罩、规范空白、区分大小写的语义。在失败分支中，会另外使用 success 选择器检查是否仍显示成功。',
        ],
      ]) +
      h(
        'api',
        'verifyDelivery({ contract, inputs? }, runtime?)',
        'verifyDelivery({ contract, inputs? }, runtime?)',
      ) +
      code(
        "import { readFile } from 'node:fs/promises';\nimport { ReviewWorkspace } from 'shiplens/review';\nconst workspace = new ReviewWorkspace({\n  directory: '.shiplens/reviews',\n  options: {\n    url: 'http://127.0.0.1:3001', viewport: 'both',\n    timeout: 3000, settle: 0,\n    allowRequests: [{ method: 'POST', path: '/api/records' }],\n  },\n});\nconst contract = JSON.parse(await readFile('delivery.json', 'utf8'));\nconst result = await workspace.verifyDelivery({ contract, inputs: {} });\nconsole.log(result.passed, result.report);\nconst saved = await workspace.getDelivery({ deliveryId: result.deliveryId });\nfor (const trial of saved.trials) {\n  if (trial.evidence) {\n    const proof = await workspace.readDeliveryEvidence({\n      deliveryId: saved.deliveryId,\n      viewport: trial.viewport, phase: trial.phase,\n    });\n    // Inspect proof.image, proof.observation and proof.trial.\n  }\n}",
        'JavaScript',
      ) +
      p(
        'The optional runtime accepts signal, onProgress and timeoutMs (default 120,000; allowed 1,000–1,800,000). It shares the workspace writer lock and status/cancel controls. Per-operation waits use host timeout; successful readback polls up to that budget. Fault readback is a bounded snapshot, not a guarantee against later background writes. Host URL, viewport, storageState, masks, exclusions, timeout, settle and lang apply. Ordinary scan flows, crawl, scrolling, baselines and ignored findings are not executed by this specialized contract.',
        '可选 runtime 接受 signal、onProgress、timeoutMs，默认 120,000，范围 1,000–1,800,000 毫秒。与工作区共用写入锁及 status/cancel 控制。单项等待使用主机 timeout，成功回读在该预算内轮询。失败回读是有界快照，不能保证未来不会发生后台写入。主机 URL、viewport、storageState、mask、exclude、timeout、settle、lang 生效；该专用契约不执行普通扫描的 flows、爬取、滚动、基线或忽略规则。',
      ) +
      table(
        [
          [
            'verifyDelivery',
            'Returns DeliveryResult: deliveryId, passed, name, version, contractSha256, createdAt, trials, report and note. Two trials per viewport; a failed success baseline skips that viewport’s failure trial. Invalid contracts throw before browser execution. Execution/evidence problems block completion status; cancellation rejects and removes the unfinished delivery directory. Cancellation does not undo completed server writes.',
            '返回 DeliveryResult，含 deliveryId、passed、name、version、contractSha256、createdAt、trials、report、note。每个视口两个分支；成功基线失败时跳过该视口的注入分支。无效契约在浏览器执行前抛错。执行/证据问题阻断通过；取消会拒绝调用并移除未完成的保存验收目录。取消不会撤销已经完成的服务器写入。',
          ],
          [
            'getDelivery({ deliveryId })',
            'Reads the saved JSON snapshot without live requests. Delivery IDs do not belong to getRun/gate/listRuns; retain the ID returned by verifyDelivery. Files live in deliveries/&lt;deliveryId&gt; inside the review directory.',
            '读取保存的 JSON 快照，不发实时请求。deliveryId 不用于 getRun/gate/listRuns，请保留 verifyDelivery 返回的 ID。文件位于 review 目录内的 deliveries/&lt;deliveryId&gt;。',
          ],
          [
            'readDeliveryEvidence({ deliveryId, viewport, phase })',
            'Returns deliveryId, trial, observation, PNG image and warning. viewport is desktop/mobile; phase is success/failure. Missing or skipped captures throw; images are limited to 6 MiB and DOM files to 256 KiB. A fallback image may show the success component when the expected error component is missing; inspect trial.evidence.selector.',
            '返回 deliveryId、trial、observation、PNG image 和 warning。viewport 为 desktop/mobile，phase 为 success/failure。缺失或跳过的截图会报错；图片上限 6 MiB，DOM 文件上限 256 KiB。错误组件缺失时可返回成功组件作为回退证据，请查看 trial.evidence.selector。',
          ],
        ],
        [t('Method', '方法'), t('Result', '结果')],
      ) +
      h('result', 'Interpret the layers', '逐层理解结果') +
      p(
        'trials contains viewport, phase, generated reference, passed, status and reasons, plus network, before, after, ui and evidence when available. network records matching/completed response statuses, failed/blocked request counts and injected count. before/after report matching record count and only explicitly selected scalar fields; whole API responses and cookie headers are not saved. Selected strings are redacted and limited to 500 characters for display. Text and screenshots can still contain application echoes; use test data and masks.',
        'trials 包含 viewport、phase、生成的 reference、passed、status、reasons，以及可用时的 network、before、after、ui、evidence。network 记录匹配请求数量、响应状态、失败/阻止次数及注入次数。before/after 记录匹配数量和显式选取的标量字段，不保存完整 API 响应或 Cookie 请求头。展示字符串经过脱敏并限制为 500 字符。文本和截图仍可能包含应用回显，应使用测试数据和遮罩。',
      ) +
      table(
        [
          [
            'persisted-record-mismatch',
            'The API did not return exactly one matching record with the expected fields. A “Saved” message does not override this result.',
            'API 未返回恰好一条字段符合预期的匹配记录，“Saved” 提示不能覆盖此结果。',
          ],
          [
            'mutation-not-exercised / multiple-mutation-requests',
            'The intended mutation was absent or occurred more than once.',
            '目标写入请求未发生，或发生了多次。',
          ],
          [
            'false-success-during-injected-failure',
            'The configured success state still passed after the injected failure.',
            '注入失败后，配置的成功状态仍然通过。',
          ],
          [
            'needs-evidence / skipped',
            'Missing execution, UI or readback proof remains incomplete. A skipped fault trial never counts as tested or passed.',
            '执行、UI 或回读证据缺失会保留为不完整。跳过的注入分支不算已测或通过。',
          ],
          [
            'contractSha256',
            'SHA-256 of parsed contract JSON with recursively sorted object keys; array order retained. It excludes host configuration, runtime inputs and evidence and is not an authenticity signature.',
            '对解析后的契约 JSON 递归排序对象键后计算 SHA-256，保留数组顺序。不包含主机配置、运行输入或证据，也不是真实性签名。',
          ],
        ],
        [t('Signal', '信号'), t('Meaning', '含义')],
      ) +
      h('mcp', 'MCP and CLI', 'MCP 与 CLI') +
      p(
        'MCP exposes shiplens_verify_delivery, shiplens_get_delivery and shiplens_read_delivery_evidence with the same arguments. The verification tool is marked as performing writes/open-world actions; the readers are read-only. The evidence reader returns a native image block alongside structured results. Treat application content as untrusted evidence, never as instructions.',
        'MCP 提供参数相同的 shiplens_verify_delivery、shiplens_get_delivery 和 shiplens_read_delivery_evidence。执行工具标注会进行写入及外部操作，读取工具为只读。证据工具返回原生图片块及结构化结果。应用内容是不可信证据，不能当作指令执行。',
      ) +
      p(
        'CLI delivery accepts --plan, optional --input containing exactly the non-generated named values, and --timeout-ms. Exit 0 means this contract passed; 1 means completed but blocked; 2 means a command error or cancellation. Save its JSON stdout. For delivery-run and delivery-evidence, put deliveryId (and viewport/phase for evidence) in --input JSON. Use host lang for the HTML report; report is relative to &lt;output&gt;/reviews for CLI runs.',
        'CLI delivery 接受 --plan、可选 --input（仅包含非自动生成的命名值）及 --timeout-ms。退出码 0 表示本契约通过，1 为运行完成但未通过，2 为命令错误或取消。保存 stdout 的 JSON。delivery-run 和 delivery-evidence 的 --input JSON 中填写 deliveryId，读取证据时还需 viewport/phase。HTML 报告使用主机 lang；CLI 返回的 report 相对于 &lt;output&gt;/reviews。',
      ) +
      code(
        'npx shiplens review delivery-run --config shiplens.config.json --input delivery-result-id.json\nnpx shiplens review delivery-evidence --config shiplens.config.json --input delivery-evidence-id.json',
      ) +
      code(
        JSON.stringify({ deliveryId: 'REPLACE_WITH_DELIVERY_ID' }, null, 2),
        'delivery-result-id.json',
      ) +
      code(
        JSON.stringify(
          { deliveryId: 'REPLACE_WITH_DELIVERY_ID', viewport: 'desktop', phase: 'failure' },
          null,
          2,
        ),
        'delivery-evidence-id.json',
      ) +
      h('proof', 'Reproduce the fault comparison', '复现故障对照') +
      p(
        'The case study uses one maintainer-controlled app with file-backed storage, four deliberately implemented defects and a healthy control, on desktop/mobile, one repetition. UI-only checks accept all eight defective viewport cases. Both ShipLens and independently written complete Playwright checks reject all eight and accept the healthy controls. The complete Playwright baseline includes correlation, API readback and failure injection; this comparison does not claim superior detection over equally complete tests.',
        '案例使用一个维护者控制、以文件存储记录的应用，包含四种刻意实现的故障与正常对照，在桌面/手机各运行一轮。仅检查成功提示会放过全部八个故障视口案例；ShipLens 和独立编写的完整 Playwright 检查都能拦截八个故障，并通过正常对照。完整 Playwright 对照同样包含标记关联、API 回读和失败注入，本结果不声称检测优于同样完整的测试。',
      ) +
      table(
        [
          [
            t('Lost write', '未写入'),
            'API reports success but omits the file write; readback has zero matching records.',
            'API 返回成功，但没有写入文件；回读为零条匹配记录。',
          ],
          [
            t('Duplicate record', '重复记录'),
            'One request writes two matching records; the exact-one condition fails.',
            '一个请求写入两条匹配记录，不满足恰好一条。',
          ],
          [
            t('False success on failure', '失败后仍报成功'),
            'The app renders Saved even after HTTP 503; the fault trial exposes it.',
            '应用在 HTTP 503 后仍显示 Saved，由注入分支发现。',
          ],
          [
            t('No mutation', '没有写入请求'),
            'The app renders Saved without sending the request; request coverage and readback fail.',
            '应用未发请求便显示 Saved，请求覆盖和回读都不满足要求。',
          ],
        ],
        [t('Deliberate defect', '刻意植入的故障'), t('Observed mechanism', '观察到的机制')],
      ) +
      p(
        `<a href="${import.meta.env.BASE_URL}delivery-proof/results.json">Download raw results and the 33-artifact checksum manifest</a> · <a href="${import.meta.env.BASE_URL}delivery-proof/false-success/report.html">Read the false-success report</a> · <a href="${import.meta.env.BASE_URL}delivery-proof/healthy/report.html">Read the healthy control</a>. Artifact paths are relative to delivery-proof/.`,
        `<a href="${import.meta.env.BASE_URL}delivery-proof/results.json">下载原始结果与 33 份产物校验清单</a> · <a href="${import.meta.env.BASE_URL}delivery-proof/false-success/report.html">查看假成功报告</a> · <a href="${import.meta.env.BASE_URL}delivery-proof/healthy/report.html">查看正常对照</a>。产物路径相对于 delivery-proof/。`,
      ) +
      code('npm ci\nnpm run browsers\nnpm run benchmark:delivery') +
      p(
        'The reusable contract and linked evidence remove the need to assemble this particular workflow from scratch. <a href="https://playwright.dev/docs/api-testing">Playwright already supports server postcondition checks</a> and <a href="https://playwright.dev/docs/mock">network mocking</a>. This study measures no AI reasoning, setup time, token costs, customer outcomes or market preference. It does not cover arbitrary authentication, multi-service transactions, permissions or database internals.',
        '可复用契约与关联证据使用户无需从头拼装这一特定流程。<a href="https://playwright.dev/docs/api-testing">Playwright 已支持服务器结果检查</a>和<a href="https://playwright.dev/docs/mock">网络模拟</a>。本实验没有测量 AI 推理、接入时间、token 成本、客户效果或市场偏好，也不覆盖任意登录方式、多服务事务、权限或数据库内部状态。',
      ),
  };
}
