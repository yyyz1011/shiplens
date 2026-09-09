import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './style.css';
import { getDocs, code, escape } from './content.js';
import { getLocale, getTheme, t, setLocale, setTheme, translate, translateMarkup } from './i18n.js';
let docs = getDocs();
const version = __SHIPLENS_VERSION__;
const preferences = () =>
  `<label class="language-control"><span class="sr-only">${t('Language', '语言')}</span><select id="language-select" aria-label="${t('Language', '语言')}"><option value="en" ${getLocale() === 'en' ? 'selected' : ''}>EN</option><option value="zh" ${getLocale() === 'zh' ? 'selected' : ''}>中文</option></select></label><button id="theme-toggle" class="theme-toggle" aria-label="${getTheme() === 'dark' ? t('Switch to light theme', '切换白天模式') : t('Switch to dark theme', '切换黑夜模式')}" aria-pressed="${getTheme() === 'dark'}">${getTheme() === 'dark' ? '☀' : '☾'}</button>`;

const icons = {
  logo: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5m-14-10 2.5 2.5 4.5-5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  terminal: '<path d="m5 6 5 5-5 5m8 1h6"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9Zm-10 12 10 6 10-6M2 15l10 6 10-6"/>',
  camera: '<path d="M4 6h4l2-3h4l2 3h4v15H4Z"/><circle cx="12" cy="13" r="4"/>',
  code: '<path d="m7 6-5 6 5 6m10-12 5 6-5 6m-4-16-2 20"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c6 5 6 13 0 18-6-5-6-13 0-18"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4m-5 0h10"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  file: '<path d="M5 2h9l5 5v15H5Zm9 0v6h5M8 12h8m-8 4h8"/>',
  shield: '<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Zm-5 10 3 3 7-7"/>',
};
const icon = (name, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`;
const brand = `<a class="brand" href="#/" aria-label="ShipLens 首页"><span class="brand-mark">${icon('logo')}</span><span>ShipLens<span class="brand-dot">.</span></span></a>`;
let activeIssue = 0;
let demoDevice = 'mobile';
let lastFocus;
const sampleIssues = [
  {
    severity: 'error',
    label: '图片未能显示',
    code: 'broken-image',
    url: '/trips/kyoto',
    description: '封面图片返回 404，浏览器无法显示图片。',
    target: 'img.trip-cover',
    evidence: 'GET /images/kyoto.jpg → 404',
    line: '检查图片路径，确认资源已被正确构建和部署。',
  },
  {
    severity: 'warning',
    label: '手机布局横向溢出',
    code: 'horizontal-overflow',
    url: '/trips/kyoto',
    description: '390px 视口中，行程卡片的右边界超出屏幕。',
    target: '.trip-schedule',
    evidence: 'Viewport 390px · Right edge 486px',
    line: '确认容器宽度和最小宽度，复查手机布局。',
  },
  {
    severity: 'error',
    label: '页面脚本运行异常',
    code: 'runtime-error',
    url: '/trips/kyoto',
    description: '读取尚未加载的行程对象时发生未处理异常。',
    target: '页面脚本',
    evidence: 'TypeError: Cannot read properties of undefined',
    line: '根据异常信息定位代码，检查数据的加载与空值处理。',
  },
];

function header(isDocs = false) {
  return `<header class="site-header"><div class="nav-shell">${brand}<nav class="desktop-nav" aria-label="主导航"><a class="${!isDocs ? 'active' : ''}" href="#/">概览</a><a class="${isDocs ? 'active' : ''}" href="#/docs/quickstart">文档</a><a href="#/report">报告预览</a></nav><div class="nav-actions"><button class="search-trigger" aria-label="搜索文档">${icon('search')}<span>搜索文档</span><kbd>⌘ K</kbd></button>${preferences()}<button class="menu-toggle" aria-label="打开导航" aria-expanded="false">${icon('menu')}</button></div></div><nav class="mobile-nav" hidden aria-label="手机导航"><a href="#/">概览</a><a href="#/docs/quickstart">文档</a><a href="#/report">报告预览</a><button class="search-trigger">搜索文档</button></nav></header>`;
}

const footer = () =>
  `<footer class="site-footer"><div>${brand}<p>把交付的信心，建立在证据上。</p></div><div class="footer-links"><a href="#/docs/quickstart">快速开始</a><a href="#/docs/rules">检查边界</a><a href="#/docs/reports">数据与隐私</a></div><span class="footer-note">v${version} · MIT · <a href="https://github.com/yyyz1011/shiplens" target="_blank" rel="noopener">GitHub ↗</a></span></footer>`;

function miniReport() {
  return `<div class="hero-visual" aria-label="检查结果示意"><div class="orbital orbital-one"></div><div class="orbital orbital-two"></div><div class="terminal-window"><div class="terminal-bar"><div class="window-dots"><i></i><i></i><i></i></div><span>shiplens — local check</span>${icon('terminal')}</div><div class="terminal-content"><p><span class="terminal-prompt">❯</span> shiplens http://localhost:3000</p><div class="terminal-log"><span>✓</span> 浏览器已就绪 <em>Chromium</em></div><div class="terminal-log"><span>✓</span> 正在检查页面 <em>desktop + mobile</em></div><div class="terminal-log"><span>✓</span> 截图与报告已保存 <em>local only</em></div><div class="terminal-summary"><b>3</b> 个问题，附带现场证据 <span>↵</span></div></div></div><div class="report-window"><div class="report-mini-header"><span class="mini-logo">${icon('logo')}</span><b>交付检查报告</b><span class="sample-badge">示例</span><span class="mini-run">RUN / 001</span></div><div class="mini-metrics"><div><strong>04</strong><span>检查页面</span></div><div><strong class="text-red">02</strong><span>错误</span></div><div><strong class="text-amber">01</strong><span>提醒</span></div><div class="metric-status">${icon('check')}<span>检查完成</span></div></div><div class="mini-findings"><div><span class="severity-dot error"></span><b>图片未能显示</b><code>/trips/kyoto</code><span>↗</span></div><div><span class="severity-dot warning"></span><b>手机布局横向溢出</b><code>390 × 844</code><span>↗</span></div><div><span class="severity-dot error"></span><b>页面脚本运行异常</b><code>TypeError</code><span>↗</span></div></div><div class="mini-report-footer">${icon('camera')} 每个问题，都有截图与复现线索 <a href="#/report">查看报告 ${icon('arrow')}</a></div></div><div class="evidence-tag"><span>${icon('shield')}</span><div><b>证据留在你的电脑</b><small>无需账号 · 无需 API Key</small></div></div></div>`;
}

