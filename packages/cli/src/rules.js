export const RULE_TITLES = {
  'interaction-failed': ['Interaction step failed', '交互步骤失败'],
  'runtime-error': ['Unhandled page error', '页面脚本运行异常'],
  'console-error': ['Console error', '浏览器控制台报错'],
  'http-error': ['HTTP request failed', 'HTTP 请求失败'],
  'request-failed': ['Network request failed', '网络请求未完成'],
  'broken-image': ['Image could not be displayed', '图片未能显示'],
  'horizontal-overflow': ['Suspected horizontal overflow', '页面疑似横向溢出'],
  'page-empty': ['Page appears empty', '页面疑似空白'],
  'navigation-failed': ['Page check incomplete', '页面检查未完成'],
  'screenshot-failed': ['Screenshot unavailable', '截图未能保存'],
};
// This function executes inside the browser; keep it self-contained.
export function inspectDOM() {
  const visible = (el) => {
    const r = el.getBoundingClientRect(),
      s = getComputedStyle(el);
    return (
      r.width > 0 &&
      r.height > 0 &&
      s.visibility !== 'hidden' &&
      s.display !== 'none' &&
      Number(s.opacity) > 0 &&
      !!el.getClientRects().length
    );
  };
  const selector = (el) => {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    while (el && el !== document.body) {
      let p = el.tagName.toLowerCase();
      const siblings = el.parentElement
        ? [...el.parentElement.children].filter((x) => x.tagName === el.tagName)
        : [];
      if (siblings.length > 1) p += `:nth-of-type(${siblings.indexOf(el) + 1})`;
      parts.unshift(p);
      el = el.parentElement;
    }
    return 'body > ' + parts.join(' > ');
  };
  if (!document.body)
    return { links: [], images: [], overflow: [], blank: true, title: document.title };
  const w = document.documentElement.clientWidth;
  const images = [...document.images]
    .filter((el) => visible(el) && el.complete && !el.naturalWidth && (el.currentSrc || el.src))
    .slice(0, 100)
    .map((el) => ({ src: el.currentSrc || el.src, selector: selector(el) }));
  const overflow = [];
  if (document.documentElement.scrollWidth > w + 4) {
    for (const el of document.body.querySelectorAll('*')) {
      if (overflow.length >= 8) break;
      const r = el.getBoundingClientRect();
      if (
        !visible(el) ||
        el.closest('[data-shiplens-ignore]') ||
        (r.right <= w + 4 && r.left >= -4)
      )
        continue;
      // A child extending inside an intentional scroll/clip container is not a document overflow source.
      let parent = el.parentElement,
        clipped = false;
      while (parent && parent !== document.body) {
        if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowX)) {
          clipped = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!clipped)
        overflow.push({
          selector: selector(el),
          right: Math.round(r.right),
          width: Math.round(r.width),
        });
    }
  }
  let hasText = false;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node,
    examined = 0;
  while ((node = walker.nextNode()) && examined++ < 20000) {
    if (
      node.textContent.trim() &&
      node.parentElement &&
      !node.parentElement.closest('script,style,noscript,template') &&
      visible(node.parentElement)
    ) {
      hasText = true;
      break;
    }
  }
  const hasContent = [
    ...document.querySelectorAll('img,video,canvas,svg,iframe,input,button'),
  ].some(
    (el) =>
      visible(el) &&
      el.getBoundingClientRect().width >= 8 &&
      el.getBoundingClientRect().height >= 8,
  );
  return {
    title: document.title,
    links: [...document.querySelectorAll('a[href]:not([download])')].map((a) => a.href),
    images,
    overflow,
    blank: !hasText && !hasContent,
  };
}
