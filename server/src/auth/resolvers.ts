import { users } from '@cubicecho/philotes-db/schema';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { extendSchema, type GraphQLError, type GraphQLSchema, parse } from 'graphql';
import { z } from 'zod';
import { secureLocalNet } from '../core/config.ts';
import type { Context } from '../core/context.ts';
import { badInput, unauthenticated } from '../core/errors.ts';
import { parseOrThrow } from '../core/validation.ts';
import { HttpStatus } from '../core/wire.ts';
import { objectType } from '../graphql/object-type.ts';
import { sendsMagicLinks, sessionUserId } from './better-auth.ts';

/** The flows a caller can be throttled on. Each has its own budget per address and per account. */
const AuthFlow = {
  SignIn: 'signIn',
  SignUp: 'signUp',
  RequestSignIn: 'requestSignIn',
  VerifyMagicLink: 'verifyMagicLink',
} as const;
type AuthFlow = (typeof AuthFlow)[keyof typeof AuthFlow];

/** How an account made by a SECURE_LOCAL_NET sign-in is labelled in better-auth's hooks. */
const LOCAL_NET_METHOD = 'secure-local-net';

const AUTH_SDL = parse(`
  """Which sign-in methods this instance offers, so the sign-in page shows only those."""
  type AuthConfig {
    """Any email signs in at once, with no password and no link. Private networks only."""
    secureLocalNet: Boolean!
    """The instance can email sign-in links."""
    magicLink: Boolean!
    password: Boolean!
  }

  type AuthSession {
    """Sent back as \`Authorization: Bearer\`."""
    token: String!
    user: User!
  }

  type SignInResult {
    """A sign-in link was emailed."""
    sent: Boolean!
    """Set when the instance signs the caller in at once."""
    session: AuthSession
  }

  extend type Query {
    me: User
    authConfig: AuthConfig!
  }

  extend type Mutation {
    signUp(email: String!, password: String!, name: String!): AuthSession!
    signIn(email: String!, password: String!): AuthSession!
    requestSignIn(email: String!): SignInResult!
    verifyMagicLink(token: String!): AuthSession!
    signOut: Boolean!
  }
`);

const emailInput = z.email('Enter a valid email address.');
const nameInput = z.string().trim().min(1, 'Name is required.');