function home() {
  return `${header()}<main id="main"><section class="hero section-shell"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> THE LAST CHECK BEFORE YOU SHIP</div><h1>代码写完了。<br><span>交付前，再看一眼。</span></h1><p class="hero-description">让真实浏览器替你走一遍网站。<br>找出运行报错、失效资源和手机布局问题，<br class="wide-only">带着截图，交给 AI 继续修。</p><div class="hero-actions"><a class="button primary" href="#/docs/quickstart">开始本地检查 ${icon('arrow')}</a><a class="button quiet" href="#/report">${icon('layers')} 看一份报告</a></div><div class="hero-command"><span>$</span><code>shiplens http://localhost:3000</code><button data-copy="shiplens http://localhost:3000" aria-label="复制本地检查命令">${icon('file')}</button></div><p class="command-caption">Node.js 22.12+</p></div>${miniReport()}</section>
  <section class="compatibility section-shell" aria-label="支持的网站类型"><span>给网站一个网址，就能开始</span><div><b>Next.js</b><b class="vue-word">Vue<span> / Nuxt</span></b><b>React</b><b class="vite-word">Vite</b><b class="html-word">&lt; HTML /&gt;</b></div><span class="compat-note">不依赖源码框架</span></section>
  <section class="capabilities section-shell"><div class="section-heading"><div class="eyebrow">FROM “IT BUILDS” TO “IT WORKS”</div><h2>编译通过之后，<br>还有这些值得检查。</h2><p>从浏览器真实观察出发。明确的失败及时发现，<br>需要判断的现象保留给你确认。</p></div><div class="capability-grid">${[
    [
      'code',
      '运行异常',
      '白屏背后的脚本错误、失效页面与请求，让问题在交付前浮出水面。',
      'runtime-error / http-error',
    ],
    [
      'globe',
      '资源与链接',
      '沿同站链接逐页访问，记录失败的请求、未能显示的图片。',
      'broken-image / request-failed',
    ],
    [
      'phone',
      '手机布局',
      '在 390px 手机视口中检查横向溢出，附上疑似元素和截图。',
      'horizontal-overflow',
    ],
  ]
    .map(
      ([i, t, d, c]) =>
        `<a class="capability" href="#/docs/rules"><span class="feature-icon">${icon(i)}</span><h3>${t}</h3><p>${d}</p><div><code>${c}</code>${icon('arrow')}</div></a>`,
    )
    .join('')}</div></section>
  <section class="workflow-wrap"><div class="workflow section-shell"><div class="workflow-heading"><div class="eyebrow">A SMALL LOOP. A BETTER HANDOFF.</div><h2>检查 → 修复 → 再检查。<br><span>让交付形成闭环。</span></h2><p>不增加一套复杂流程，<br>只在你准备交付时，多一个可靠的动作。</p><a class="inline-link" href="#/docs/reports">了解报告与复查 ${icon('arrow')}</a></div><div class="workflow-steps">${[
    ['01', '输入一个网址', '检查本地开发站或测试环境，在你的电脑上运行。', 'terminal'],
    ['02', '拿到现场证据', '页面、视口、错误信息、截图，都在同一份报告里。', 'camera'],
    ['03', '修复后重新验证', '让编码助手阅读 Markdown，再用相同范围复查。', 'check'],
  ]
    .map(
      ([n, t, d, i]) =>
        `<div class="workflow-step"><span class="step-number">${n}</span><div><h3>${t}</h3><p>${d}</p></div>${icon(i)}</div>`,
    )
    .join('')}</div></div></section>
  <section class="report-section section-shell"><div class="section-heading horizontal"><div><div class="eyebrow">LESS GUESSWORK. MORE EVIDENCE.</div><h2>不只说哪里错了。<br>把现场，一起带回来。</h2></div><p>给人看的 HTML，给脚本的 JSON，<br>给编码助手的 Markdown。全部保存在本地。</p></div><div class="report-preview-inline">${reportDemo()}</div><div class="report-footnote"><span>上方为交互示例，帮助理解报告结构。</span><a href="${import.meta.env.BASE_URL}example/index.html" target="_blank" rel="noopener">打开实际检测生成的报告 ↗</a></div></section>
  <section class="honesty section-shell"><div>${icon('shield')}<h3>清楚知道，检查到了哪里。</h3><p>当前检查公开页面和基础交付问题。业务逻辑、登录权限和真实设备体验，仍需要专门验证。没有发现问题，不等于所有功能都正确。</p></div><a href="#/docs/rules">查看完整能力边界 ${icon('arrow')}</a></section>
  <section class="start-section section-shell"><div><span class="eyebrow">READY FOR ONE MORE LOOK?</span><h2>下一次交付，<br>带上证据。</h2></div><div><a class="button primary" href="#/docs/quickstart">运行你的第一次检查 ${icon('arrow')}</a><p>本地运行 · 无模型调用费用 · 无账号</p></div></section></main>${footer()}`;
}

