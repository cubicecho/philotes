import { labels, persons } from '@cubicecho/philotes-db/schema';
import type { OnWriteConfig, WriteHookPayload, WriteHookPositions } from '@vantreeseba/drizzle-graphql';
import { badInput } from '../core/errors.ts';
import { type ForeignKey, guardWrites, writtenRows } from '../graphql/write-guards.ts';
import { addressInput, contactInfoInput, personInput } from './input.ts';

/** The person a detail row belongs to, who must be the caller's. */
const PERSON: ForeignKey = { key: 'personId', entity: 'Person', parent: persons };
const LABEL: ForeignKey = { key: 'labelId', entity: 'Label', parent: labels };

/** The column that names a person's stored picture. */
const AVATAR_PATH_KEY = 'avatarPath';

/**
 * Builds the `before` hook for `persons`: the input is validated, and no write may name the avatar.
 * A picture is served to whoever has a person pointing at it, so a path a client could set would let
 * it read any other user's picture. The upload route is the one writer.
 *
 * @returns The hook positions for `onWrite`.
 */
function guardPersonWrites(): WriteHookPositions {
  const { before: validate } = guardWrites({ input: personInput });
  return {
    /**
     * Refuses a written avatar path, then validates the rest.
     *
     * @param payload - The write about to run.
     * @throws BAD_USER_INPUT when a row names the avatar, or fails validation.
     */
    before: async (payload: WriteHookPayload) => {
      const namesAvatar = writtenRows(payload.args).some((row) => row[AVATAR_PATH_KEY] !== undefined);
      if (namesAvatar) {
        throw badInput('A picture is set by uploading it.');
      }
      await validate?.(payload);
    },
  };
}

/** Validation and ownership hooks for persons and what hangs off one. */
export const personWriteHooks: OnWriteConfig = {
  persons: guardPersonWrites(),
  addresses: guardWrites({ input: addressInput, foreignKeys: [PERSON] }),
  contactInfos: guardWrites({ input: contactInfoInput, foreignKeys: [PERSON] }),
  personLabels: guardWrites({ foreignKeys: [PERSON, LABEL] }),
};
