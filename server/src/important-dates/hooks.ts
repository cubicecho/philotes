import { importantDates, labels, persons } from '@cubicecho/philotes-db/schema';
import type { OnWriteConfig } from '@vantreeseba/drizzle-graphql';
import { type ForeignKey, guardWrites } from '../graphql/write-guards.ts';
import { importantDateInput } from './input.ts';

const IMPORTANT_DATE: ForeignKey = { key: 'importantDateId', entity: 'ImportantDate', parent: importantDates };
const LABEL: ForeignKey = { key: 'labelId', entity: 'Label', parent: labels };
const PERSON: ForeignKey = { key: 'personId', entity: 'Person', parent: persons };

/** Validation and ownership hooks for important dates and their tags. */
export const importantDateWriteHooks: OnWriteConfig = {
  importantDates: guardWrites({ input: importantDateInput, foreignKeys: [PERSON] }),
  importantDateTags: guardWrites({ foreignKeys: [IMPORTANT_DATE, LABEL] }),
};
