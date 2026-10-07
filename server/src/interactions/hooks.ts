import { interactions, labels, persons } from '@cubicecho/philotes-db/schema';
import type { OnWriteConfig } from '@vantreeseba/drizzle-graphql';
import { type ForeignKey, guardWrites } from '../graphql/write-guards.ts';
import { interactionInput } from './input.ts';

const INTERACTION: ForeignKey = { key: 'interactionId', entity: 'Interaction', parent: interactions };
const LABEL: ForeignKey = { key: 'labelId', entity: 'Label', parent: labels };
const PERSON: ForeignKey = { key: 'personId', entity: 'Person', parent: persons };

/** Validation and ownership hooks for interactions and their tags. */
export const interactionWriteHooks: OnWriteConfig = {
  interactions: guardWrites({ input: interactionInput, foreignKeys: [PERSON] }),
  interactionTags: guardWrites({ foreignKeys: [INTERACTION, LABEL] }),
};
