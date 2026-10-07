import { apikeys } from '@cubicecho/philotes-db/schema';
import { APIError } from 'better-auth/api';
import { and, desc, eq } from 'drizzle-orm';
import { extendSchema, type GraphQLSchema, parse } from 'graphql';
import { z } from 'zod';
import type { Context } from '../core/context.ts';
import { badInput, notFound, requireAuth } from '../core/errors.ts';
import { parseOrThrow } from '../core/validation.ts';
import { MS_PER_SECOND } from '../core/wire.ts';
import { objectType } from '../graphql/object-type.ts';

const API_KEYS_SDL = parse(`
  type ApiKeyRecord {
    id: ID!
    name: String!
    """The first characters of the key, enough to tell keys apart."""
    keyPrefix: String!
    lastUsedAt: String
    expiresAt: String
    createdAt: String!
  }

  type CreateApiKeyResult {
    apiKey: ApiKeyRecord!
    """The whole key. Shown once: only its hash is stored."""
    token: String!
  }

  input CreateApiKeyInput {
    name: String!
    expiresAt: String
  }

  extend type Query {
    myApiKeys: [ApiKeyRecord!]!
  }

  extend type Mutation {
    myCreateApiKey(input: CreateApiKeyInput!): CreateApiKeyResult!
    myRevokeApiKey(id: ID!): Boolean!
  }
`);

const nameInput = z.string().trim().min(1, 'Name is required.');
const idInput = z.uuid('API key not found');

/** The API key columns the app is shown. */
interface ApiKeyRow {
  id: string;
  name: string | null;
  start: string | null;
  lastRequest: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

/**
 * Shapes an API key for the `ApiKeyRecord` type.
 *
 * @param row - The stored key, or better-auth's copy of it.
 * @returns The record, with ISO timestamps.
 */
function toApiKeyRecord(row: ApiKeyRow) {
  return {
    id: row.id,
    name: row.name ?? '',
    keyPrefix: row.start ?? '',
    lastUsedAt: row.lastRequest?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Converts an expiry date to the lifetime better-auth takes.
 *
 * @param expiresAt - When the key should stop working, or nothing for never.
 * @returns Seconds from now, or null for a key that doesn't expire.
 * @throws BAD_USER_INPUT when the date is unreadable or not in the future.
 */
function lifetimeSeconds(expiresAt: string | null | undefined): number | null {
  const hasExpiry = expiresAt !== null && expiresAt !== undefined && expiresAt !== '';
  if (hasExpiry === false) {
    return null;
  }
  const seconds = Math.round((new Date(expiresAt).getTime() - Date.now()) / MS_PER_SECOND);
  const isFuture = Number.isFinite(seconds) && seconds > 0;
  if (isFuture === false) {
    throw badInput('The expiry date must be in the future.');
  }
  return seconds;
}

/**
 * Adds listing, creating and revoking the caller's API keys to the schema.
 *
 * @param schema - The schema so far.
 * @returns The schema with the API key fields.
 */
export function applyApiKeysExtension(schema: GraphQLSchema): GraphQLSchema {
  const extended = extendSchema(schema, API_KEYS_SDL);
  const queries = objectType(extended, 'Query').getFields();
  const mutations = objectType(extended, 'Mutation').getFields();

  queries.myApiKeys.resolve = async (_parent: unknown, _args: unknown, ctx: Context) => {
    const userId = requireAuth(ctx);
    const rows = await ctx.db
      .select()
      .from(apikeys)
      .where(eq(apikeys.referenceId, userId))
      .orderBy(desc(apikeys.createdAt));
    return rows.map(toApiKeyRecord);
  };

  mutations.myCreateApiKey.resolve = async (
    _parent: unknown,
    args: { input: { name: string; expiresAt?: string | null } },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    const name = parseOrThrow(nameInput, args.input.name);
    const expiresIn = lifetimeSeconds(args.input.expiresAt);
    try {
      // The calendar feed is polled by clients that can't back off, so keys carry no rate limit of their own.
      const created = await ctx.auth.api.createApiKey({ body: { userId, name, rateLimitEnabled: false, expiresIn } });
      return { apiKey: toApiKeyRecord(created), token: created.key };
    } catch (error) {
      if (error instanceof APIError) {
        throw badInput(error.message);
      }
      throw error;
    }
  };

  mutations.myRevokeApiKey.resolve = async (_parent: unknown, args: { id: string }, ctx: Context) => {
    const userId = requireAuth(ctx);
    // Postgres rejects a malformed uuid with an error, where "not found" is meant.
    const idCheck = idInput.safeParse(args.id);
    if (idCheck.success === false) {
      throw notFound('API key not found');
    }

    // One statement scoped to the caller, so another user's key and a missing key answer the same.
    const revoked = await ctx.db
      .delete(apikeys)
      .where(and(eq(apikeys.id, idCheck.data), eq(apikeys.referenceId, userId)))
      .returning({ id: apikeys.id });

    const isMissing = revoked.length === 0;
    if (isMissing) {
      throw notFound('API key not found');
    }
    return true;
  };

  return extended;
}
