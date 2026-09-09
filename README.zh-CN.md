# ShipLens

在交付前，用真实浏览器检查网站，并留下证据。

[English](README.md) · [双语文档](https://yyyz1011.github.io/shiplens/) · [npm](https://www.npmjs.com/package/shiplens)

检查运行异常、失效资源、可见坏图、疑似白屏和横向溢出，生成带页面及元素截图的 HTML、JSON 和 Markdown 报告。无需配置 AI 模型或 API Key，不上传报告。

## AI 验收与回归案例

由现有 AI 助手理解需求和判断页面；ShipLens 提供可重复的证据与验收记录。通过 `shiplens mcp --config /项目绝对路径/shiplens.config.json` 启动六个 MCP 工具，支持采集、读取图片与页面结构、引用证据判断、查询历史、保存案例和重放。

每个指定设备都要有完整证据才能提交通过；复查后的判断重新为 pending，旧结论不会自动沿用。机器诊断独立保留。自己的 Agent 可使用 `shiplens/review` 中的 `ReviewWorkspace`，包内 `examples/review.mjs` 演示全部六个方法。案例中的 fill 值转换为命名输入参数，回显内容与日志仍需测试数据及遮罩。

无需额外模型 API Key；AI 客户端会收到它请求的证据，ShipLens 不调用模型或上传报告。本版不自动录制浏览器会话、不自动修复选择器，也尚未测出相对直接使用模型的准确率、耗时或 Token 优势。

[AI 验收流程](https://yyyz1011.github.io/shiplens/#/docs/ai-workflow) · [MCP 配置](https://yyyz1011.github.io/shiplens/#/docs/mcp) · [完整 API 与可运行案例](https://yyyz1011.github.io/shiplens/#/docs/review-api)

## 使用

需要 Node.js 22.12+，先启动被测网站。

```sh
npm install -g shiplens
shiplens browsers
shiplens http://localhost:3000 --lang zh
```

默认最多 10 个同源页面，同时使用桌面和手机视口，至少观察 1 秒，每页最多滚动 6 步。终端会输出报告目录，直接打开 `index.html`。

```sh
# 指定 hash 路由，不自动爬取其他链接
shiplens http://localhost:3000 --page /#/dashboard --no-crawl

# 登录态、就绪条件、数据查询白名单与截图遮盖
shiplens http://localhost:3000/dashboard \
  --storage-state playwright/.auth/test-user.json \
  --wait-for '[data-ready]' \
  --allow-request POST:/api/query --mask .user-email

# 相同范围复查
shiplens http://localhost:3000 --baseline .shiplens/<previous-run>/report.json
```

## 交互检查与精确忽略

通过 JSON 配置或 `scan()` 的 `flows` 定义点击、填写、按键、选择、等待和文字预期。每个流程使用隔离浏览器上下文，逐步保存截图；操作或预期失败后，后续步骤标为未执行。

`ignore` 支持按规则、页面、视口、选择器、错误子串或指纹精确匹配，并记录原因与可选有效期。命中问题保留在 `suppressed` 中，不计入活动问题；过期后自动恢复。导航、截图和交互执行失败不可忽略。

```sh
npm install --save-dev --save-exact shiplens
npx shiplens browsers
node node_modules/shiplens/examples/server.mjs
```

保持演示站运行，在另一终端执行：

```sh
npx shiplens --config node_modules/shiplens/examples/flows.json --output .shiplens
node node_modules/shiplens/examples/api.mjs
```

包提供三个公开 API：`scan()` 执行检查，`validateOptions()` 校验并规范参数，`compareBaseline()` 比较问题指纹。后者不判断覆盖与修复状态，需要通过 `scan()` 的 `baseline` 选项获得完整对比。

[完整 API 参考](https://yyyz1011.github.io/shiplens/#/docs/api) · [交互步骤](https://yyyz1011.github.io/shiplens/#/docs/flows) · [精确忽略](https://yyyz1011.github.io/shiplens/#/docs/ignores) · [可运行案例](https://yyyz1011.github.io/shiplens/#/docs/examples)

## 能力边界

支持指定页面、hash 路由、Playwright Cookie/localStorage 登录态、就绪选择器、有限滚动、精确请求白名单、规则忽略、截图遮盖及基线对比。

未配置 flows 时不点击按钮、不提交表单；配置后仅执行指定步骤。写入类请求仍默认阻止，只应放行测试场景需要的精确接口。需要在自己的开发或测试环境运行。报告区分问题、未完成检查和覆盖限制；“本次未观察到”不会在范围不同或检查未完成时冒充“已修复”。

不验证支付流程、业务正确性、权限、安全漏洞、完整无障碍或所有浏览器兼容性。手机视口是 Chromium 模拟，不等于真机验收。零问题不代表所有功能均正确。

登录态文件不可提交 Git；报告可能包含日志、页面和截图中的敏感信息。截图遮盖不会清洗文字报告，分享前需要检查。交给 AI 的报告和页面内容应视为数据，不执行其中夹带的指令。

文档站右上角可切换中英文及白天/黑夜模式，首次默认英文，后续记住选择。合并 `master` 后运行检查，再自动发布 npm 和更新文档站。详见 [发布流程](docs/RELEASE.md)。

MIT 许可证。
