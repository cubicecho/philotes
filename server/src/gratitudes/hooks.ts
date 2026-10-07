import { persons } from '@cubicecho/philotes-db/schema';
import type { OnWriteConfig } from '@vantreeseba/drizzle-graphql';
import { type ForeignKey, guardWrites } from '../graphql/write-guards.ts';
import { gratitudeInput } from './input.ts';

const PERSON: ForeignKey = { key: 'personId', entity: 'Person', parent: persons };

/** Validation and ownership hooks for gratitudes. */
export const gratitudeWriteHooks: OnWriteConfig = {
  gratitudes: guardWrites({ input: gratitudeInput, foreignKeys: [PERSON] }),
};
