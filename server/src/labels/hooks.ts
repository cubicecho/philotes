import type { OnWriteConfig } from '@vantreeseba/drizzle-graphql';
import { guardWrites } from '../graphql/write-guards.ts';
import { labelInput } from './input.ts';

/** Validation hooks for labels. A label points at no parent. */
export const labelWriteHooks: OnWriteConfig = {
  labels: guardWrites({ input: labelInput }),
};
