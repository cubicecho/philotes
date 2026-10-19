import type { DB } from '@cubicecho/philotes-db';
import { persons } from '@cubicecho/philotes-db/schema';
import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import type { Context } from '../core/context.ts';
import { OPERATION_LIMIT_DEFAULTS } from '../core/defaults.ts';
import { badInput, requireAuth } from '../core/errors.ts';
import { parseOrThrow } from '../core/validation.ts';
import { objectType } from '../graphql/object-type.ts';
import type { Transaction } from '../graphql/write-guards.ts';
import { defaultCountryOf } from '../persons/normalized-values.ts';
import { type Card, emptyCard } from '../vcard/card.ts';
import { CardRejectedError, readCards, SaveMode, saveCard } from '../vcard/store.ts';
import { type ContactCardInput, contactCardInput, cursorInput } from './input.ts';

// A person as a phone's own contacts hold them, for the Android sync adapter. It is the contact card
// `vcard/` reads and writes, as GraphQL types instead of vCard text: the adapter speaks JSON, which
// Android reads without a library, and gets the person's id, which "Open in Philotes" needs. What
// changed is found the way the people list finds it (`personsRevision`, `revision`, `personTombstones`).
// A phone holds no labels, picture or unmapped vCard lines, so a save keeps the person's own.

const CONTACT_CARDS_SDL = parse(`
  """A way to reach a person, as a contact card holds it."""
  type ContactCardInfo {
    type: String!
    value: String!
    kind: String
    label: String
    isPrimary: Boolean!
  }

  """A postal address, as a contact card holds it."""
  type ContactCardAddress {
    type: String!
    label: String
    line1: String!
    line2: String
    city: String
    state: String
    postalCode: String
    country: String
    isPrimary: Boolean!
  }

  """A person's own day: a birthday, an anniversary or a named date. \`date\` is YYYY-MM-DD."""
  type ContactCardDate {
    kind: String!
    name: String!
    date: String!
    hasYear: Boolean!
  }

  """A person as a phone's contacts hold them: the contact card without its labels, picture or unmapped lines."""
  type ContactCard {
    personId: UUID!
    """The user's change count when the person last changed."""
    revision: Float!
    """Where the card stands in the list, for \`after\`."""
    cursor: String!
    namePrefix: String
    firstName: String
    middleName: String
    lastName: String
    nameSuffix: String
    nickname: String
    organization: String
    department: String
    jobTitle: String
    about: String
    contactInfos: [ContactCardInfo!]!
    addresses: [ContactCardAddress!]!
    dates: [ContactCardDate!]!
  }

  input ContactCardInfoInput {
    type: String!
    value: String!
    kind: String
    label: String
    isPrimary: Boolean!
  }

  input ContactCardAddressInput {
    type: String!
    label: String
    line1: String!
    line2: String
    city: String
    state: String
    postalCode: String
    country: String
    isPrimary: Boolean!
  }

  input ContactCardDateInput {
    kind: String!
    name: String!
    date: String!
    hasYear: Boolean!
  }

  """A contact as the phone holds it, to be saved as the whole truth about the person."""
  input ContactCardInput {
    """The person, or null for a contact made on the phone."""
    personId: UUID
    """The revision the phone last saw. Required with \`personId\`: a person changed since is not written."""
    ifRevision: Float
    namePrefix: String
    firstName: String
    middleName: String
    lastName: String
    nameSuffix: String
    nickname: String
    organization: String
    department: String
    jobTitle: String
    about: String
    contactInfos: [ContactCardInfoInput!]!
    addresses: [ContactCardAddressInput!]!
    dates: [ContactCardDateInput!]!
  }

  enum ContactCardOutcome {
    CREATED
    UPDATED
    """The person changed or was deleted after \`ifRevision\`. Nothing was written."""
    CONFLICT
  }

  type SaveContactCardResult {
    outcome: ContactCardOutcome!
    """The person as now stored. On a conflict, the server's version, or null when they were deleted."""
    card: ContactCard
  }

  extend type Query {
    """The caller's people as contact cards, ordered by id. \`since\` leaves out those not changed after it."""
    contactCards(since: Float, after: String, limit: Int): [ContactCard!]!
  }

  extend type Mutation {
    """Saves a contact a phone made or changed, replacing what the person held, unless they changed first."""
    saveContactCard(input: ContactCardInput!): SaveContactCardResult!
  }
`);

/** How a save ended, as `ContactCardOutcome` names it. */
export const ContactCardOutcome = {
  Created: 'CREATED',
  Updated: 'UPDATED',
  Conflict: 'CONFLICT',
} as const;
export type ContactCardOutcome = (typeof ContactCardOutcome)[keyof typeof ContactCardOutcome];

/** A `ContactCard` as resolved. */
export interface ContactCard extends Omit<Card, 'uid' | 'labels' | 'photo' | 'extra'> {
  personId: string;
  revision: number;
  cursor: string;
}

/** A `SaveContactCardResult` as resolved. */
export interface SaveContactCardResult {
  outcome: ContactCardOutcome;
  card: ContactCard | null;
}

interface ContactCardsArgs {
  since?: number | null;
  after?: string | null;
  limit?: number | null;
}

interface SaveContactCardArgs {
  input: unknown;
}

/**
 * Reads the given people as contact cards.
 *
 * @param db - The client or transaction to read with.
 * @param userId - The user.
 * @param ids - The people.
 * @returns Their cards, ordered by id.
 */
