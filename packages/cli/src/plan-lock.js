import { createHash } from 'node:crypto';
import { parseCase } from './case-format.js';
import { redact, normalizeUrl } from './options.js';

const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
export const fingerprint = (value) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
const definition = (data) => ({
  requirements: [...data.requirements].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  flows: data.flows,
});
const relative = (value, base) => {
  const u = new URL(normalizeUrl(value, base));
  const result = u.pathname + u.search + u.hash;
  if (redact(result) !== result)
    throw new Error('Lock policy URLs must not contain secret query parameters.');
  return result;
};
export function lockPolicy(options, failOn) {
  if (!['error', 'warning'].includes(failOn)) throw new Error('failOn must be error or warning.');
  // Verification replaces host flows. Credentials, origin, output and presentation are runtime concerns.
  return {
    entry: relative(options.url, options.url),
    pages: options.pages.map((p) => relative(p, options.url)),
    viewport: options.viewport,
    exclude: options.exclude,
    ignoreRules: options.ignoreRules,
    ignore: options.ignore.map((rule) => ({
      ...rule,
      ...(rule.page ? { page: relative(rule.page, options.url) } : {}),
    })),
    mask: options.mask,
    allowRequests: options.allowRequests,
    maxPages: options.maxPages,
    crawl: options.crawl,
    scroll: options.scroll,
    scrollSteps: options.scrollSteps,
    waitFor: options.waitFor,
    timeout: options.timeout,
    settle: options.settle,
    failOn,
  };
}
export function makePlanLock(data, policy) {
  const body = { schemaVersion: 1, kind: 'shiplens-plan-lock', plan: parseCase(data), policy };
  const value = { ...body, sha256: fingerprint(body) };
  if (Buffer.byteLength(JSON.stringify(value)) > 512 * 1024)
    throw new Error('Plan lock exceeds 512 KiB.');
  return structuredClone(value);
}
export function validatePlanLock(input) {
  if (
    !input ||
    Object.keys(input).sort().join(',') !== 'lock,sha256' ||
    !/^[a-f0-9]{64}$/.test(input.sha256)
  )
    throw new Error('acceptanceLock requires { lock, sha256 } with a trusted SHA-256.');
  const lock = structuredClone(input.lock);
  if (
    !lock ||
    Object.keys(lock).sort().join(',') !== 'kind,plan,policy,schemaVersion,sha256' ||
    lock.schemaVersion !== 1 ||
    lock.kind !== 'shiplens-plan-lock' ||
    !lock.policy ||
    typeof lock.policy !== 'object' ||
    Array.isArray(lock.policy)
  )
    throw new Error('Invalid acceptance lock.');
  if (Buffer.byteLength(JSON.stringify(lock)) > 512 * 1024)
    throw new Error('Plan lock exceeds 512 KiB.');
  const { sha256, ...body } = lock;
  if (sha256 !== input.sha256 || fingerprint(body) !== input.sha256)
    throw new Error('Acceptance lock fingerprint does not match the trusted SHA-256.');
  parseCase(lock.plan);
  return lock;
}
const preview = (value) =>
  value === undefined ? null : redact(JSON.stringify(value)).slice(0, 500);
export function inspectPlanLock(lock, data, policy) {
  const changes = [];
  let totalChanges = 0;
  const changed = (kind, field, before, after, criterionId) => {
    if (fingerprint({ value: before }) === fingerprint({ value: after })) return;
    totalChanges++;
    if (changes.length < 200)
      changes.push({
        kind,
        field,
        ...(criterionId ? { criterionId } : {}),
        before: preview(before),
        after: preview(after),
      });
  };
  let candidate;
  try {
    candidate = parseCase(data);
  } catch {
    return {
      kind: 'shiplens-plan-lock-check',
      passed: false,
      status: 'invalid-plan',
      lockSha256: lock.sha256,
      changes: [],
      totalChanges: 0,
      changesTruncated: false,
      note: 'Invalid candidate plan. No browser execution or acceptance verdict.',
    };
  }
  const prior = new Map(lock.plan.requirements.map((r) => [r.id, r]));
  const current = new Map(candidate.requirements.map((r) => [r.id, r]));
  if (
    prior.size !== lock.plan.requirements.length ||
    current.size !== candidate.requirements.length
  )
    throw new Error('Requirement IDs must be unique.');
  for (const [id, before] of prior) {
    const after = current.get(id);
    if (!after) {
      changed('requirement-removed', 'requirement', before, undefined, id);
      continue;
    }
    for (const field of new Set([...Object.keys(before), ...Object.keys(after)]))
      if (field !== 'id') changed('requirement-changed', field, before[field], after[field], id);
  }
  for (const [id, after] of current)
    if (!prior.has(id)) changed('requirement-added', 'requirement', undefined, after, id);
  changed('flows-changed', 'flows', lock.plan.flows, candidate.flows);
  for (const field of new Set([...Object.keys(lock.policy), ...Object.keys(policy)]))
    changed('policy-changed', field, lock.policy[field], policy[field]);
  const passed = totalChanges === 0;
  return {
    kind: 'shiplens-plan-lock-check',
    passed,
    status: passed ? 'matched' : 'changed',
    lockSha256: lock.sha256,
    definitionSha256: fingerprint(definition(candidate)),
    policySha256: fingerprint(policy),
    changes,
    totalChanges,
    changesTruncated: totalChanges > changes.length,
    note: 'Checks contract identity, not whether changes are weaker or legitimate. All definition/policy changes need review. Names, tags, object-key order and requirement order may change. No browser execution or website verdict.',
  };
}
export function planLockBlocked(inspection) {
  const error = new Error(
    'Approved acceptance standard changed. Inspect checkPlanLock; restore it or obtain a reviewed replacement lock. No browser run was started.',
  );
  error.code = 'SHIPLENS_PLAN_LOCK_BLOCKED';
  error.inspection = inspection;
  return error;
}
