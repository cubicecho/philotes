import { labels, persons } from '@cubicecho/philotes-db/schema';
import type { OnWriteConfig, WriteHookPayload, WriteHookPositions } from '@vantreeseba/drizzle-graphql';
import { badInput, requireAuth } from '../core/errors.ts';
import { type ForeignKey, guardWrites, WRITES_WITHOUT_ROWS, writtenRows } from '../graphql/write-guards.ts';
import { addressInput, contactInfoInput, NAMING_KEYS, personInput } from './input.ts';
import { normalizeWrittenContactInfos } from './normalized-values.ts';
import { countingChanges } from './revision-hooks.ts';

/** The person a detail row belongs to, who must be the caller's. */
const PERSON: ForeignKey = { key: 'personId', entity: 'Person', parent: persons };
const LABEL: ForeignKey = { key: 'labelId', entity: 'Label', parent: labels };

/** The column that names a person's stored picture. */
const AVATAR_PATH_KEY = 'avatarPath';

/** The write that makes new rows. */
const CREATE = 'insert';

/**
 * Builds the `before` hook for `persons`: the input is validated, a new person has something to be
 * called by, and no write may name the avatar. A picture is served to whoever has a person pointing at
 * it, so a path a client could set would let it read any other user's picture. The upload route is the
 * one writer.
 *
 * An update is not held to the naming rule: a `set` carries only the changed columns, and a contact a
 * phone synced with nothing but a number has to stay editable.
 *
 * @returns The hook positions for `onWrite`.
 */
function guardPersonWrites(): WriteHookPositions {
  const { before: validate } = guardWrites({ input: personInput });
  return {
    /**
     * Refuses a written avatar path, validates the rest, then checks each new person can be named.
     *
     * @param payload - The write about to run.
     * @throws BAD_USER_INPUT when a row names the avatar, fails validation, or is a new person with no
     * name, nickname or organization.
     */
    before: async (payload: WriteHookPayload) => {
      const rows = writtenRows(payload.args);
      const namesAvatar = rows.some((row) => row[AVATAR_PATH_KEY] !== undefined);
      if (namesAvatar) {
        throw badInput('A picture is set by uploading it.');
      }
      await validate?.(payload);

      const isCreate = payload.operation === CREATE;
      const hasUnnamed = rows.some((row) => NAMING_KEYS.every((key) => !row[key]));
      if (isCreate && hasUnnamed) {
        throw badInput('Give a name, a nickname or an organization.');
      }
    },
  };
}

/**
 * Builds the hooks for `contactInfos`: the usual validation and ownership check before the write, and
 * after it the written rows get their `normalizedValue`, which no input carries.
 *
 * @returns The hook positions for `onWrite`.
 */
function guardContactInfoWrites(): WriteHookPositions {
  const { before } = guardWrites({ input: contactInfoInput, foreignKeys: [PERSON] });
  return {
    before,
    /**
     * Works out the normalized value of each row the write produced.
     *
     * @param payload - The write that just ran.
     */
    after: async ({ operation, rows, context, tx }: WriteHookPayload) => {
      if (WRITES_WITHOUT_ROWS.has(operation)) {
        return;
      }
      await normalizeWrittenContactInfos(tx, requireAuth(context), operation === CREATE, rows);
    },
  };
}

/** Validation and ownership hooks for persons and what hangs off one. */
export const personWriteHooks: OnWriteConfig = {
  persons: countingChanges('persons', guardPersonWrites()),
  addresses: countingChanges('addresses', guardWrites({ input: addressInput, foreignKeys: [PERSON] })),
  contactInfos: countingChanges('contactInfos', guardContactInfoWrites()),
  personLabels: countingChanges('personLabels', guardWrites({ foreignKeys: [PERSON, LABEL] })),
};
