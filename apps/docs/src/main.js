import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import './style.css';
import './reading.css';
import { getDocs, escape } from './content.js';
import { getLocale, getTheme, t, setLocale, setTheme, translate, translateMarkup } from './i18n.js';
const version = __SHIPLENS_VERSION__;
let docs = getDocs(),
  activeIssue = 0,
  demoDevice = 'mobile',
  lastFocus,
  toastTimer,
  outlineObserver;
const icons = {
  logo: '<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5m-14-10 2.5 2.5 4.5-5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20.8 13A9 9 0 0 1 11 3.2 9 9 0 1 0 20.8 13Z"/>',
  github:
    '<path d="M9 19c-4.3 1.3-4.3-2.2-6-2.7m12 5v-3.4c0-1 .1-1.5-.5-2.1 3.3-.4 6.7-1.6 6.7-7.3 0-1.6-.5-2.9-1.5-3.9.1-.4.7-1.9-.2-3.9 0 0-1.3-.4-4.2 1.5a14.3 14.3 0 0 0-7.6 0C4.8.3 3.5.7 3.5.7c-.9 2-.3 3.5-.2 3.9-1 1-1.5 2.3-1.5 3.9 0 5.7 3.4 6.9 6.7 7.3-.5.5-.7 1.2-.7 2.1v3.4" transform="translate(1 1) scale(.9)"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c6 5 6 13 0 18-6-5-6-13 0-18"/>',
  file: '<path d="M5 2h9l5 5v15H5Zm9 0v6h5M8 12h8m-8 4h8"/>',
  camera: '<path d="M4 6h4l2-3h4l2 3h4v15H4Z"/><circle cx="12" cy="13" r="4"/>',
  shield: '<path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Zm-5 10 3 3 7-7"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4m-5 0h10"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`;
const brand = () =>
  `<a class="reading-brand" href="#/" aria-label="ShipLens ${t('documentation', '文档')}"><span>${icon('logo')}</span>ShipLens</a>`;
const docLink = (id) => (id === 'introduction' ? '#/' : `#/docs/${id}`);
function header() {
  return `<header class="reading-header">${brand()}<div class="reading-toolbar"><button class="search-trigger" aria-label="${t('Search docs', '搜索文档')}">${icon('search')}<span>${t('Search documentation', '搜索文档')}</span><kbd>⌘ K</kbd></button><nav aria-label="${t('Main navigation', '主导航')}" class="reading-top-links"><a href="#/" ${routeState().route !== '/report' ? 'aria-current="page"' : ''}>${t('Documentation', '文档')}</a><a href="#/report" ${routeState().route === '/report' ? 'aria-current="page"' : ''}>${t('Report preview', '报告预览')}</a><a href="https://www.npmjs.com/package/shiplens" target="_blank" rel="noopener">npm ↗</a></nav><div class="reading-preferences"><a class="github-link" href="https://github.com/yyyz1011/shiplens" target="_blank" rel="noopener" aria-label="GitHub">${icon('github')}</a><label class="language-control"><span class="sr-only">${t('Language', '语言')}</span><select id="language-select" aria-label="${t('Language', '语言')}"><option value="en" ${getLocale() === 'en' ? 'selected' : ''}>EN</option><option value="zh" ${getLocale() === 'zh' ? 'selected' : ''}>中文</option></select></label><button id="theme-toggle" class="theme-toggle" aria-pressed="${getTheme() === 'dark'}" aria-label="${getTheme() === 'dark' ? t('Switch to light theme', '切换白天模式') : t('Switch to dark theme', '切换黑夜模式')}">${icon(getTheme() === 'dark' ? 'sun' : 'moon')}</button></div></div></header>`;
}
function navigation(id) {
  return `<nav aria-label="${t('Documentation navigation', '文档目录')}">${[
    ...new Set(docs.map((d) => d.group)),
  ]
    .map(
      (group) =>
        `<section class="reading-nav-group"><h2>${group}</h2>${docs
          .filter((d) => d.group === group)
          .map(
            (d) =>
              `<a href="${docLink(d.id)}" ${d.id === id ? 'class="active" aria-current="page"' : ''}>${d.id === 'introduction' ? t('Introduction', '介绍') : d.title}</a>`,
          )
          .join('')}</section>`,
    )
    .join(
      '',
    )}<section class="reading-nav-group"><h2>${t('Resources', '资源')}</h2><a href="#/report">${t('Report preview', '报告预览')}</a><a href="https://github.com/yyyz1011/shiplens/releases" target="_blank" rel="noopener">${t('Changelog', '更新记录')} ↗</a></section></nav>`;
}
const tocLinks = (toc, id) =>
  toc
    .map(
      ([, anchor, title]) =>
        `<a data-section="${anchor}" href="${docLink(id)}?section=${anchor}">${title}</a>`,
    )
    .join('');
function docPage(id) {
  const doc = docs.find((d) => d.id === id);
  if (!doc)
    return `${header()}<main id="main" class="reading-not-found"><h1>${t('Page not found', '没有找到这篇文档')}</h1><a href="#/">${t('Back to documentation', '返回文档首页')}</a></main>`;
  const toc = [...doc.body.matchAll(/<h2 id="([^"]+)">([^<]+)<\/h2>/g)];
  const current = docs.indexOf(doc);
  const body = doc.body.replace(
    /<h2 id="([^"]+)">([^<]+)<\/h2>/g,
    (_, anchor, title) =>
      `<h2 id="${anchor}" tabindex="-1">${title}<a class="heading-permalink" aria-label="${t('Link to', '链接到')} ${escape(title)}" href="${docLink(id)}?section=${anchor}">#</a></h2>`,
  );
  return `${header()}<div class="reading-subnav"><button class="docs-menu-trigger" aria-haspopup="dialog" aria-controls="docs-drawer">${icon('menu')}${t('Menu', '目录')}</button><span>${id === 'introduction' ? t('Introduction', '介绍') : doc.title}</span><details class="mobile-outline"><summary>${t('On this page', '本页内容')}</summary><nav>${tocLinks(toc, id)}</nav></details></div><aside class="reading-sidebar">${navigation(id)}<div class="reading-version">v${version}<span>MIT</span></div></aside><dialog id="docs-drawer" class="reading-drawer" aria-label="${t('Documentation navigation', '文档目录')}"><div class="drawer-heading"><strong>${t('Documentation', '文档')}</strong><button data-close-drawer aria-label="${t('Close menu', '关闭目录')}">${icon('close')}</button></div>${navigation(id)}</dialog><div class="reading-layout"><main id="main" class="reading-article"><h1>${doc.title}</h1><p class="reading-description">${doc.description}</p><div class="doc-body">${body}</div><footer class="reading-article-footer"><a href="https://github.com/yyyz1011/shiplens/blob/master/apps/docs/src/content.js" target="_blank" rel="noopener">${t('View source on GitHub', '在 GitHub 查看源码')} ↗</a><span>ShipLens v${version} · MIT</span></footer><nav class="reading-pagination" aria-label="${t('Documentation pagination', '文档翻页')}">${current > 0 ? `<a href="${docLink(docs[current - 1].id)}"><span>${t('Previous page', '上一篇')}</span><strong>${current === 1 ? t('Introduction', '介绍') : docs[current - 1].title}</strong></a>` : '<div></div>'}${current < docs.length - 1 ? `<a href="${docLink(docs[current + 1].id)}"><span>${t('Next page', '下一篇')}</span><strong>${docs[current + 1].title}</strong></a>` : ''}</nav></main><aside class="reading-outline"><nav aria-label="${t('On this page', '本页内容')}"><strong>${t('On this page', '本页内容')}</strong>${tocLinks(toc, id)}</nav><a class="outline-support" href="https://github.com/yyyz1011/shiplens/issues" target="_blank" rel="noopener">${t('Found an issue?', '发现问题？')} ↗</a></aside></div>`;
}
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
function reportDemo() {
  const f = sampleIssues[activeIssue];
  return `<div class="demo-report"><div class="demo-toolbar"><div>${icon('logo')}<b>kyoto-trip</b><span class="demo-url">localhost:3000</span><span class="sample-badge">交互示例</span></div><div class="device-switch" role="group" aria-label="预览视口"><button data-device="desktop" aria-pressed="${demoDevice === 'desktop'}" aria-label="桌面预览">${icon('monitor')}</button><button data-device="mobile" aria-pressed="${demoDevice === 'mobile'}" aria-label="手机预览">${icon('phone')}</button></div></div><div class="demo-body"><aside class="demo-sidebar"><div class="demo-list-header">发现的问题 <span>3</span></div>${sampleIssues.map((x, i) => `<button class="demo-issue ${i === activeIssue ? 'selected' : ''}" data-issue="${i}" aria-pressed="${i === activeIssue}"><span class="severity-dot ${x.severity}"></span><div><b>${x.label}</b><span>${x.url}</span></div><span>›</span></button>`).join('')}<div class="demo-side-bottom">${icon('shield')} 文件保存在本地</div></aside><div class="demo-evidence"><div class="evidence-head"><div><span class="rule-label ${f.severity}">${f.severity === 'error' ? 'ERROR' : 'WARNING'}</span><code>${f.code}</code></div><span>${demoDevice === 'mobile' ? '390 × 844' : '1440 × 900'}</span></div><h3>${f.label}</h3><p>${f.description}</p><div class="evidence-content"><div class="page-mock ${demoDevice}"><div class="mock-browser">${icon('globe')} kyoto-trip / trips / kyoto <span>•••</span></div><div class="mock-page"><div class="mock-brand">旅途手记 <span>KYOTO, JAPAN</span></div><div class="mock-image ${activeIssue === 0 ? 'highlight' : ''}"><span>▧</span><small>${activeIssue === 0 ? 'kyoto.jpg · 图片加载失败' : '京都 · 三日旅行'}</small>${activeIssue === 0 ? '<i class="annotation">图片未能显示</i>' : ''}</div><h4>在京都，慢下来。</h4><p>沿着鸭川，走进一场不赶时间的旅行。</p><div class="mock-schedule ${activeIssue === 1 ? 'highlight wide' : ''}"><b>DAY 01</b><span>清水寺 → 二年坂 → 鸭川</span>${activeIssue === 1 ? '<i class="annotation">超出视口 96px</i>' : ''}</div>${activeIssue === 2 ? '<div class="mock-error">TypeError<br><small>Cannot read properties of undefined</small></div>' : ''}</div></div><div class="evidence-detail"><span>定位线索</span><code>${escape(f.target)}</code><span>观察记录</span><pre>${escape(f.evidence)}</pre><span>下一步</span><p>${f.line}</p></div></div></div></div><div class="demo-footer"><span>${icon('camera')} 示意图 · 实际报告使用浏览器截图</span><button data-copy="${escape(`${t(`Verify ${f.code} on ${f.url}. Evidence: ${f.evidence}. ${translate(f.line)} Rerun the same scope after fixing.`, `请核实 ${f.url} 上的 ${f.code} 问题。观察记录：${f.evidence}。${f.line} 修复后使用相同范围重新检查。`)}`)}">复制修复线索 ${icon('file')}</button></div></div>`;
}

