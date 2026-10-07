import { labels, notes, persons } from '@cubicecho/philotes-db/schema';
import type { OnWriteConfig } from '@vantreeseba/drizzle-graphql';
import { type ForeignKey, guardWrites } from '../graphql/write-guards.ts';
import { noteInput } from './input.ts';

const NOTE: ForeignKey = { key: 'noteId', entity: 'Note', parent: notes };
const LABEL: ForeignKey = { key: 'labelId', entity: 'Label', parent: labels };
const PERSON: ForeignKey = { key: 'personId', entity: 'Person', parent: persons };
const MENTIONED_PERSON: ForeignKey = { key: 'mentionedPersonId', entity: 'Person', parent: persons };

/** Validation and ownership hooks for notes, their tags and their mentions. */
export const noteWriteHooks: OnWriteConfig = {
  notes: guardWrites({ input: noteInput, foreignKeys: [PERSON] }),
  noteTags: guardWrites({ foreignKeys: [NOTE, LABEL] }),
  noteMentions: guardWrites({ foreignKeys: [NOTE, MENTIONED_PERSON] }),
};
