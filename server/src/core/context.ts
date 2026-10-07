import type { DB } from '@cubicecho/philotes-db';
import type { Auth } from '../auth/better-auth.ts';
import type { RateLimiter } from '../auth/rate-limit.ts';

/** `Context.ip` when Express gave no address, as when a test calls the schema directly. */
export const UNKNOWN_IP = 'unknown';

/** What every resolver receives. Built once per request. */
export interface Context {
  /** The Drizzle client the request reads and writes through. */
  db: DB;
  /** better-auth instance; auth resolvers call `ctx.auth.api.*`. */
  auth: Auth;
  /** Sign-in throttle; the auth mutations call it. */
  limiter: RateLimiter;
  /** Client address, for rate-limit keys. Never an identity. */
  ip: string;
  /** The signed-in user, or null for an anonymous request. Resolvers call requireAuth(ctx) rather than reading this. */
  userId: string | null;
  /** Request headers; sign-out and better-auth calls need them. */
  headers: Headers;
}