function reportPage() {
  return `${header()}<main id="main" class="reading-report"><a class="back-to-docs" href="#/">← ${t('Documentation', '文档')}</a><h1>${t('Explore the evidence.', '查看一份交付报告。')}</h1><p class="reading-description">${t('Select a finding to see its context, browser evidence and next step.', '选择一个问题，查看上下文、浏览器证据和下一步建议。')}</p><div class="report-preview-inline">${reportDemo()}</div><div class="report-footnote"><span>${t('Interactive illustration. The website shown is fictional.', '交互示意。图中网站为演示内容。')}</span><a href="${import.meta.env.BASE_URL}example/index.html" target="_blank" rel="noopener">${t('Open a real generated report ↗', '打开实际生成的报告 ↗')}</a></div><a class="inline-link" href="#/docs/reports">${t('Understand report formats and baselines', '了解报告格式和基线对比')} ${icon('arrow')}</a></main>`;
}
function routeState() {
  const [route, query = ''] = location.hash.slice(1).split('?');
  return { route: route || '/', section: new URLSearchParams(query).get('section') };
}
function observeOutline() {
  outlineObserver?.disconnect();
  const headings = [...document.querySelectorAll('.doc-body h2[id]')];
  const update = () => {
    const active =
      headings.filter((h) => h.getBoundingClientRect().top <= 160).at(-1) || headings[0];
    document.querySelectorAll('[data-section]').forEach((a) => {
      if (a.dataset.section === active?.id) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  };
  outlineObserver = new IntersectionObserver(update, { rootMargin: '-100px 0px -60% 0px' });
  headings.forEach((h) => outlineObserver.observe(h));
  update();
}
function render(preserveScroll = false) {
  const y = scrollY;
  docs = getDocs();
  const { route, section } = routeState();
  const id = route === '/' || route === '/docs' ? 'introduction' : route.split('/')[2];
  document.body.dataset.surface = route === '/report' ? 'report' : 'docs';
  document.querySelector('.skip-link').textContent = t('Skip to content', '跳到正文');
  document.getElementById('app').innerHTML = translateMarkup(
    route === '/report' ? reportPage() : docPage(id),
  );
  document.title = `${route === '/report' ? t('Report preview', '报告预览') : docs.find((d) => d.id === id)?.title || t('Page not found', '页面不存在')} · ShipLens`;
  const drawer = document.getElementById('docs-drawer');
  drawer?.addEventListener('click', (e) => {
    if (e.target === drawer || e.target.closest('[data-close-drawer]') || e.target.closest('a'))
      drawer.close();
  });
  drawer?.addEventListener('close', () =>
    document.querySelector('.docs-menu-trigger')?.focus({ preventScroll: true }),
  );
  window.scrollTo({ top: preserveScroll ? y : 0, behavior: 'instant' });
  requestAnimationFrame(() => {
    if (section && !preserveScroll) {
      document.getElementById(section)?.scrollIntoView({ block: 'start', behavior: 'instant' });
      document.getElementById(section)?.focus({ preventScroll: true });
    }
    observeOutline();
  });
}
function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = translate(message);
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2200);
}
async function copy(value) {
  try {
    await navigator.clipboard.writeText(value);
    toast(t('Copied to clipboard', '已复制到剪贴板'));
  } catch {
    toast(t('Copy failed. Please select and copy the text.', '复制失败，请选中代码手动复制'));
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
            `<a class="search-result" href="${docLink(d.id)}">${icon('file')}<div><b>${d.title}</b><span>${d.description}</span></div>${icon('arrow')}</a>`,
        )
        .join('')
    : `<div class="search-empty">${t(`No results for “${escape(q)}”.`, `没有找到“${escape(q)}”相关内容。`)}<br><small>${t('Try screenshots, configuration or exit codes.', '试试「截图」「配置」「退出码」。')}</small></div>`;
}
function openSearch() {
  lastFocus = document.activeElement;
  searchDialog.innerHTML = `<div class="search-head">${icon('search')}<label id="search-title" class="sr-only" for="search-input">${t('Search docs', '搜索文档')}</label><input id="search-input" placeholder="${t('Search docs, rules or commands…', '搜索文档、规则或命令…')}" autocomplete="off"><button class="close-search" aria-label="${t('Close search', '关闭搜索')}">${icon('close')}</button></div><div class="search-results">${searchResults('')}</div><div class="search-bottom">${t('Search documentation', '搜索文档')}<span><kbd>Esc</kbd> ${t('Close', '关闭')}</span></div>`;
  searchDialog.showModal();
  searchDialog.querySelector('input').focus();
  searchDialog
    .querySelector('input')
    .addEventListener(
      'input',
      (e) =>
        (searchDialog.querySelector('.search-results').innerHTML = searchResults(e.target.value)),
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
document.addEventListener('change', (e) => {
  if (e.target.id === 'language-select') {
    setLocale(e.target.value);
    render(true);
    document.getElementById('language-select').focus({ preventScroll: true });
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
  const cp = e.target.closest('[data-copy]');
  if (cp) copy(cp.dataset.copy);
  if (e.target.closest('.search-trigger')) openSearch();
  if (e.target.closest('.docs-menu-trigger')) document.getElementById('docs-drawer').showModal();
  if (e.target.closest('#theme-toggle')) {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    render(true);
    document.getElementById('theme-toggle').focus({ preventScroll: true });
  }
  const issue = e.target.closest('[data-issue]'),
    device = e.target.closest('[data-device]');
  if (issue || device) {
    if (issue) activeIssue = Number(issue.dataset.issue);
    if (device) demoDevice = device.dataset.device;
    document
      .querySelectorAll('.report-preview-inline')
      .forEach((el) => (el.innerHTML = translateMarkup(reportDemo())));
    document
      .querySelector(issue ? `[data-issue="${activeIssue}"]` : `[data-device="${demoDevice}"]`)
      ?.focus({ preventScroll: true });
  }
});
window.addEventListener('hashchange', () => render());
render();
