import { schema as dbSchema } from '@philotes/db';
import { eq } from 'drizzle-orm';
import { GraphQLError } from 'graphql';
import { extendSchema, type GraphQLObjectType, type GraphQLSchema, parse } from 'graphql';
import jwt from 'jsonwebtoken';
import type { Context } from '../routes/graphql.ts';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

const AUTH_SDL = parse(`
  type RequestMagicLinkResult {
    ok: Boolean!
    magicLink: String
  }

  type AuthPayload {
    token: String!
    userId: ID!
  }

  extend type Mutation {
    requestMagicLink(email: String!): RequestMagicLinkResult!
    verifyMagicLink(token: String!): AuthPayload!
  }
`);

export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

export function signMagicToken(email: string): string {
  return jwt.sign({ email }, JWT_SECRET, { expiresIn: '15m' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export function verifyMagicToken(token: string): { email: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { email?: string };
    return payload.email ? { email: payload.email } : null;
  } catch {
    return null;
  }
}

export function requireAuth(ctx: Context): string {
  if (!ctx.userId) {
    throw new GraphQLError('Unauthenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx.userId;
}

export function applyAuthExtension(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, AUTH_SDL);
  const mutationType = extendedSchema.getType('Mutation') as GraphQLObjectType;
  const fields = mutationType.getFields();

  fields.requestMagicLink.resolve = async (_parent: unknown, args: { email: string }) => {
    const email = args.email.toLowerCase().trim();
    const token = signMagicToken(email);
    const magicLink = `${APP_URL}/auth/verify?token=${token}`;
    console.log(`\n[auth] Magic link for ${email}:\n${magicLink}\n`);
    if (process.env.NODE_ENV === 'production') {
      return { ok: true, magicLink: null };
    }
    return { ok: true, magicLink };
  };

  fields.verifyMagicLink.resolve = async (_parent: unknown, args: { token: string }, context: Context) => {
    const payload = verifyMagicToken(args.token);
    if (!payload) {
      throw new GraphQLError('Invalid or expired magic link', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    // biome-ignore lint/suspicious/noExplicitAny: drizzle-orm 1.0 column type compat
    const db = context.db as any;
    const email = payload.email;

    const existing = await db
      .select({ id: dbSchema.users.id })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.email, email));

    let userId: string;
    if (existing.length > 0) {
      userId = existing[0].id;
    } else {
      const [created] = await db
        .insert(dbSchema.users)
        .values({ email })
        .returning({ id: dbSchema.users.id });
      if (!created) throw new GraphQLError('Failed to create user');
      userId = created.id;
    }

    return { token: signToken(userId), userId };
  };

  return extendedSchema;
}
