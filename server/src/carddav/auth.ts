import type { DB } from '@cubicecho/philotes-db';
import { users } from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { API_KEY_PREFIX, type Auth } from '../auth/better-auth.ts';
import { BASIC_AUTH_SCHEME, HttpStatus } from '../core/wire.ts';
import { AUTH_REALM } from './dav.ts';

/** Who a request is from, left on `res.locals` for the handlers behind the guard. */
export interface DavLocals {
  userId: string;
  /** The user's email, which the address book shows as the account's name. */
  email: string;
}

/** A response behind the guard. */
export type DavUserResponse = Response<unknown, DavLocals>;

/** What the guard is built from. */
export interface DavAuthDeps {
  /** Drizzle client. */
  db: DB;
  /** Verifies the API key. */
  auth: Auth;
}

/** What separates the user name from the password once the header is decoded. */
const CREDENTIAL_SEPARATOR = ':';

/**
 * Reads the user name and password out of an `Authorization: Basic` header.
 *
 * @param header - The header's value, if the request carries one.
 * @returns The two, or null when the header is missing or is not Basic.
 */
function readBasicCredentials(header: string | undefined): { username: string; password: string } | null {
  const [scheme, encoded] = (header ?? '').trim().split(/\s+/);
  const isBasic = scheme?.toLowerCase() === BASIC_AUTH_SCHEME.toLowerCase() && encoded !== undefined;
  if (isBasic === false) {
    return null;
  }
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const split = decoded.indexOf(CREDENTIAL_SEPARATOR);
  if (split < 0) {
    return null;
  }
  return { username: decoded.slice(0, split), password: decoded.slice(split + 1) };
}

/**
 * Finds the user a pair of credentials belongs to: the user name is their email, the password one of
 * their API keys.
 *
 * @param deps - The database and the auth instance.
 * @param header - The `Authorization` header, if the request carries one.
 * @returns The user, or null when the credentials are not theirs.
 */
async function userOf({ db, auth }: DavAuthDeps, header: string | undefined): Promise<DavLocals | null> {
  const credentials = readBasicCredentials(header);
  const isApiKey = credentials?.password.startsWith(API_KEY_PREFIX) === true;
  if (credentials === null || isApiKey === false) {
    return null;
  }
  // Also records the use, which is what the settings page shows as "last used".
  const { valid, key: verified } = await auth.api.verifyApiKey({ body: { key: credentials.password } });
  const isRefused = valid === false || verified === null;
  if (isRefused) {
    return null;
  }
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, verified.referenceId)).limit(1);
  // A key is asked to name its owner, so that one pasted into the wrong account is noticed.
  const isOwner = user?.email.toLowerCase() === credentials.username.trim().toLowerCase();
  return user && isOwner ? { userId: verified.referenceId, email: user.email } : null;
}

/**
 * Lets a request through only when it carries a user's email and one of their API keys.
 *
 * @param deps - The database and the auth instance.
 * @param req - The request, carrying `Authorization: Basic`.
 * @param res - The response; `res.locals` receives the user.
 * @param next - Continues to the handler.
 * @returns Nothing.
 */
export async function requireDavUser(
  deps: DavAuthDeps,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await userOf(deps, req.get('authorization'));
  if (user === null) {
    res
      .status(HttpStatus.Unauthorized)
      .set('WWW-Authenticate', `${BASIC_AUTH_SCHEME} realm="${AUTH_REALM}", charset="UTF-8"`)
      .send('Sign in with your email and an API key.');
    return;
  }
  Object.assign(res.locals, user);
  next();
}
