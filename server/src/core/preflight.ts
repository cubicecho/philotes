// Runs before anything connects or signs a token, so a misconfigured instance fails with a sentence, not a stack trace.
import { isPrivateHost } from '@cubicecho/philotes-db/ssl';
import { allowsPublicLocalNet, appUrl, authSecret, isProduction, secureLocalNet } from './config.ts';
import { AUTH_DEFAULTS } from './defaults.ts';

/** The secret .env.example ships with. */
const PLACEHOLDER_SECRET = 'change-me-to-a-long-random-string';

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
  const secret = authSecret();
  const isTooShort = secret.length < AUTH_DEFAULTS.minSecretLength;
  const isPlaceholder = secret === PLACEHOLDER_SECRET;
  // A known secret means anyone can forge a session for any account.
  if (isTooShort || isPlaceholder) {
    fatal('BETTER_AUTH_SECRET must be a strong random value. Generate one with `openssl rand -hex 32`.');
  }
}

if (secureLocalNet()) {
  const hostname = new URL(appUrl()).hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const isExposed = isPrivateHost(hostname) === false && allowsPublicLocalNet() === false;
  // With SECURE_LOCAL_NET, typing any email signs in as that account.
  if (isExposed) {
    fatal(
      `SECURE_LOCAL_NET is on but APP_URL (${appUrl()}) is not a private address. Turn it off, or set I_KNOW_SECURE_LOCAL_NET_IS_PUBLIC=true if nothing hostile can reach this port.`,
    );
  }
}