function reportDemo() {
  const f = sampleIssues[activeIssue];
  return `<div class="demo-report"><div class="demo-toolbar"><div>${icon('logo')}<b>kyoto-trip</b><span class="demo-url">localhost:3000</span><span class="sample-badge">交互示例</span></div><div class="device-switch" role="group" aria-label="预览视口"><button data-device="desktop" aria-pressed="${demoDevice === 'desktop'}" aria-label="桌面预览">${icon('monitor')}</button><button data-device="mobile" aria-pressed="${demoDevice === 'mobile'}" aria-label="手机预览">${icon('phone')}</button></div></div><div class="demo-body"><aside class="demo-sidebar"><div class="demo-list-header">发现的问题 <span>3</span></div>${sampleIssues.map((x, i) => `<button class="demo-issue ${i === activeIssue ? 'selected' : ''}" data-issue="${i}" aria-pressed="${i === activeIssue}"><span class="severity-dot ${x.severity}"></span><div><b>${x.label}</b><span>${x.url}</span></div><span>›</span></button>`).join('')}<div class="demo-side-bottom">${icon('shield')} 文件保存在本地</div></aside><div class="demo-evidence"><div class="evidence-head"><div><span class="rule-label ${f.severity}">${f.severity === 'error' ? 'ERROR' : 'WARNING'}</span><code>${f.code}</code></div><span>${demoDevice === 'mobile' ? '390 × 844' : '1440 × 900'}</span></div><h3>${f.label}</h3><p>${f.description}</p><div class="evidence-content"><div class="page-mock ${demoDevice}"><div class="mock-browser">${icon('globe')} kyoto-trip / trips / kyoto <span>•••</span></div><div class="mock-page"><div class="mock-brand">旅途手记 <span>KYOTO, JAPAN</span></div><div class="mock-image ${activeIssue === 0 ? 'highlight' : ''}"><span>▧</span><small>${activeIssue === 0 ? 'kyoto.jpg · 图片加载失败' : '京都 · 三日旅行'}</small>${activeIssue === 0 ? '<i class="annotation">图片未能显示</i>' : ''}</div><h4>在京都，慢下来。</h4><p>沿着鸭川，走进一场不赶时间的旅行。</p><div class="mock-schedule ${activeIssue === 1 ? 'highlight wide' : ''}"><b>DAY 01</b><span>清水寺 → 二年坂 → 鸭川</span>${activeIssue === 1 ? '<i class="annotation">超出视口 96px</i>' : ''}</div>${activeIssue === 2 ? '<div class="mock-error">TypeError<br><small>Cannot read properties of undefined</small></div>' : ''}</div></div><div class="evidence-detail"><span>定位线索</span><code>${escape(f.target)}</code><span>观察记录</span><pre>${escape(f.evidence)}</pre><span>下一步</span><p>${f.line}</p></div></div></div></div><div class="demo-footer"><span>${icon('camera')} 示意图 · 实际报告使用浏览器截图</span><button data-copy="${escape(`${t(`Verify ${f.code} on ${f.url}. Evidence: ${f.evidence}. ${translate(f.line)} Rerun the same scope after fixing.`, `请核实 ${f.url} 上的 ${f.code} 问题。观察记录：${f.evidence}。${f.line} 修复后使用相同范围重新检查。`)}`)}">复制修复线索 ${icon('file')}</button></div></div>`;
}

