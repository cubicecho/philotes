import type { z } from 'zod';
import { badInput } from './errors.ts';

/**
 * Parses a value, turning a zod failure into BAD_USER_INPUT.
 *
 * @param schema - The zod schema.
 * @param value - What the client sent.
 * @returns The parsed value.
 * @throws A BAD_USER_INPUT error carrying every issue's message.
 */
export function parseOrThrow<Output>(schema: z.ZodType<Output>, value: unknown): Output {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw badInput(result.error.issues.map((issue) => issue.message).join('; '));
}
