import { redact } from './options.js';
export const isExpired = (entry, now = Date.now()) =>
  !!entry.expires && now > Date.parse(entry.expires + 'T23:59:59.999Z');
export function applySuppressions(report, entries, now) {
  report.suppressed = [];
  report.ignoreWarnings = entries.flatMap((entry, index) =>
    isExpired(entry, now)
      ? [`Ignore entry ${index + 1} expired on ${entry.expires}; matching findings remain active.`]
      : [],
  );
  report.findings = report.findings.filter((finding) => {
    const index = entries.findIndex(
      (entry) =>
        !isExpired(entry, now) &&
        entry.rule === finding.code &&
        (!entry.page || redact(entry.page) === finding.url) &&
        (!entry.viewport || entry.viewport === finding.viewport) &&
        (!entry.fingerprint || entry.fingerprint === finding.fingerprint) &&
        (!entry.selector ||
          (entry.selector === finding.selector &&
            (!finding.elements ||
              finding.elements.every((element) => element.selector === entry.selector)))) &&
        (!entry.messageIncludes || finding.detail.includes(entry.messageIncludes)),
    );
    if (index < 0) return true;
    const entry = entries[index];
    report.suppressed.push({
      ...finding,
      suppression: {
        index: index + 1,
        reason: redact(entry.reason),
        ...(entry.expires ? { expires: entry.expires } : {}),
      },
    });
    return false;
  });
}