function reportPage() {
  return `${header()}<main class="standalone-report section-shell" id="main"><div class="eyebrow">MEET YOUR DELIVERY REPORT</div><h1>一个问题，一份现场证据。</h1><p class="lead">点选左侧问题，看看 ShipLens 如何把现象整理成可操作的修复线索。</p><div class="report-preview-inline">${reportDemo()}</div><div class="report-footnote"><span>此处为交互示例。截图中的网站是演示内容。</span><a href="${import.meta.env.BASE_URL}example/index.html" target="_blank" rel="noopener">查看实际检测报告 ↗</a></div><div class="report-page-next"><a class="button primary" href="#/docs/quickstart">检查我的网站 ${icon('arrow')}</a><a class="inline-link" href="#/docs/reports">了解报告格式</a></div></main>${footer()}`;
}

function docPage(id) {
  const doc = docs.find((d) => d.id === id);
  if (!doc)
    return `${header(true)}<main id="main" class="not-found section-shell"><h1>没有找到这篇文档。</h1><a class="button primary" href="#/docs/quickstart">返回快速开始 ${icon('arrow')}</a></main>${footer()}`;
  const groups = [...new Set(docs.map((d) => d.group))];
  const current = docs.indexOf(doc);
  const toc = [...doc.body.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g)];
  return `${header(true)}<div class="docs-layout"><aside class="docs-sidebar"><div class="docs-sidebar-top">DOCUMENTATION <span>0.1</span></div>${groups
    .map(
      (g) =>
        `<div class="docs-group"><h2>${g}</h2>${docs
          .filter((d) => d.group === g)
          .map(
            (d) =>
              `<a href="#/docs/${d.id}" class="${d.id === id ? 'active' : ''}" ${d.id === id ? 'aria-current="page"' : ''}>${icon(d.id === 'quickstart' ? 'terminal' : d.id === 'rules' ? 'shield' : 'file')}${d.title}${d.id === id ? '<span>›</span>' : ''}</a>`,
          )
          .join('')}</div>`,
    )
    .join(
      '',
    )}<div class="sidebar-note"><span class="live-dot"></span>v${version}<p>先检查真实网站，<br>再决定下一次交付。</p></div></aside><main id="main" class="doc-content"><div class="doc-breadcrumb">文档 <span>/</span> ${doc.group}</div><h1>${doc.title}</h1><p class="doc-description">${doc.description}</p><div class="doc-body">${doc.body}</div><nav class="doc-pagination" aria-label="文档翻页">${current > 0 ? `<a href="#/docs/${docs[current - 1].id}"><small>← 上一篇</small><b>${docs[current - 1].title}</b></a>` : '<div></div>'}${current < docs.length - 1 ? `<a href="#/docs/${docs[current + 1].id}"><small>下一篇 →</small><b>${docs[current + 1].title}</b></a>` : ''}</nav><p class="doc-bottom">ShipLens v${version} · MIT</p></main><aside class="doc-toc"><p>本页内容</p>${toc.map(([, anchor, title]) => `<button data-scroll="${anchor}">${title}</button>`).join('')}<a href="#/report">查看报告示例 ${icon('arrow')}</a></aside></div>`;
}

