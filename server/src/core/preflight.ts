// Runs before anything connects or signs a token, so a misconfigured instance fails with a sentence, not a stack trace.
import { isProduction, jwtSecret } from './config.ts';
import { AUTH_DEFAULTS } from './defaults.ts';

/** The secrets .env.example and the development fallback ship with. */
const PLACEHOLDER_SECRETS = ['change-me-to-a-long-random-string', 'dev-secret-change-in-production'];

/**
 * Logs and exits 1.
 *
 * @param message - What's wrong and how to fix it.
 * @returns Never.
 */
function fatal(message: string): never {
  console.error(`[preflight] ${message}`);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL ?? '';
if (databaseUrl === '') {
  fatal('DATABASE_URL is required. Copy .env.example to .env, then run `npm run db:up` for a local Postgres.');
}

if (isProduction()) {
  const secret = jwtSecret();
  const isTooShort = secret.length < AUTH_DEFAULTS.minSecretLength;
  const isPlaceholder = PLACEHOLDER_SECRETS.includes(secret);
  // A known secret means anyone can forge a session for any account.
  if (isTooShort || isPlaceholder) {
    fatal('JWT_SECRET must be a strong random value. Generate one with `openssl rand -hex 32`.');
  }
}
