import type { OnWriteConfig } from '@vantreeseba/drizzle-graphql';
import { guardWrites } from '../graphql/write-guards.ts';
import { countingChanges } from '../persons/revision-hooks.ts';
import { labelInput } from './input.ts';

/** Validation hooks for labels. A label points at no parent, and its name is on the card of everyone who wears it. */
export const labelWriteHooks: OnWriteConfig = {
  labels: countingChanges('labels', guardWrites({ input: labelInput })),
};
