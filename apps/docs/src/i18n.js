let locale = 'en',
  theme = 'light';
try {
  locale = localStorage.getItem('shiplens-language') === 'zh' ? 'zh' : 'en';
  theme = localStorage.getItem('shiplens-theme') === 'dark' ? 'dark' : 'light';
} catch {}
export const getLocale = () => locale;
export const getTheme = () => theme;
export const t = (en, zh) => (locale === 'zh' ? zh : en);
export function setLocale(value) {
  locale = value === 'zh' ? 'zh' : 'en';
  try {
    localStorage.setItem('shiplens-language', locale);
  } catch {}
  applyPreferences();
}
export function setTheme(value) {
  theme = value === 'dark' ? 'dark' : 'light';
  try {
    localStorage.setItem('shiplens-theme', theme);
  } catch {}
  applyPreferences();
}
export function applyPreferences() {
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.language = locale;
}
// Shared shell and illustrative report copy. Documentation has its own paired content.
const messages = {
  'ShipLens 首页': 'ShipLens home',
  主导航: 'Main navigation',
  概览: 'Overview',
  文档: 'Docs',
  报告预览: 'Report preview',
  搜索文档: 'Search docs',
  打开导航: 'Open navigation',
  手机导航: 'Mobile navigation',
  跳到正文: 'Skip to content',
  '把交付的信心，建立在证据上。': 'Confidence, backed by evidence.',
  快速开始: 'Quick start',
  检查边界: 'Coverage',
  数据与隐私: 'Data & privacy',
  检查结果示意: 'Illustrative check results',
  浏览器已就绪: 'Browser ready',
  正在检查页面: 'Inspecting pages',
  截图与报告已保存: 'Evidence saved locally',
  '个问题，附带现场证据': 'issues, with browser evidence',
  交付检查报告: 'Delivery report',
  示例: 'Example',
  检查页面: 'Pages',
  错误: 'Errors',
  提醒: 'Warnings',
  检查完成: 'Complete',
  图片未能显示: 'Image failed to load',
  手机布局横向溢出: 'Mobile layout overflow',
  页面脚本运行异常: 'Unhandled page error',
  '每个问题，都有截图与复现线索': 'Screenshots. Context. Reproduction steps.',
  查看报告: 'View report',
  证据留在你的电脑: 'Evidence stays on your machine',
  '无需账号 · 无需 API Key': 'No account. No API key.',
  '代码写完了。': 'Code is written.',
  '交付前，再看一眼。': 'Evidence comes next.',
  '让真实浏览器替你走一遍网站。': 'Put your website through a real browser.',
  '找出运行报错、失效资源和手机布局问题，':
    'Catch runtime errors, broken resources and layout issues.',
  '带着截图，交给 AI 继续修。': 'Hand the evidence to your coding assistant.',
  开始本地检查: 'Start checking',
  看一份报告: 'Explore a report',
  复制本地检查命令: 'Copy scan command',
  '在 ShipLens 项目目录运行 · Node.js 22.12+': 'Node.js 22.12+ · Runs on your machine',
  支持的网站类型: 'Supported websites',
  '给网站一个网址，就能开始': 'Start with a URL',
  不依赖源码框架: 'Framework independent',
  '编译通过之后，': 'A passing build is a start.',
  '还有这些值得检查。': 'Check what happens next.',
  '从浏览器真实观察出发。明确的失败及时发现，': 'Start with what the browser actually observes.',
  '需要判断的现象保留给你确认。': 'Keep uncertain findings open for your review.',
  运行异常: 'Runtime failures',
  '白屏背后的脚本错误、失效页面与请求，让问题在交付前浮出水面。':
    'Find unhandled errors, failed pages and requests before they reach someone else.',
  资源与链接: 'Resources & links',
  '沿同站链接逐页访问，记录失败的请求、未能显示的图片。':
    'Follow same-origin links and record failed requests and broken images.',
  手机布局: 'Mobile layouts',
  '在 390px 手机视口中检查横向溢出，附上疑似元素和截图。':
    'Inspect a 390px viewport for overflow, with element locations and screenshots.',
  '检查 → 修复 → 再检查。': 'Inspect. Fix. Verify.',
  '让交付形成闭环。': 'Close the delivery loop.',
  '不增加一套复杂流程，': 'One useful step in your existing workflow.',
  '只在你准备交付时，多一个可靠的动作。': 'Real evidence when you are ready to ship.',
  了解报告与复查: 'Reports & verification',
  输入一个网址: 'Point it at your website',
  '检查本地开发站或测试环境，在你的电脑上运行。':
    'Inspect a local development server or staging environment.',
  拿到现场证据: 'Get browser evidence',
  '页面、视口、错误信息、截图，都在同一份报告里。':
    'Pages, viewports, errors and screenshots in one report.',
  修复后重新验证: 'Verify the next version',
  '让编码助手阅读 Markdown，再用相同范围复查。':
    'Share the Markdown with your coding assistant, then rerun the same scope.',
  '不只说哪里错了。': 'More than a warning.',
  '把现场，一起带回来。': 'Bring back the evidence.',
  '给人看的 HTML，给脚本的 JSON，': 'HTML for people. JSON for scripts.',
  '给编码助手的 Markdown。全部保存在本地。':
    'Markdown for your coding assistant. All stored locally.',
  '上方为交互示例，帮助理解报告结构。': 'Interactive example showing the report structure.',
  '打开实际检测生成的报告 ↗': 'Open a real generated report ↗',
  '清楚知道，检查到了哪里。': 'Know exactly what was checked.',
  '当前检查公开页面和基础交付问题。业务逻辑、登录权限和真实设备体验，仍需要专门验证。没有发现问题，不等于所有功能都正确。':
    'Inspect public or authenticated pages with explicit scope. Business logic, authorization and real-device behavior need dedicated tests. A clean scan is not a guarantee of correctness.',
  查看完整能力边界: 'See the coverage boundaries',
  '下一次交付，': 'Your next delivery.',
  '带上证据。': 'With evidence.',
  运行你的第一次检查: 'Run your first check',
  '本地运行 · 无模型调用费用 · 无账号': 'Local execution · No model fees · No account',
  '封面图片返回 404，浏览器无法显示图片。':
    'The cover image returned 404 and could not be displayed.',
  '检查图片路径，确认资源已被正确构建和部署。':
    'Check the asset path and verify the file is included in your deployment.',
  '390px 视口中，行程卡片的右边界超出屏幕。':
    'The itinerary card extends beyond the 390px viewport.',
  '确认容器宽度和最小宽度，复查手机布局。':
    'Check the container width and min-width, then inspect the mobile layout again.',
  '读取尚未加载的行程对象时发生未处理异常。':
    'An unhandled error occurred while reading itinerary data.',
  页面脚本: 'Page script',
  '根据异常信息定位代码，检查数据的加载与空值处理。':
    'Use the error to locate the code and verify loading and empty-state handling.',
  交互示例: 'Interactive example',
  预览视口: 'Preview viewport',
  桌面预览: 'Desktop preview',
  手机预览: 'Mobile preview',
  发现的问题: 'Findings',
  文件保存在本地: 'Files stay local',
  旅途手记: 'Travel notes',
  'kyoto.jpg · 图片加载失败': 'kyoto.jpg · failed to load',
  '京都 · 三日旅行': 'Kyoto · three days',
  '在京都，慢下来。': 'A slower Kyoto.',
  '沿着鸭川，走进一场不赶时间的旅行。': 'Take the long way along the Kamo River.',
  '清水寺 → 二年坂 → 鸭川': 'Kiyomizu → Ninenzaka → Kamo',
  '超出视口 96px': '96px beyond viewport',
  定位线索: 'Location',
  观察记录: 'Observation',
  下一步: 'Next step',
  '示意图 · 实际报告使用浏览器截图': 'Illustration · Reports use real browser screenshots',
  复制修复线索: 'Copy repair context',
  '一个问题，一份现场证据。': 'Every finding comes with evidence.',
  '点选左侧问题，看看 ShipLens 如何把现象整理成可操作的修复线索。':
    'Select a finding to explore the evidence and the next step.',
  '此处为交互示例。截图中的网站是演示内容。':
    'Interactive example. The illustrated website is fictional.',
  '查看实际检测报告 ↗': 'Open the generated report ↗',
  检查我的网站: 'Check my website',
  了解报告格式: 'About report formats',
  '没有找到这篇文档。': 'This page could not be found.',
  返回快速开始: 'Back to quick start',
  '先检查真实网站，': 'Inspect the actual website.',
  '再决定下一次交付。': 'Ship with context.',
  文档翻页: 'Documentation pagination',
  '← 上一篇': '← Previous',
  '下一篇 →': 'Next →',
  本页内容: 'On this page',
  查看报告示例: 'Explore a report',
  已复制到剪贴板: 'Copied to clipboard',
  '复制失败，请选中代码手动复制': 'Copy failed. Please select and copy the text.',
  '搜索文档、规则或命令…': 'Search docs, rules or commands…',
  关闭搜索: 'Close search',
  输入关键词搜索: 'Search by keyword',
  选择: 'Select',
  关闭: 'Close',
  '试试「截图」「配置」「退出码」。': 'Try screenshots, configuration, or exit codes.',
};
export const translate = (value) => (locale === 'zh' ? value : (messages[value.trim()] ?? value));
export function translateMarkup(markup) {
  if (locale === 'zh') return markup;
  const template = document.createElement('template');
  template.innerHTML = markup;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const raw = node.textContent,
      trimmed = raw.trim();
    if (messages[trimmed]) node.textContent = raw.replace(trimmed, messages[trimmed]);
  }
  for (const el of template.content.querySelectorAll('[aria-label],[placeholder],[alt]'))
    for (const attr of ['aria-label', 'placeholder', 'alt'])
      if (el.hasAttribute(attr)) el.setAttribute(attr, translate(el.getAttribute(attr)));
  return template.innerHTML;
}
applyPreferences();