/** The user columns better-auth and the users table agree on. */
interface UserRow {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Picks the fields the generated `User` type serves, so nothing else better-auth returns rides along.
 *
 * @param user - A row from the users table, or better-auth's copy of one.
 * @returns The fields the `User` type resolves.
 */
function toUserNode(user: UserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    image: user.image ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Lower-cases and trims an email, so one account has one spelling.
 *
 * @param email - The address as typed.
 * @returns The normalised address.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Counts one attempt against the caller's address and, when given, the account.
 *
 * @param ctx - Request context.
 * @param flow - Which flow is being attempted.
 * @param [email] - The account the attempt is for.
 * @throws TOO_MANY_REQUESTS when either is over its budget.
 */
function throttle(ctx: Context, flow: AuthFlow, email?: string): void {
  const keys = [`${flow}:ip:${ctx.ip}`];
  if (email !== undefined) {
    keys.push(`${flow}:email:${normalizeEmail(email)}`);
  }
  ctx.limiter.hit(...keys);
}

/**
 * Turns a better-auth refusal into one of this API's coded errors.
 *
 * @param error - Whatever the auth call threw.
 * @returns The error to throw: UNAUTHENTICATED for bad credentials, BAD_USER_INPUT for other refusals.
 * @throws The original error when better-auth didn't raise it.
 */
function toGraphQLError(error: unknown): GraphQLError {
  const isRefusal = error instanceof APIError;
  if (isRefusal === false) {
    throw error;
  }
  const isBadCredentials = error.statusCode === HttpStatus.Unauthorized;
  return isBadCredentials ? unauthenticated(error.message) : badInput(error.message);
}

/**
 * Adds sign-in, sign-up, sign-out, `me` and `authConfig` to the schema.
 *
 * @param schema - The schema so far.
 * @returns The schema with the auth fields.
 */
export function applyAuthExtension(schema: GraphQLSchema): GraphQLSchema {
  const extendedSchema = extendSchema(schema, AUTH_SDL);
  const queries = objectType(extendedSchema, 'Query').getFields();
  const mutations = objectType(extendedSchema, 'Mutation').getFields();

  /**
   * Resolves `Query.me`. Anyone may ask.
   *
   * @param _parent - Unused.
   * @param _args - Unused.
   * @param ctx - Request context.
   * @returns The signed-in user, or null when nobody is signed in or the user's row is gone.
   */
  queries.me.resolve = async (_parent: unknown, _args: unknown, ctx: Context) => {
    if (ctx.userId === null) {
      return null;
    }
    const [user] = await ctx.db.select().from(users).where(eq(users.id, ctx.userId));
    return user === undefined ? null : toUserNode(user);
  };

  /**
   * Resolves `Query.authConfig`. Tells the sign-in page which ways of signing in this instance offers.
   * Anyone may ask.
   *
   * @param _parent - Unused.
   * @param _args - Unused.
   * @param ctx - Request context.
   * @returns `secureLocalNet` as configured, `magicLink` when the instance can email links, and `password`
   * as true, always.
   */
  queries.authConfig.resolve = (_parent: unknown, _args: unknown, ctx: Context) => ({
    secureLocalNet: secureLocalNet(),
    magicLink: sendsMagicLinks(ctx.auth),
    password: true,
  });

  /**
   * Resolves `Mutation.signUp`. Creates an account with a password and signs it in. Anyone may call it,
   * within the sign-in throttle.
   *
   * @param _parent - Unused.
   * @param args.email - The new account's address. Lower-cased and trimmed before use.
   * @param args.password - The password, which better-auth checks.
   * @param args.name - The user's display name. Trimmed, and not empty.
   * @param ctx - Request context.
   * @returns A session token and the new user.
   * @throws TOO_MANY_REQUESTS when the caller's address or the email is over its budget.
   * @throws BAD_USER_INPUT for an invalid email, an empty name, or a sign-up better-auth refuses.
   */
  mutations.signUp.resolve = async (
    _parent: unknown,
    args: { email: string; password: string; name: string },
    ctx: Context,
  ) => {
    throttle(ctx, AuthFlow.SignUp, args.email);
    const email = parseOrThrow(emailInput, normalizeEmail(args.email));
    const name = parseOrThrow(nameInput, args.name);
    try {
      const result = await ctx.auth.api.signUpEmail({ body: { email, password: args.password, name } });
      const token = result.token ?? null;
      if (token === null) {
        throw new Error('Sign-up returned no session token.');
      }
      return { token, user: toUserNode(result.user) };
    } catch (error) {
      throw toGraphQLError(error);
    }
  };

  /**
   * Resolves `Mutation.signIn`. Signs in with an email and a password. Anyone may call it, within the
   * sign-in throttle.
   *
   * @param _parent - Unused.
   * @param args.email - The account's address. Lower-cased and trimmed before use.
   * @param args.password - The account's password.
   * @param ctx - Request context.
   * @returns A session token and the user.
   * @throws TOO_MANY_REQUESTS when the caller's address or the email is over its budget.
   * @throws UNAUTHENTICATED for bad credentials.
   * @throws BAD_USER_INPUT for any other refusal from better-auth.
   */
  mutations.signIn.resolve = async (_parent: unknown, args: { email: string; password: string }, ctx: Context) => {
    throttle(ctx, AuthFlow.SignIn, args.email);
    try {
      const result = await ctx.auth.api.signInEmail({
        body: { email: normalizeEmail(args.email), password: args.password },
      });
      return { token: result.token, user: toUserNode(result.user) };
    } catch (error) {
      throw toGraphQLError(error);
    }
  };

  /**
   * Resolves `Mutation.requestSignIn`. Emails a sign-in link to the address. Under SECURE_LOCAL_NET it
   * signs the address in at once instead, creating the account when there is none. Anyone may call it,
   * within the sign-in throttle.
   *
   * @param _parent - Unused.
   * @param args.email - The account's address. Lower-cased and trimmed before use.
   * @param ctx - Request context.
   * @returns `sent: true` and no session once a link is emailed, or `sent: false` and a session under SECURE_LOCAL_NET.
   * @throws TOO_MANY_REQUESTS when the caller's address or the email is over its budget.
   * @throws BAD_USER_INPUT for an invalid email, or when the instance cannot email links.
   */
  mutations.requestSignIn.resolve = async (_parent: unknown, args: { email: string }, ctx: Context) => {
    throttle(ctx, AuthFlow.RequestSignIn, args.email);
    const email = parseOrThrow(emailInput, normalizeEmail(args.email));

    const sendsLink = secureLocalNet() === false;
    if (sendsLink) {
      const canEmailLinks = sendsMagicLinks(ctx.auth);
      if (canEmailLinks === false) {
        throw badInput('This instance cannot email sign-in links. Sign in with your password.');
      }
      await ctx.auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
      return { sent: true, session: null };
    }

    // SECURE_LOCAL_NET: the network is the credential, so the email alone opens the account.
    const { internalAdapter } = await ctx.auth.$context;
    const existing = await internalAdapter.findUserByEmail(email);
    const [localPart] = email.split('@');
    const user =
      existing?.user ??
      (await internalAdapter.createUser(
        { email, name: localPart, emailVerified: false },
        { method: LOCAL_NET_METHOD },
      ));
    const session = await internalAdapter.createSession(user.id);
    return { sent: false, session: { token: session.token, user: toUserNode(user) } };
  };

  /**
   * Resolves `Mutation.verifyMagicLink`. Trades the token from an emailed link for a session. Anyone may
   * call it, within the sign-in throttle.
   *
   * @param _parent - Unused.
   * @param args.token - The token from the link's query.
   * @param ctx - Request context.
   * @returns A session token and the user.
   * @throws TOO_MANY_REQUESTS when the caller's address is over its budget.
   * @throws UNAUTHENTICATED when the token is expired, used or unknown, or the instance does not email links.
   */
  mutations.verifyMagicLink.resolve = async (_parent: unknown, args: { token: string }, ctx: Context) => {
    throttle(ctx, AuthFlow.VerifyMagicLink);
    const canEmailLinks = sendsMagicLinks(ctx.auth);
    if (canEmailLinks === false) {
      throw unauthenticated('Invalid or expired sign-in link.');
    }
    try {
      const result = await ctx.auth.api.magicLinkVerify({ query: { token: args.token }, headers: new Headers() });
      return { token: result.token, user: toUserNode(result.user) };
    } catch {
      // Expired, used and unknown tokens answer the same.
      throw unauthenticated('Invalid or expired sign-in link.');
    }
  };

  /**
   * Resolves `Mutation.signOut`. Ends the session the request carries.
   *
   * @param _parent - Unused.
   * @param _args - Unused.
   * @param ctx - Request context.
   * @returns true after ending a live session, false when the request carried none.
   */
  mutations.signOut.resolve = async (_parent: unknown, _args: unknown, ctx: Context) => {
    const userId = await sessionUserId(ctx.auth, ctx.headers);
    if (userId === null) {
      return false;
    }
    await ctx.auth.api.signOut({ headers: ctx.headers });
    return true;
  };

  return extendedSchema;
}
