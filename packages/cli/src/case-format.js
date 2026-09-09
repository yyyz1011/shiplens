import { z } from 'zod';
const text = (max) => z.string().trim().min(1).max(max);
export const requirementSchema = z.strictObject({
  id: text(80),
  description: text(2000),
  page: text(4096),
  flow: text(80).optional(),
  step: z.int().min(1).max(30).optional(),
  selector: text(2000).optional(),
  viewports: z
    .array(z.enum(['desktop', 'mobile']))
    .min(1)
    .max(2)
    .optional(),
});
export const stepSchema = z.strictObject({
  action: z.enum(['click', 'fill', 'press', 'select', 'waitFor', 'expectText']),
  selector: text(2000),
  timeout: z.int().min(1000).max(120000).optional(),
  value: z.string().max(10000).optional(),
  key: text(120).optional(),
  state: z.enum(['visible', 'hidden']).optional(),
  valueFromInput: text(80).optional(),
});
export const tagsSchema = z
  .array(text(40))
  .max(20)
  .refine((tags) => new Set(tags).size === tags.length);
export const portableCaseSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal('shiplens-case'),
  name: text(120),
  tags: tagsSchema,
  requirements: z.array(requirementSchema).min(1).max(50),
  flows: z
    .array(
      z.strictObject({
        name: text(80),
        page: text(4096),
        steps: z.array(stepSchema).min(1).max(30),
      }),
    )
    .max(20),
});
export function parseCase(value) {
  if (Buffer.byteLength(JSON.stringify(value) ?? '') > 512 * 1024)
    throw new Error('Case exceeds the 512 KiB import budget.');
  const result = portableCaseSchema.safeParse(value);
  if (!result.success)
    throw new Error('Invalid portable case. Check the version and documented fields.');
  return result.data;
}
export function parseTags(value) {
  const result = tagsSchema.safeParse(value);
  if (!result.success) throw new Error('tags requires up to 20 unique strings of 1–40 characters.');
  return result.data;
}
