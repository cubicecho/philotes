import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * The OIDC provider this instance was paired with (server/src/sso/pairing.ts): one row or none,
 * owned by no user and written only by the server. OIDC_ISSUER in the environment wins over it.
 * The client secret and the registration access token are credentials, and nothing reads them back
 * out through the API, which is why the table is not in the GraphQL schema.
 */
export const oidcSettings = pgTable(
  'oidc_settings',
  {
    id: text('id').primaryKey().default('oidc'),
    issuer: text('issuer').notNull(),
    clientId: text('client_id').notNull(),
    clientSecret: text('client_secret'),
    // How the secret is sent to the token endpoint.
    clientAuth: text('client_auth').notNull().default('client_secret_basic'),
    // What the login page's button calls the provider.
    name: text('name').notNull(),
    // RFC 7592: what deletes the registration at the provider when this instance disconnects.
    registrationAccessToken: text('registration_access_token'),
    registrationClientUri: text('registration_client_uri'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check('oidc_settings_singleton', sql`${table.id} = 'oidc'`)],
);

/** The pairing row as read. */
export type OidcSettings = typeof oidcSettings.$inferSelect;
