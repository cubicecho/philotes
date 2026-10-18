import type { DB } from '@cubicecho/philotes-db';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { type OidcConfig, oidcConfig } from '../core/config.ts';

// The OIDC provider the instance signs in with comes from one of two places:
// the environment (OIDC_ISSUER), or a pairing an admin made by pasting a setup
// URL (pairing.ts), kept in the `oidc_settings` row. The environment wins, so a
// deployment that pins its provider cannot be re-paired from the app.

/** Where the provider in use came from. The GraphQL enum `SsoSource` has the same values. */
export const SsoSource = {
  Env: 'ENV',
  Paired: 'PAIRED',
  None: 'NONE',
} as const;
/** One of the values in `SsoSource`. */
export type SsoSource = (typeof SsoSource)[keyof typeof SsoSource];

/** The `oidc_settings` row, as pairing writes it. */
export interface PairedOidc {
  issuer: string;
  clientId: string;
  clientSecret: string | null;
  clientAuth: OidcConfig['clientAuth'];
  name: string;
  /** RFC 7592: the credential that deletes the client at the provider. */
  registrationAccessToken: string | null;
  registrationClientUri: string | null;
}

/**
 * Reads the paired provider.
 *
 * @param db - The database.
 * @returns The pairing, or null when there is none.
 */
export async function readPairedOidc(db: DB): Promise<PairedOidc | null> {
  const [row] = await db.select().from(dbSchema.oidcSettings).limit(1);
  if (row === undefined) {
    return null;
  }
  return {
    issuer: row.issuer,
    clientId: row.clientId,
    clientSecret: row.clientSecret,
    clientAuth: row.clientAuth === 'client_secret_post' ? 'client_secret_post' : 'client_secret_basic',
    name: row.name,
    registrationAccessToken: row.registrationAccessToken,
    registrationClientUri: row.registrationClientUri,
  };
}

/**
 * Saves a pairing, replacing any before it.
 *
 * @param db - The database.
 * @param paired - What the provider registered.
 */
export async function savePairedOidc(db: DB, paired: PairedOidc): Promise<void> {
  await db
    .insert(dbSchema.oidcSettings)
    .values(paired)
    .onConflictDoUpdate({ target: dbSchema.oidcSettings.id, set: { ...paired, updatedAt: new Date() } });
}

/**
 * Forgets the pairing.
 *
 * @param db - The database.
 */
export async function clearPairedOidc(db: DB): Promise<void> {
  await db.delete(dbSchema.oidcSettings);
}

/**
 * Reads the provider sign-in uses and where it came from.
 *
 * @param db - The database.
 * @returns The environment's provider when OIDC_ISSUER is set, otherwise the pairing, otherwise none.
 */
export async function effectiveOidc(db: DB): Promise<{ config: OidcConfig | null; source: SsoSource }> {
  const env = oidcConfig();
  if (env !== null) {
    return { config: env, source: SsoSource.Env };
  }
  const paired = await readPairedOidc(db);
  if (paired === null) {
    return { config: null, source: SsoSource.None };
  }
  return {
    config: {
      issuer: paired.issuer,
      clientId: paired.clientId,
      clientSecret: paired.clientSecret ?? undefined,
      clientAuth: paired.clientAuth,
      name: paired.name,
    },
    source: SsoSource.Paired,
  };
}
