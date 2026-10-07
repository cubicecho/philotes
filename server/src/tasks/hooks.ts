import { persons } from '@cubicecho/philotes-db/schema';
import type { OnWriteConfig } from '@vantreeseba/drizzle-graphql';
import { type ForeignKey, guardWrites } from '../graphql/write-guards.ts';
import { taskInput } from './input.ts';

const PERSON: ForeignKey = { key: 'personId', entity: 'Person', parent: persons };

/** Validation and ownership hooks for tasks. */
export const taskWriteHooks: OnWriteConfig = {
  tasks: guardWrites({ input: taskInput, foreignKeys: [PERSON] }),
};
