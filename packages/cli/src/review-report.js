const escape = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const line = (value) =>
  escape(value)
    .replace(/[\r\n]/g, ' ')
    .replace(/\|/g, '&#124;');
export function acceptanceGate(run, { failOn = 'error' } = {}) {
  if (!['error', 'warning'].includes(failOn)) throw new Error('failOn must be error or warning.');
  const counts = { pass: 0, fail: 0, pending: 0, 'needs-evidence': 0 };
  for (const r of run.requirements) counts[r.status]++;
  const reasons = [];
  if (counts.fail) reasons.push('failed-requirements');
  if (counts.pending || counts['needs-evidence']) reasons.push('unreviewed-requirements');
  if (run.machine.summary.incomplete) reasons.push('incomplete-machine-checks');
  if (run.machine.truncated || run.machine.summary.scrollLimited)
    reasons.push('limited-machine-coverage');
  if (run.machine.summary.errors || (failOn === 'warning' && run.machine.summary.warnings))
    reasons.push('machine-findings');
  return {
    runId: run.runId,
    passed: reasons.length === 0,
    counts,
    failOn,
    reasons,
    note: 'Gate applies to configured text checks, recorded caller assessments and observed scope; it does not verify unconfigured business meaning or model reasoning.',
  };
}
export function acceptanceMarkdown(run, gate) {
  return `# ShipLens acceptance review\n\nRun: ${line(run.runId)}\n\nGate: **${gate.passed ? 'PASS' : 'BLOCKED'}**\n\n${line(gate.note)}\n\n${gate.reasons.map((x) => '- ' + x).join('\n')}\n\n| Requirement | Status | Judgment | Evidence |\n| --- | --- | --- | --- |\n${run.requirements.map((r) => `| ${line(r.id)}: ${line(r.description)} | ${r.status} | ${line(r.assessment?.note || (r.verification ? 'Configured text checks: ' + r.verification.status : 'Awaiting assessment'))} | ${line((r.assessment?.evidenceIds || r.verification?.evidenceIds || []).join(', '))} |`).join('\n')}\n\n## Machine checks\n\n${Object.entries(
    run.machine.summary,
  )
    .map(([k, v]) => `- ${k}: ${v}`)
    .join(
      '\n',
    )}\n\n## Assessment history\n\n${run.history.map((a) => `- ${line(a.recordedAt)} · ${line(a.criterionId)} · ${a.status}: ${line(a.note)}`).join('\n')}\n`;
}
export function acceptanceHtml(run, gate, captures, lang = 'en', comparison = null) {
  const t = (en, zh) => (lang === 'zh' ? zh : en);
  const status = (key) =>
    ({
      pass: t('Pass', '通过'),
      fail: t('Fail', '失败'),
      pending: t('Pending', '待判断'),
      'needs-evidence': t('Needs evidence', '待补证'),
    })[key];
  const comparisons = comparison
    ? `<h2>${t('Before and after', '修复前后')}</h2><p>${escape(comparison.note)}</p>${comparison.criteria
        .map(
          (c) =>
            `<section class="criterion"><h3>${escape(c.criterionId)} · ${escape(c.transition)}</h3>${c.pairs
              .map(
                (pair) =>
                  `<p>${escape(pair.viewport)} · ${pair.comparable ? t('Comparable evidence', '证据可对比') : t('Scope or evidence differs', '范围或证据不一致')}</p><div class="evidence">${[
                    ['Before', '之前', pair.beforeEvidenceId],
                    ['After', '之后', pair.afterEvidenceId],
                  ]
                    .map(([en, zh, id]) => {
                      const proof = captures.find((p) => p.evidence.evidenceId === id);
                      return `<figure><figcaption>${t(en, zh)} · ${escape(id || t('No evidence', '无证据'))}</figcaption>${proof?.image ? `<img loading="lazy" src="data:image/png;base64,${proof.image.data}" alt="${escape(t(en, zh) + ' · ' + c.criterionId + ' · ' + pair.viewport)}">` : `<p>${t('Image unavailable or omitted', '图片不可用或已省略')}</p>`}</figure>`;
                    })
                    .join('')}</div>`,
              )
              .join('')}</section>`,
        )
        .join('')}`
    : '';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>ShipLens · ${t('Acceptance review', '验收报告')}</title><style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif;color:#182c47;background:#f4f7fb;--paper:#fff;--muted:#526981;--line:#dce4ef;--accent:#234eb0}*{box-sizing:border-box}body{margin:0}header{padding:20px max(24px,calc((100vw - 1100px)/2));border-bottom:1px solid var(--line);background:var(--paper);font-weight:700}main{max-width:1100px;margin:40px auto;padding:0 24px}h1{font-size:clamp(28px,5vw,40px);letter-spacing:-.025em;line-height:1.15}h2{margin:40px 0 16px;font-size:24px}h3{margin:0 0 12px;font-size:19px}p{line-height:1.65;max-width:72ch;overflow-wrap:anywhere}.muted,small{color:var(--muted)}.gate{padding:20px 0;border-block:1px solid var(--line)}.gate strong{font-size:22px}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}td,th{padding:14px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{white-space:nowrap}td{min-width:110px;overflow-wrap:anywhere}.criterion{padding:24px 0;border-bottom:1px solid var(--line)}.evidence{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}figure{margin:8px 0}img{width:100%;max-height:480px;object-fit:contain;object-position:top;background:var(--paper);border:1px solid var(--line)}figcaption{font-size:13px;margin-top:8px;overflow-wrap:anywhere}summary{cursor:pointer;padding:12px 0;font-weight:600}details{margin-top:12px}code{font-size:13px;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--paper);padding:16px;border:1px solid var(--line)}a{color:var(--accent);text-underline-offset:.2em}a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:4px}::selection{background:#d5e2ff;color:#172b4a}footer{padding:24px 0;color:var(--muted);font-size:13px}@media(prefers-color-scheme:dark){:root{background:#101923;color:#e3edf7;--paper:#172331;--muted:#abbdd0;--line:#35465b;--accent:#b1c8ff}}@media(max-width:640px){main{margin:28px auto;padding:0 18px}.evidence{grid-template-columns:1fr}td,th{padding:12px 8px}}@media print{details{display:block}main{max-width:none}img{max-height:320px}.criterion{break-inside:avoid}}
</style></head><body><header>ShipLens</header><main><h1>${t('Acceptance review', '验收报告')}</h1><p class="muted">${escape(run.createdAt)} · <code>${escape(run.runId)}</code></p><div class="gate"><strong>${gate.passed ? t('Recorded checks passed', '记录内的检查已通过') : t('Review requires attention', '验收仍需处理')}</strong><p>${t('AI judgments and machine checks are listed separately. Pending work and missing evidence remain visible.', 'AI 判断与机器检查分别展示，未完成的判断与缺失证据保留在报告中。')}</p>${gate.reasons.length ? `<p>${escape(gate.reasons.join(' · '))}</p>` : ''}</div>${comparisons}<h2>${t('Requirements', '验收项')}</h2><div class="scroll"><table><thead><tr><th>${t('Requirement', '需求')}</th><th>${t('Status', '状态')}</th><th>${t('Judgment', '判断依据')}</th></tr></thead><tbody>${run.requirements.map((r) => `<tr><td>${escape(r.description)}</td><td>${status(r.status)}</td><td>${escape(r.assessment?.note || (r.verification ? t('Configured text checks: ', '配置的文本断言：') + status(r.verification.status) : t('Awaiting assessment', '等待判断')))}</td></tr>`).join('')}</tbody></table></div>${run.requirements
    .map(
      (r) =>
        `<section class="criterion"><h3>${escape(r.id)} · ${status(r.status)}</h3><p>${escape(r.page)}${r.selector ? ' · ' + escape(r.selector) : ''}</p>${r.checks ? '<p>' + escape(t('Text checks on visible unmasked evidence: ', '对可见且未遮罩文本的断言：') + r.checks.map((c) => c.operator + ' ' + JSON.stringify(c.value)).join('; ')) + '</p>' : ''}<div class="evidence">${captures
          .filter(
            (c) =>
              run.evidence.some((e) => e.evidenceId === c.evidence.evidenceId) &&
              c.evidence.criterionIds.includes(r.id),
          )
          .map(
            (c) =>
              `<figure>${c.image ? `<img loading="lazy" src="data:image/png;base64,${c.image.data}" alt="${escape(r.id + ' · ' + c.evidence.viewport)}">` : `<p>${t('Image omitted or unavailable. Read the original run evidence.', '图片已省略或不可用，请读取原始运行证据。')}</p>`}<figcaption>${escape(c.evidence.viewport + ' · ' + c.evidence.evidenceId)} · ${c.evidence.complete ? t('Captured', '已采集') : t('Incomplete', '不完整')}</figcaption><details><summary>${t('DOM and diagnostics', '页面结构与诊断')}</summary><pre>${escape(c.observation?.text || '')}</pre>${c.findings.map((f) => `<p><code>${escape(f.code)}</code> ${escape(f.detail)}</p>`).join('')}${c.evidence.notes.map((n) => `<p>${escape(n)}</p>`).join('')}</details></figure>`,
          )
          .join('')}</div></section>`,
    )
    .join(
      '',
    )}<h2>${t('Machine checks', '机器检查')}</h2><pre>${escape(JSON.stringify(run.machine, null, 2))}</pre><details><summary>${t('Assessment history', '判断历史')} (${run.history.length})</summary>${run.history.map((a) => `<p>${escape(a.recordedAt + ' · ' + a.criterionId + ' · ' + a.status)}<br>${escape(a.note)}</p>`).join('')}</details><footer>${t('A snapshot of this run. Caller assessments are not an independent certification of correctness.', '这是本轮运行的快照。调用方判断不构成独立的正确性认证。')}</footer></main></body></html>`;
}