async function contactCardsOf(db: DB | Transaction, userId: string, ids: string[]): Promise<ContactCard[]> {
  if (ids.length === 0) {
    return [];
  }
  const stored = await readCards(db, userId, { which: inArray(persons.id, ids) });
  const cards = stored.map(({ personId, revision, card }): ContactCard => {
    const { uid: _uid, labels: _labels, photo: _photo, extra: _extra, ...onPhone } = card;
    return { ...onPhone, personId, revision, cursor: personId };
  });
  // By code point, as Postgres orders a uuid, so that the order matches the cursor's.
  return cards.sort((a, b) => (a.personId < b.personId ? -1 : 1));
}

/**
 * Builds the card a save writes: the phone's fields over what the person holds that a phone does not.
 *
 * @param input - What the phone sent.
 * @param current - The person's card now, or null for a new person.
 * @returns The card.
 */
function cardToSave(input: ContactCardInput, current: Card | null): Card {
  const { personId: _personId, ifRevision: _ifRevision, ...fromPhone } = input;
  return { ...(current ?? emptyCard()), ...fromPhone };
}

/**
 * Adds `contactCards` and `saveContactCard` to the schema.
 *
 * @param schema - The schema so far.
 * @returns The schema with the contact card fields.
 */
export function applyContactCardsExtension(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, CONTACT_CARDS_SDL);
  const { defaultPageSize, maxPageSize } = OPERATION_LIMIT_DEFAULTS;

  const contactCardsField = objectType(extendedSchema, 'Query').getFields().contactCards;
  // Priced like a generated list: a page of cards costs its size times one card.
  contactCardsField.extensions = {
    ...contactCardsField.extensions,
    complexity: ({ args, childComplexity }: { args: ContactCardsArgs; childComplexity: number }) =>
      (args.limit ?? defaultPageSize) * Math.max(childComplexity, 1),
  };

  /**
   * Resolves `Query.contactCards`.
   *
   * @param _parent - Unused.
   * @param args.since - Leaves out the people not changed after this revision.
   * @param args.after - The cursor of the last card of the page before.
   * @param args.limit - The page size, up to the largest page.
   * @param context - Request context.
   * @returns A page of cards.
   * @throws UNAUTHENTICATED when nobody is signed in.
   * @throws BAD_USER_INPUT when the limit is out of range.
   */
  contactCardsField.resolve = async (
    _parent: unknown,
    args: ContactCardsArgs,
    context: Context,
  ): Promise<ContactCard[]> => {
    const userId = requireAuth(context);
    const limit = args.limit ?? defaultPageSize;
    const isOutOfRange = limit < 1 || limit > maxPageSize;
    if (isOutOfRange) {
      throw badInput(`limit must be between 1 and ${maxPageSize}.`);
    }
    const after = args.after == null ? null : parseOrThrow(cursorInput, args.after);
    const page = await context.db
      .select({ id: persons.id })
      .from(persons)
      .where(
        and(
          eq(persons.userId, userId),
          args.since == null ? undefined : gt(persons.revision, args.since),
          after === null ? undefined : gt(persons.id, after),
        ),
      )
      .orderBy(asc(persons.id))
      .limit(limit);
    return contactCardsOf(
      context.db,
      userId,
      page.map((row) => row.id),
    );
  };

  /**
   * Resolves `Mutation.saveContactCard`. The person becomes exactly what the phone holds, in one
   * transaction, and keeps their labels, picture and the vCard lines Philotes has no field for. A person
   * who changed after `ifRevision`, or is gone, is left alone and returned as they are.
   *
   * @param _parent - Unused.
   * @param args.input - The contact.
   * @param context - Request context.
   * @returns How the save ended, and the person as now stored.
   * @throws UNAUTHENTICATED when nobody is signed in.
   * @throws BAD_USER_INPUT when the contact cannot be saved as it is.
   */
  objectType(extendedSchema, 'Mutation').getFields().saveContactCard.resolve = async (
    _parent: unknown,
    args: SaveContactCardArgs,
    context: Context,
  ): Promise<SaveContactCardResult> => {
    const userId = requireAuth(context);
    const input = parseOrThrow(contactCardInput, args.input);
    const isUnguarded = input.personId !== null && input.ifRevision === null;
    if (isUnguarded) {
      throw badInput('ifRevision is required to change a person.');
    }
    try {
      return await context.db.transaction(async (tx: Transaction) => {
        const country = await defaultCountryOf(tx, userId);
        if (input.personId === null) {
          const saved = await saveCard(tx, userId, cardToSave(input, null), {
            mode: SaveMode.Replace,
            personId: null,
            country,
            avatars: null,
          });
          const [card] = await contactCardsOf(tx, userId, [saved.personId]);
          return { outcome: ContactCardOutcome.Created, card: card ?? null };
        }
        const [person] = await tx
          .select({ id: persons.id, revision: persons.revision })
          .from(persons)
          .where(and(eq(persons.userId, userId), eq(persons.id, input.personId)))
          .for('update');
        const hasMoved = person === undefined || person.revision !== input.ifRevision;
        if (hasMoved) {
          const [card] = person === undefined ? [] : await contactCardsOf(tx, userId, [person.id]);
          return { outcome: ContactCardOutcome.Conflict, card: card ?? null };
        }
        const [current] = await readCards(tx, userId, { which: eq(persons.id, person.id) });
        // Pictures are left alone: `avatars: null`, and the card keeps no photo to write.
        await saveCard(tx, userId, cardToSave(input, current?.card ?? null), {
          mode: SaveMode.Replace,
          personId: person.id,
          country,
          avatars: null,
        });
        const [card] = await contactCardsOf(tx, userId, [person.id]);
        return { outcome: ContactCardOutcome.Updated, card: card ?? null };
      });
    } catch (error) {
      if (error instanceof CardRejectedError) {
        throw badInput(error.message);
      }
      throw error;
    }
  };

  return extendedSchema;
}
