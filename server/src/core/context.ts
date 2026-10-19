import type { DB } from '@cubicecho/philotes-db';
import type { AuthHost } from '../auth/auth-host.ts';
import type { Auth } from '../auth/better-auth.ts';
import type { RateLimiter } from '../auth/rate-limit.ts';
import type { MailService } from '../mail/reader.ts';
import type { AvatarStore } from '../persons/avatar-store.ts';

/** `Context.ip` when Express gave no address, as when a test calls the schema directly. */
export const UNKNOWN_IP = 'unknown';

/** What every resolver receives. Built once per request. */
export interface Context {
  /** The Drizzle client the request reads and writes through. */
  db: DB;
  /** The better-auth instance for this request; auth resolvers call `ctx.auth.api.*`. */
  auth: Auth;
  /** Where `auth` came from. Pairing a provider rebuilds it, so later requests get the new one. */
  authHost: AuthHost;
  /** Sign-in throttle; the auth mutations call it. */
  limiter: RateLimiter;
  /** Client address, for rate-limit keys. Never an identity. */
  ip: string;
  /** The signed-in user, or null for an anonymous request. Resolvers call requireAuth(ctx) rather than reading this. */
  userId: string | null;
  /** Request headers; sign-out and better-auth calls need them. */
  headers: Headers;
  /** Where avatar images are kept, or null on a server that keeps none. A contact card's picture goes here. */
  avatarStore: AvatarStore | null;
  /** How mailboxes are reached and their passwords sealed, or null on a server with no MAIL_CREDENTIAL_KEYS. */
  mail: MailService | null;
}
