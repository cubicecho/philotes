// Runs before anything connects or signs a token, so a misconfigured instance fails with a sentence, not a stack trace.
import { isPrivateHost } from '@cubicecho/philotes-db/ssl';
import { parseKeyring } from '../mail/credential.ts';
import {
  allowsPublicLocalNet,
  appUrl,
  authSecret,
  isProduction,
  mailCredentialKeys,
  OIDC_CLIENT_AUTH_METHODS,
  objectStorage,
  secureLocalNet,
} from './config.ts';
import { AUTH_DEFAULTS } from './defaults.ts';
import { errorMessage } from './errors.ts';

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
  const isWeakSecret = isTooShort || isPlaceholder;
  if (isWeakSecret) {
    fatal('BETTER_AUTH_SECRET must be a strong random value. Generate one with `openssl rand -hex 32`.');
  }
}

const storage = objectStorage();
if (storage !== null) {
  const isMissingKeys = storage.accessKeyId === '' || storage.secretAccessKey === '';
  if (isMissingKeys) {
    fatal(
      'S3_ENDPOINT is set, so S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required. Unset S3_ENDPOINT to keep avatars on disk.',
    );
  }
}

try {
  parseKeyring(mailCredentialKeys());
} catch (error: unknown) {
  fatal(errorMessage(error));
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

// Half an OIDC setup leaves the login page without its button and no clue why,
// and a typo in the issuer would only show up at the first sign-in.
const oidcIssuer = process.env.OIDC_ISSUER?.trim() ?? '';
const oidcClientId = process.env.OIDC_CLIENT_ID?.trim() ?? '';
const isHalfOidc = (oidcIssuer === '') !== (oidcClientId === '');
if (isHalfOidc) {
  fatal('OIDC_ISSUER and OIDC_CLIENT_ID go together: set both to sign in with an OIDC provider, or neither.');
}
const isIssuerUrl = URL.canParse(oidcIssuer);
if (oidcIssuer !== '' && isIssuerUrl === false) {
  fatal(`OIDC_ISSUER is not a URL: ${oidcIssuer}`);
}
const oidcClientAuth = process.env.OIDC_CLIENT_AUTH?.trim() ?? '';
const isKnownClientAuth = (OIDC_CLIENT_AUTH_METHODS as readonly string[]).includes(oidcClientAuth);
if (oidcClientAuth !== '' && isKnownClientAuth === false) {
  fatal(`OIDC_CLIENT_AUTH must be one of ${OIDC_CLIENT_AUTH_METHODS.join(', ')}.`);
}
