import { apiKey } from '@better-auth/api-key';
import type { DB } from '@cubicecho/philotes-db';
import { accounts, apikeys, sessions, users, verifications } from '@cubicecho/philotes-db/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, magicLink } from 'better-auth/plugins';
import { appUrl, authSecret, SESSION_STORE_MEMORY, sessionStore, smtpConfigured } from '../core/config.ts';
import { API_KEY_DEFAULTS, AUTH_DEFAULTS } from '../core/defaults.ts';
import { SECONDS_PER_MINUTE } from '../core/wire.ts';
import { sendMagicLinkEmail } from './email.ts';
import { memoryStorage } from './session-store.ts';

/** What every API key starts with, so one is recognisable in a config file or a leak scan. */
export const API_KEY_PREFIX = 'phlt_';
/** better-auth's id for the magic-link plugin. */
const MAGIC_LINK_PLUGIN_ID = 'magic-link';

/** What delivering one magic link is given. */
export interface MagicLink {
  email: string;
  /** The link to the app, with the token in its query. */
  url: string;
  token: string;
}

/** Overrides for tests. Production uses the defaults. */
export interface AuthOptions {
  /**
   * Signing secret.
   *
   * @defaultValue `authSecret()`
   */
  secret?: string;
  /**
   * Delivers a magic link. Tests pass a fake that captures it.
   *
   * @defaultValue `sendMagicLinkEmail` when SMTP is configured, otherwise magic links are off
   */
  sendMagicLink?: (link: MagicLink) => Promise<void>;
}

/**
 * Builds the better-auth instance. Server code calls `auth.api.*`, and no REST routes are mounted.
 *
 * @param db - Database client.
 * @param [opts] - Test overrides.
 * @returns The auth instance.
 */
export function createAuth(db: DB, { secret = authSecret(), sendMagicLink }: AuthOptions = {}) {
  const smtpDelivery = smtpConfigured() ? sendMagicLinkEmail : undefined;
  const deliver = sendMagicLink ?? smtpDelivery;
  const magicLinkPlugins =
    deliver === undefined
      ? []
      : [
          magicLink({
            // better-auth takes seconds.
            expiresIn: AUTH_DEFAULTS.magicLinkTtlMinutes * SECONDS_PER_MINUTE,
            storeToken: 'hashed',
            // Links go to the app, which calls verifyMagicLink. The REST verify route isn't mounted.
            sendMagicLink: ({ email, token }) =>
              deliver({ email, token, url: `${appUrl()}/auth/verify?token=${encodeURIComponent(token)}` }),
          }),
        ];
  const usesMemorySessions = sessionStore() === SESSION_STORE_MEMORY;
  const sessionStorage = usesMemorySessions ? { secondaryStorage: memoryStorage() } : {};

  return betterAuth({
    // The rc drizzle instance is keyed by relations, so the adapter can't discover tables itself.
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: users, session: sessions, account: accounts, verification: verifications, apikey: apikeys },
    }),
    secret,
    baseURL: appUrl(),
    advanced: { database: { generateId: 'uuid' } },
    ...sessionStorage,
    emailAndPassword: { enabled: true },
    // bearer: mutations return the raw token, and clients send it back as `Authorization: Bearer`.
    plugins: [
      bearer(),
      ...magicLinkPlugins,
      apiKey({
        defaultPrefix: API_KEY_PREFIX,
        startingCharactersConfig: { charactersLength: API_KEY_PREFIX.length + API_KEY_DEFAULTS.shownCharacters },
      }),
    ],
  });
}
export type Auth = ReturnType<typeof createAuth>;

/**
 * Whether this instance emails sign-in links.
 *
 * @param auth - The auth instance.
 * @returns True when it was built with a way to deliver them.
 */
export function sendsMagicLinks(auth: Auth): boolean {
  return auth.options.plugins.some((plugin) => plugin.id === MAGIC_LINK_PLUGIN_ID);
}

/**
 * Reads who a request's session belongs to.
 *
 * @param auth - The auth instance.
 * @param headers - The request's headers, carrying `Authorization: Bearer`.
 * @returns The user's id, or null when there is no live session.
 */
export async function sessionUserId(auth: Auth, headers: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers });
  return session?.user.id ?? null;
}
