import { persons } from '@cubicecho/philotes-db/schema';
import type { OnWriteConfig } from '@vantreeseba/drizzle-graphql';
import { type ForeignKey, guardWrites } from '../graphql/write-guards.ts';
import { personRelationshipInput, relationshipTypeInput } from './input.ts';

const FROM_PERSON: ForeignKey = { key: 'fromPersonId', entity: 'Person', parent: persons };
const TO_PERSON: ForeignKey = { key: 'toPersonId', entity: 'Person', parent: persons };

/** Validation and ownership hooks for relationships between people, and the user's own type names. */
export const relationshipWriteHooks: OnWriteConfig = {
  personRelationships: guardWrites({ input: personRelationshipInput, foreignKeys: [FROM_PERSON, TO_PERSON] }),
  relationshipTypes: guardWrites({ input: relationshipTypeInput }),
};
