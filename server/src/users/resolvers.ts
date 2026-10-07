import { isPhoneCountry } from '@cubicecho/philotes-db/normalize';
import { users } from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import { z } from 'zod';
import { loadUserNode } from '../auth/resolvers.ts';
import type { Context } from '../core/context.ts';
import { requireAuth } from '../core/errors.ts';
import { parseOrThrow } from '../core/validation.ts';
import { objectType } from '../graphql/object-type.ts';
import { renormalizeContactInfos } from '../persons/normalized-values.ts';

const USER_SETTINGS_SDL = parse(`
  extend type Mutation {
    """
    Sets the country the caller's phone numbers are read in when they are written without a country
    code, as an ISO 3166-1 alpha-2 code such as "US". Every number the caller has stored is read again.
    """
    setDefaultCountry(country: String!): User!
  }
`);

/** A country code, upper-cased, that phone numbers can be read in. */
const countryInput = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isPhoneCountry, 'Choose a country by its two-letter code, such as US.');

/**
 * Adds the mutations that change the caller's own settings. The generated writes for `users` are off, so
 * each setting has its own.
 *
 * @param schema - The schema so far.
 * @returns The schema with the settings mutations.
 */
export function applyUserSettingsExtension(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, USER_SETTINGS_SDL);
  const mutations = objectType(extendedSchema, 'Mutation').getFields();

  /**
   * Resolves `Mutation.setDefaultCountry`. Stores the country and, in the same transaction, works out
   * the normalized form of every phone and fax number the caller has, since that form depends on it.
   *
   * @param _parent - Unused.
   * @param args.country - The ISO 3166-1 alpha-2 code, in either case.
   * @param ctx - Request context.
   * @returns The caller, with the new country.
   * @throws UNAUTHENTICATED when nobody is signed in.
   * @throws BAD_USER_INPUT when the code is not a country.
   */
  mutations.setDefaultCountry.resolve = async (_parent: unknown, args: { country: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    const defaultCountry = parseOrThrow(countryInput, args.country);

    await ctx.db.transaction(async (tx) => {
      await tx.update(users).set({ defaultCountry }).where(eq(users.id, userId));
      await renormalizeContactInfos(tx, userId);
    });

    return loadUserNode(ctx, userId);
  };

  return extendedSchema;
}
