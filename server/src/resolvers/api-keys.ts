import { apiKeys } from '@philotes/db';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { GraphQLError, type GraphQLObjectType, type GraphQLSchema, extendSchema, parse } from 'graphql';
import { generateApiKey } from '../api-keys.ts';
import type { Context } from '../routes/graphql.ts';
import { requireAuth } from './auth.ts';

const API_KEYS_SDL = parse(`
  type ApiKeyRecord {
    id: ID!
    name: String!
    keyPrefix: String!
    lastUsedAt: String
    expiresAt: String
    createdAt: String!
  }

  type CreateApiKeyResult {
    apiKey: ApiKeyRecord!
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

// biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
type AnyDB = any;

export function applyApiKeysExtension(schema: GraphQLSchema): GraphQLSchema {
  const extended = extendSchema(schema, API_KEYS_SDL);
  const queryType = extended.getType('Query') as GraphQLObjectType;
  const mutationType = extended.getType('Mutation') as GraphQLObjectType;
  const qf = queryType.getFields();
  const mf = mutationType.getFields();

  qf.myApiKeys.resolve = async (_parent: unknown, _args: unknown, ctx: Context) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;
    return db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
      .orderBy(desc(apiKeys.createdAt));
  };

  mf.myCreateApiKey.resolve = async (
    _parent: unknown,
    args: { input: { name: string; expiresAt?: string | null } },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;
    const { name, expiresAt } = args.input;

    if (!name?.trim()) {
      throw new GraphQLError('Name is required');
    }

    const { token, hash, prefix } = generateApiKey();

    const [row] = await db
      .insert(apiKeys)
      .values({
        userId,
        name: name.trim(),
        keyHash: hash,
        keyPrefix: prefix,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      });

    if (!row) throw new GraphQLError('Failed to create API key');

    return { apiKey: row, token };
  };

  mf.myRevokeApiKey.resolve = async (
    _parent: unknown,
    args: { id: string },
    ctx: Context,
  ) => {
    const userId = requireAuth(ctx);
    const db = ctx.db as AnyDB;

    const [key] = await db
      .select({ id: apiKeys.id, userId: apiKeys.userId })
      .from(apiKeys)
      .where(eq(apiKeys.id, args.id))
      .limit(1);

    if (!key) throw new GraphQLError(`API key not found`);
    if (key.userId !== userId) throw new GraphQLError('Forbidden');

    await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, args.id));

    return true;
  };

  return extended;
}
