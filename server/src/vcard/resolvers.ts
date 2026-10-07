import type { DB } from '@cubicecho/philotes-db';
import { normalizeContactValue } from '@cubicecho/philotes-db/normalize';
import { ContactType, contactInfos, persons } from '@cubicecho/philotes-db/schema';
import { and, eq } from 'drizzle-orm';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import { findOwnPersonByEmail, type ImportContactsResult, reportFailure } from '../contact-import/resolvers.ts';
import type { Context } from '../core/context.ts';
import { badInput, requireAuth } from '../core/errors.ts';
import { objectType } from '../graphql/object-type.ts';
import type { Transaction } from '../graphql/write-guards.ts';
import { defaultCountryOf } from '../persons/normalized-values.ts';
import { type Card, VCardSyntaxError } from './card.ts';
import { parseVCards } from './decode.ts';
import { formattedNameOf, writeVCards } from './encode.ts';
import { CardRejectedError, findPersonByUid, readCards, SaveMode, saveCard } from './store.ts';

const VCARD_SDL = parse(`
  extend type Query {
    """Every one of the caller's people as one vCard 3.0 file, without their pictures."""
    exportVCards: String!
  }

  extend type Mutation {
    """Adds the people in a vCard file. A card for someone the caller already has only adds what is missing."""
    importVCards(vcf: String!): ImportContactsResult!
  }
`);

interface ImportVCardsArgs {
  vcf: string;
}

/**
 * Says who a card is for in a message to the caller.
 *
 * @param card - The card.
 * @returns The person's name, or a stand-in when the card names nobody.
 */
function nameOf(card: Card): string {
  return formattedNameOf(card) || 'a card with no name';
}

/**
 * Reads a name part for comparing: trimmed, in lower case, and empty when there is none.
 *
 * @param part - The part.
 * @returns What two equal parts share.
 */
function comparable(part: string | null): string {
  return (part ?? '').trim().toLowerCase();
}

/**
 * Finds the person among a user's own who has a card's first phone number and its name. The number
 * alone is not enough: a household shares one.
 *
 * @param db - The client or transaction to read with.
 * @param userId - The user whose people are searched.
 * @param card - The card.
 * @param country - The country that numbers without a country code are read in.
 * @returns The person's id, or null when the card has no number or nobody matches. The oldest wins.
 */
async function findOwnPersonByPhoneAndName(
  db: DB | Transaction,
  userId: string,
  card: Card,
  country: string,
): Promise<string | null> {
  const phone = card.contactInfos.find((info) => info.type === ContactType.Phone)?.value ?? null;
  if (phone === null) {
    return null;
  }
  const withNumber = await db
    .select({ id: persons.id, firstName: persons.firstName, lastName: persons.lastName })
    .from(contactInfos)
    .innerJoin(persons, eq(persons.id, contactInfos.personId))
    .where(
      and(
        eq(contactInfos.userId, userId),
        eq(contactInfos.type, ContactType.Phone),
        eq(contactInfos.normalizedValue, normalizeContactValue(ContactType.Phone, phone, country)),
      ),
    )
    .orderBy(persons.createdAt);
  const match = withNumber.find(
    (person) =>
      comparable(person.firstName) === comparable(card.firstName) &&
      comparable(person.lastName) === comparable(card.lastName),
  );
  return match?.id ?? null;
}

/**
 * Finds the person a card is for among a user's own: by its UID, else by its first email, else by its
 * first phone number and its name.
 *
 * @param db - The client or transaction to read with.
 * @param userId - The user whose people are searched.
 * @param card - The card.
 * @param country - The country that numbers without a country code are read in.
 * @returns The person's id, or null when the card is for somebody new.
 */
async function findOwnPersonFor(
  db: DB | Transaction,
  userId: string,
  card: Card,
  country: string,
): Promise<string | null> {
  const byUid = card.uid === null ? null : await findPersonByUid(db, userId, card.uid);
  if (byUid !== null) {
    return byUid;
  }
  const email = card.contactInfos.find((info) => info.type === ContactType.Email)?.value ?? null;
  const byEmail = email === null ? null : await findOwnPersonByEmail(db, userId, email);
  return byEmail ?? (await findOwnPersonByPhoneAndName(db, userId, card, country));
}

/**
 * Adds `exportVCards` and `importVCards` to the schema.
 *
 * @param schema - The schema so far, which already has `ImportContactsResult`.
 * @returns The schema with the vCard fields.
 */
export function applyVCardExtension(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, VCARD_SDL);

  /**
   * Resolves `Query.exportVCards`.
   *
   * @param _parent - Unused.
   * @param _args - Unused.
   * @param context - Request context.
   * @returns The `.vcf` file's text, empty when the caller has nobody.
   * @throws UNAUTHENTICATED when nobody is signed in.
   */
  objectType(extendedSchema, 'Query').getFields().exportVCards.resolve = async (
    _parent: unknown,
    _args: unknown,
    context: Context,
  ): Promise<string> => {
    const userId = requireAuth(context);
    const stored = await readCards(context.db, userId);
    return writeVCards(stored.map(({ card, updatedAt }) => ({ card, options: { revisedAt: updatedAt } })));
  };

  /**
   * Resolves `Mutation.importVCards`. Each card is saved on its own, so one that fails is reported in
   * `errors` and the rest still go in. A card is for a person the caller already has when it carries
   * that person's UID, or else its first email is one of theirs, or else its first phone number and its
   * name are theirs; that person then keeps what they hold and gains only what they lack.
   *
   * @param _parent - Unused.
   * @param args.vcf - The file's text, in vCard 3.0 or 4.0.
   * @param context - Request context.
   * @returns How many people were added, how many were merged into, how many cards named nobody, and a
   * message for each failure.
   * @throws UNAUTHENTICATED when nobody is signed in.
   * @throws BAD_USER_INPUT when the text is not a vCard file.
   */
  objectType(extendedSchema, 'Mutation').getFields().importVCards.resolve = async (
    _parent: unknown,
    args: ImportVCardsArgs,
    context: Context,
  ): Promise<ImportContactsResult> => {
    const userId = requireAuth(context);
    const { db, avatarStore } = context;

    let cards: Card[];
    try {
      cards = parseVCards(args.vcf);
    } catch (error) {
      if (error instanceof VCardSyntaxError) {
        throw badInput(error.message);
      }
      throw error;
    }
    const country = await defaultCountryOf(db, userId);
    const result: ImportContactsResult = { imported: 0, merged: 0, skipped: 0, errors: [] };

    for (const card of cards) {
      const isNameless = formattedNameOf(card) === '';
      if (isNameless) {
        result.skipped += 1;
        continue;
      }
      try {
        const saved = await db.transaction(async (tx) => {
          const personId = await findOwnPersonFor(tx, userId, card, country);
          // A card merged into someone must not bring a second UID for them.
          const toSave = personId === null ? card : { ...card, uid: null };
          return saveCard(tx, userId, toSave, { mode: SaveMode.Merge, personId, country, avatars: avatarStore });
        });
        if (saved.isNew) {
          result.imported += 1;
        } else {
          result.merged += 1;
        }
      } catch (error) {
        if (error instanceof CardRejectedError) {
          result.errors.push(`Failed to import ${nameOf(card)}: ${error.message}`);
        } else {
          reportFailure(result.errors, `Failed to import ${nameOf(card)}`, error);
        }
      }
    }
    return result;
  };

  return extendedSchema;
}
