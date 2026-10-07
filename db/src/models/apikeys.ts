import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.ts';

/** An API key, as the better-auth api-key plugin stores it. Only the key's hash is kept. */
export const apikeys = pgTable(
  'apikeys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Which plugin configuration minted the key. This app has one. */
    configId: text('config_id').notNull().default('default'),
    name: text('name'),
    /** The key's first characters, shown so a user can tell keys apart. */
    start: text('start'),
    prefix: text('prefix'),
    /** The key's hash. */
    key: text('key').notNull(),
    /** The user the key acts as. */
    referenceId: uuid('reference_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refillInterval: integer('refill_interval'),
    refillAmount: integer('refill_amount'),
    lastRefillAt: timestamp('last_refill_at', { withTimezone: true }),
    enabled: boolean('enabled').notNull().default(true),
    rateLimitEnabled: boolean('rate_limit_enabled').notNull().default(true),
    rateLimitTimeWindow: integer('rate_limit_time_window'),
    rateLimitMax: integer('rate_limit_max'),
    requestCount: integer('request_count').notNull().default(0),
    /** Uses left, or null for no cap. */
    remaining: integer('remaining'),
    lastRequest: timestamp('last_request', { withTimezone: true }),
    /** null for a key that never expires. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    permissions: text('permissions'),
    /** JSON the plugin serializes itself. */
    metadata: text('metadata'),
  },
  (table) => [
    index('idx_apikeys_reference_id').on(table.referenceId),
    index('idx_apikeys_key').on(table.key),
    index('idx_apikeys_config_id').on(table.configId),
  ],
);

/** An API key row as read. */
export type ApiKey = typeof apikeys.$inferSelect;
/** An API key row as inserted. */
export type NewApiKey = typeof apikeys.$inferInsert;
