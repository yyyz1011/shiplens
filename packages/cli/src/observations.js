import { writeFile } from 'node:fs/promises';
import { redact } from './options.js';

// Runs in the page. A bounded observation, not an accessibility audit or a full DOM dump.
function observe(masked) {
  const hidden = (el) => {
    if (!el || masked.some((root) => root === el || root.contains(el))) return true;
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0)
        return true;
    }
    return !el.getClientRects().length;
  };
  const textOf = (root, limit) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let text = '',
      node,
      visited = 0;
    while ((node = walker.nextNode())) {
      if (++visited > 10000) return { text, truncated: true };
      const parent = node.parentElement;
      if (parent?.closest('script,style,noscript,textarea,select,input') || hidden(parent))
        continue;
      text += node.textContent.replace(/\s+/g, ' ').trim() + ' ';
      if (text.length > limit) return { text: text.slice(0, limit), truncated: true };
    }
    return { text: text.trim(), truncated: false };
  };
  const selector = (el) => {
    if (el.id && el.id.length <= 120) return '#' + CSS.escape(el.id);
    const parts = [];
    while (el && el !== document.body) {
      const tag = el.tagName.toLowerCase();
      const siblings = [...(el.parentElement?.children || [])].filter(
        (x) => x.tagName === el.tagName,
      );
      parts.unshift(tag + (siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(el) + 1})` : ''));
      el = el.parentElement;
    }
    return 'body' + (parts.length ? ' > ' + parts.join(' > ') : '');
  };
  const body = document.body;
  if (!body) return { text: '', elements: [], textTruncated: false, elementsTruncated: false };
  const text = textOf(body, 8000),
    elements = [];
  let elementsTruncated = false;
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
  let el,
    visited = 0;
  while ((el = walker.nextNode())) {
    if (++visited > 10000) {
      elementsTruncated = true;
      break;
    }
    if (
      !el.matches('h1,h2,h3,h4,h5,h6,a,button,input,select,textarea,[role],[tabindex]') ||
      hidden(el)
    )
      continue;
    if (elements.length === 100) {
      elementsTruncated = true;
      break;
    }
    const box = el.getBoundingClientRect();
    elements.push({
      selector: selector(el),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      text: textOf(el, 240).text,
      disabled: !!el.disabled,
      bounds: {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height),
      },
    });
  }
  return { text: text.text, textTruncated: text.truncated, elements, elementsTruncated };
}

export async function captureObservation(page, masks, filename) {
  const handles = (await Promise.all(masks.map((locator) => locator.elementHandles()))).flat();
  try {
    const observation = await page.evaluate(observe, handles);
    const result = {
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      url: redact(page.url()),
      scope:
        'bounded visible DOM; input values and masked subtrees excluded; frames and shadow DOM not traversed',
      ...observation,
    };
    // Same URL/token redaction as other reports. Arbitrary page text still needs explicit masks.
    const sanitize = (value) =>
      typeof value === 'string'
        ? redact(value)
        : Array.isArray(value)
          ? value.map(sanitize)
          : value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]))
            : value;
    const safe = sanitize(result);
    await writeFile(filename, JSON.stringify(safe, null, 2) + '\n', { mode: 0o600 });
  } finally {
    await Promise.all(handles.map((handle) => handle.dispose().catch(() => {})));
  }
}
