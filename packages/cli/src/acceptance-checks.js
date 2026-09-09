import { z } from 'zod';

export const checksSchema = z
  .array(
    z.strictObject({
      operator: z.enum(['equals', 'contains', 'excludes']),
      value: z
        .string()
        .min(1)
        .max(2000)
        .refine((s) => !!s.trim()),
    }),
  )
  .min(1)
  .max(10);

export function parseChecks(checks, evaluation) {
  if (evaluation !== undefined && !['manual', 'checks'].includes(evaluation))
    throw new Error('evaluation must be manual or checks.');
  if (checks === undefined) {
    if (evaluation === 'checks') throw new Error('Check evaluation requires explicit checks.');
    return undefined;
  }
  const parsed = checksSchema.safeParse(checks);
  if (!parsed.success)
    throw new Error(
      'checks requires 1–10 equals/contains/excludes text checks, each with a nonblank value up to 2000 characters.',
    );
  return parsed.data;
}

export const normalizeText = (s) => s.replace(/\s+/g, ' ').trim();
export function evaluateText(checks, text) {
  const observed = normalizeText(text);
  return checks.map((check) => {
    const expected = normalizeText(check.value);
    return check.operator === 'equals'
      ? observed === expected
      : check.operator === 'contains'
        ? observed.includes(expected)
        : !observed.includes(expected);
  });
}
export async function verifyChecks(requirement, evidence, read) {
  const results = [],
    evidenceIds = [];
  for (const viewport of requirement.viewports) {
    const entries = evidence.filter(
      (e) => e.criterionIds.includes(requirement.id) && e.viewport === viewport,
    );
    if (!entries.length)
      results.push({ viewport, status: 'needs-evidence', reason: 'missing-viewport' });
    for (const entry of entries) {
      evidenceIds.push(entry.evidenceId);
      let proof;
      try {
        proof = await read(entry.evidenceId);
      } catch {
        /* Unavailable proof cannot satisfy a check. */
      }
      const complete =
        entry.complete &&
        proof?.image &&
        proof?.observation &&
        typeof proof.observation.text === 'string' &&
        !proof.observation.textTruncated &&
        !proof.observation.elementsTruncated;
      if (!complete) {
        results.push({
          evidenceId: entry.evidenceId,
          viewport,
          status: 'needs-evidence',
          reason: 'incomplete-evidence',
        });
        continue;
      }
      for (const [checkIndex, passed] of evaluateText(
        requirement.checks,
        proof.observation.text,
      ).entries()) {
        results.push({
          evidenceId: entry.evidenceId,
          viewport,
          checkIndex,
          status: passed ? 'pass' : 'fail',
          reason: passed ? 'matched' : 'text-mismatch',
        });
      }
    }
  }
  return {
    source: 'deterministic-checks',
    status: results.some((r) => r.status === 'fail')
      ? 'fail'
      : results.some((r) => r.status === 'needs-evidence')
        ? 'needs-evidence'
        : 'pass',
    evidenceIds,
    results,
  };
}
