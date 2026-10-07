// Every value someone might tune, as plain data. Nothing here computes, reads the environment or imports.

/** Settings for reaching and leaving Postgres. */
export interface DatabaseSettings {
  /** How long boot waits for Postgres before giving up. `DB_CONNECT_TIMEOUT_MS` overrides it. */
  connectTimeoutMs: number;
  /** The wait before the first retry. */
  firstRetryDelayMs: number;
  /** The longest wait between two retries. */
  maxRetryDelayMs: number;
  /** How much the wait grows after each failed attempt. */
  retryBackoffFactor: number;
  /** How long running queries get at shutdown before they are cancelled. */
  closeTimeoutSeconds: number;
}

export const DATABASE_DEFAULTS: Readonly<DatabaseSettings> = Object.freeze({
  connectTimeoutMs: 60_000,
  firstRetryDelayMs: 500,
  maxRetryDelayMs: 5_000,
  retryBackoffFactor: 2,
  closeTimeoutSeconds: 5,
});
