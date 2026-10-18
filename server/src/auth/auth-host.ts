import type { DB } from '@cubicecho/philotes-db';
import type { OidcConfig } from '../core/config.ts';
import { effectiveOidc } from '../sso/settings.ts';
import { type Auth, type AuthOptions, createAuth, defaultSessionStorage } from './better-auth.ts';

// better-auth fixes its plugins when it is created, and the OIDC provider is one
// of them. Pairing or unpairing a provider while the server runs therefore means
// a new instance, so everything that signs people in asks this host for the
// current one on each request instead of holding on to one from boot.
//
// Sessions must outlive a rebuild, so every instance the host builds shares one
// session store: with SESSION_STORE=memory, a store per instance would sign
// everyone out whenever a provider is paired.

/** Where the current auth instance is. */
export interface AuthHost {
  /** The auth instance to use for this request. */
  current(): Auth;
  /** The OIDC provider `current()` was built with, or null. */
  oidc(): OidcConfig | null;
  /** Builds a new instance from the provider in use now (sso/settings.ts). */
  rebuild(): Promise<void>;
}

/**
 * Builds a host from the environment and the database's pairing.
 *
 * @param db - The database. Migrations must have run: the pairing is read from it.
 * @param [opts] - Passed to every `createAuth`, for tests. `oidc` is the host's to decide.
 * @returns The host, with its first instance built.
 */
export async function createAuthHost(db: DB, opts: Omit<AuthOptions, 'oidc'> = {}): Promise<AuthHost> {
  const sessionStorage = opts.sessionStorage === undefined ? defaultSessionStorage() : opts.sessionStorage;
  const build = async () => {
    const { config } = await effectiveOidc(db);
    return { auth: createAuth(db, { ...opts, sessionStorage, oidc: config }), oidc: config };
  };
  let built = await build();
  return {
    current: () => built.auth,
    oidc: () => built.oidc,
    async rebuild() {
      built = await build();
    },
  };
}

/**
 * Builds a host that never changes, for a caller that already has its instance.
 *
 * @param auth - The instance.
 * @param [oidc] - The provider it was built with.
 * @param [rebuild] - What to do when asked to rebuild. Nothing, by default.
 * @returns The host.
 */
export function fixedAuthHost(auth: Auth, oidc: OidcConfig | null = null, rebuild = async () => {}): AuthHost {
  return { current: () => auth, oidc: () => oidc, rebuild };
}
