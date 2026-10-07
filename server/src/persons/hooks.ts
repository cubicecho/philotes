import { labels, persons } from '@cubicecho/philotes-db/schema';
import type { OnWriteConfig } from '@vantreeseba/drizzle-graphql';
import { type ForeignKey, guardWrites } from '../graphql/write-guards.ts';
import { addressInput, contactInfoInput, personInput, userPersonInput } from './input.ts';

/** The person a detail row belongs to, who must be in the caller's contacts. */
const PERSON: ForeignKey = { key: 'personId', entity: 'Person', parent: persons };
const LABEL: ForeignKey = { key: 'labelId', entity: 'Label', parent: labels };

/**
 * Validation and ownership hooks for persons and what hangs off one. `userPersons` has no generated
 * create, and an update may not point a row at a person outside the caller's contacts: a row there is
 * what puts a person in them.
 */
export const personWriteHooks: OnWriteConfig = {
  persons: guardWrites({ input: personInput }),
  userPersons: guardWrites({ input: userPersonInput, foreignKeys: [PERSON] }),
  addresses: guardWrites({ input: addressInput, foreignKeys: [PERSON] }),
  contactInfos: guardWrites({ input: contactInfoInput, foreignKeys: [PERSON] }),
  personLabels: guardWrites({ foreignKeys: [PERSON, LABEL] }),
};