function render(preserveScroll = false) {
  const scrollY = window.scrollY;
  docs = getDocs();
  document.querySelector('.skip-link').textContent = t('Skip to content', '跳到正文');
  const route = location.hash.slice(1) || '/';
  document.getElementById('app').innerHTML = translateMarkup(
    route.startsWith('/docs/')
      ? docPage(route.split('/')[2])
      : route === '/report'
        ? reportPage()
        : home(),
  );
  const doc = docs.find((d) => route === `/docs/${d.id}`);
  document.title = doc
    ? `${doc.title} · ShipLens`
    : route === '/report'
      ? t('Report preview · ShipLens', '报告预览 · ShipLens')
      : t('ShipLens — Evidence before you ship.', 'ShipLens — 交付之前，亲眼检查。');
  window.scrollTo(0, preserveScroll ? scrollY : 0);
}

let toastTimer;
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = translate(message);
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2200);
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('已复制到剪贴板');
  } catch {
    toast('复制失败，请选中代码手动复制');
  }
}

const searchDialog = document.getElementById('search-dialog');
function searchResults(q) {
  const query = q.trim().toLowerCase();
  const results = docs.filter((d) =>
    `${d.title} ${d.description} ${d.body.replace(/<[^>]*>/g, ' ')}`.toLowerCase().includes(query),
  );
  return results.length
    ? results
        .map(
          (d) =>
            `<a class="search-result" href="#/docs/${d.id}">${icon('file')}<div><b>${d.title}</b><span>${d.description}</span></div>${icon('arrow')}</a>`,
        )
        .join('')
    : `<div class="search-empty">${t(`No results for “${escape(q)}”.`, `没有找到“${escape(q)}”相关内容。`)}<br><small>试试「截图」「配置」「退出码」。</small></div>`;
}
function openSearch() {
  lastFocus = document.activeElement;
  searchDialog.innerHTML = `<div class="search-head">${icon('search')}<label id="search-title" class="sr-only" for="search-input">搜索文档</label><input id="search-input" placeholder="搜索文档、规则或命令…" autocomplete="off"><button class="close-search" aria-label="关闭搜索">${icon('close')}</button></div><div class="search-results">${searchResults('')}</div><div class="search-bottom">输入关键词搜索 <span><kbd>Tab</kbd> 选择 <kbd>Esc</kbd> 关闭</span></div>`;
  searchDialog.innerHTML = translateMarkup(searchDialog.innerHTML);
  searchDialog.showModal();
  searchDialog.querySelector('input').focus();
  searchDialog
    .querySelector('input')
    .addEventListener(
      'input',
      (e) =>
        (searchDialog.querySelector('.search-results').innerHTML = translateMarkup(
          searchResults(e.target.value),
        )),
    );
}
searchDialog.addEventListener('close', () => lastFocus?.isConnected && lastFocus.focus());
searchDialog.addEventListener('click', (e) => {
  if (
    e.target === searchDialog ||
    e.target.closest('.close-search') ||
    e.target.closest('.search-result')
  )
    searchDialog.close();
});
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (!searchDialog.open) openSearch();
  }
});
document.addEventListener('click', (e) => {
  if (e.target.closest('.skip-link')) {
    e.preventDefault();
    const main = document.getElementById('main');
    main?.setAttribute('tabindex', '-1');
    main?.focus();
    return;
  }
  const copyButton = e.target.closest('[data-copy]');
  if (copyButton) copy(copyButton.dataset.copy);
  if (e.target.closest('.search-trigger')) openSearch();
  const menu = e.target.closest('.menu-toggle');
  if (menu) {
    const nav = document.querySelector('.mobile-nav');
    nav.hidden = !nav.hidden;
    menu.setAttribute('aria-expanded', String(!nav.hidden));
  }
  const issue = e.target.closest('[data-issue]');
  const device = e.target.closest('[data-device]');
  if (issue || device) {
    if (issue) activeIssue = Number(issue.dataset.issue);
    if (device) demoDevice = device.dataset.device;
    document
      .querySelectorAll('.report-preview-inline')
      .forEach((el) => (el.innerHTML = translateMarkup(reportDemo())));
    const selected = document.querySelector(
      issue ? `[data-issue="${activeIssue}"]` : `[data-device="${demoDevice}"]`,
    );
    selected?.focus({ preventScroll: true });
  }
  const scroll = e.target.closest('[data-scroll]');
  if (scroll)
    document.getElementById(scroll.dataset.scroll)?.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      block: 'start',
    });
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'language-select') {
    setLocale(e.target.value);
    render(true);
    document.getElementById('language-select').focus({ preventScroll: true });
  }
});
document.addEventListener('click', (e) => {
  if (e.target.closest('#theme-toggle')) {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    render(true);
    document.getElementById('theme-toggle').focus({ preventScroll: true });
  }
});
window.addEventListener('hashchange', () => render());
render();
