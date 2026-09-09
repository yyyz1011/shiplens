import { t } from './i18n.js';
export const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const code = (text, label = 'Terminal') =>
  `<div class="codeblock"><div class="code-label"><span>${label}</span><button class="copy-button" data-copy="${escape(text)}" aria-label="${t('Copy code', '复制代码')}">${t('Copy', '复制')}</button></div><pre><code>${escape(text)}</code></pre></div>`;
export const p = (en, zh) => `<p>${t(en, zh)}</p>`;
export const h = (id, en, zh) => `<h2 id="${id}">${t(en, zh)}</h2>`;
export const note = (en, zh) => `<aside class="note"><span>i</span><div>${t(en, zh)}</div></aside>`;
export const table = (rows, labels = [t('Option', '参数'), t('Behavior', '行为')]) =>
  `<div class="table-scroll"><table><thead><tr><th>${labels[0]}</th><th>${labels[1]}</th></tr></thead><tbody>${rows.map(([key, en, zh]) => `<tr><td><code>${key}</code></td><td>${t(en, zh)}</td></tr>`).join('')}</tbody></table></div>`;

// Cells are already localized, trusted documentation markup.
export const dataTable = (rows, labels) =>
  `<div class="table-scroll"><table><thead><tr>${labels.map((label) => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, i) => (i === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
