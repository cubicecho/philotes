// Getters, not constants, so a test (or a reload) sees the current environment.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATABASE_DEFAULTS } from '@cubicecho/philotes-db/defaults';
import { AUTH_DEFAULTS, type AuthSettings, HTTP_DEFAULTS, STORAGE_DEFAULTS } from './defaults.ts';

/** Env values that count as on, in lower case. */
const TRUTHY = ['1', 'true', 'yes'];
const NODE_ENV_PRODUCTION = 'production';
/** The TRUST_PROXY value that trusts no hop. */
const TRUST_PROXY_OFF = 'false';
/** A hop count: digits only. */
const HOP_COUNT = /^\d+$/;
const UNKNOWN_VERSION = 'unknown';
/** Where `npm run dev` serves the app, a different origin from the server. */
const DEV_APP_ORIGIN = 'http://localhost:8081';
/** The repo root, which relative storage paths start from. */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Where better-auth keeps sessions. */
export type SessionStore = AuthSettings['sessionStore'];
/** The `SESSION_STORE` value for sessions kept in memory. */
export const SESSION_STORE_MEMORY = 'memory' as const satisfies SessionStore;
/** The `SESSION_STORE` value for sessions kept in the database. */
export const SESSION_STORE_DATABASE = 'database' as const satisfies SessionStore;

/**
 * Reads an on/off flag.
 *
 * @param value - The raw env value. "1", "true" and "yes" count as on, in any case. Any other word is off.
 * @param fallback - Used when the value is unset or empty.
 * @returns Whether the flag is on.
 */
export function envFlag(value: string | undefined, fallback: boolean): boolean {
  const normalised = (value ?? '').trim().toLowerCase();
  if (normalised === '') {
    return fallback;
  }
  return TRUTHY.includes(normalised);
}

/**
 * Reads a positive number.
 *
 * @param value - The raw env value.
 * @param fallback - Used when the value is unset, not a number, or not above zero.
 * @returns The number.
 */
function envNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  const isUsable = Number.isFinite(parsed) && parsed > 0;
  return isUsable ? parsed : fallback;
}

/**
 * The port to listen on.
 *
 * @returns `PORT`, or `HTTP_DEFAULTS.port`.
 */
export const port = (): number => envNumber(process.env.PORT, HTTP_DEFAULTS.port);

/**
 * Where users reach this instance. Links are built from it, and it is logged at boot.
 *
 * @returns `APP_URL`, or localhost on the listen port.
 */
export const appUrl = (): string => process.env.APP_URL ?? `http://localhost:${port()}`;

/**
 * Where a browser reaches this server: the OIDC sign-in's start and callback live here. In
 * production the server serves the app, so it is `APP_URL`; in development the Expo dev server is
 * a second origin and this one is on its own port.
 *
 * @returns `SERVER_URL`, `APP_URL` in production, or this server's own localhost address.
 */
export function serverUrl(): string {
  const configured = process.env.SERVER_URL?.trim().replace(/\/+$/, '');
  if (configured) {
    return configured;
  }
  return isProduction() ? appUrl() : `http://localhost:${port()}`;
}

/**
 * Whether this is a production run. Preflight is stricter and GraphiQL is off.
 *
 * @returns True when `NODE_ENV` is "production".
 */
export const isProduction = (): boolean => process.env.NODE_ENV === NODE_ENV_PRODUCTION;

/**
 * The origins a browser may call the API from. In production the app is served by this server,
 * so only its own address is listed.
 *
 * @returns `APP_URL`, and the dev app's origin outside production.
 */
export const allowedOrigins = (): string[] => (isProduction() ? [appUrl()] : [appUrl(), DEV_APP_ORIGIN]);

/**
 * Where uploaded avatars are kept when no S3-compatible store is configured. The Docker image points it at its `/data` volume.
 *
 * @returns `AVATAR_DIR`, or `STORAGE_DEFAULTS.avatarDir`, as an absolute path.
 */
export const avatarDir = (): string => resolve(REPO_ROOT, process.env.AVATAR_DIR ?? STORAGE_DEFAULTS.avatarDir);

/** Where an S3-compatible store is and how to sign in to it. */
export interface ObjectStorageConfig {
  /** The store's URL, such as `http://minio:9000`. */
  endpoint: string;
  bucket: string;
  region: string;
  /** Whether the bucket goes in the URL's path, not its host. */
  forcePathStyle: boolean;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * The S3-compatible store avatars are kept in, such as MinIO. Unset, they are kept in {@link avatarDir}.
 *
 * @returns The store's settings when `S3_ENDPOINT` is set, otherwise `null`. The keys are empty strings when unset.
 */
export const objectStorage = (): ObjectStorageConfig | null => {
  const endpoint = (process.env.S3_ENDPOINT ?? '').trim();
  if (endpoint === '') {
    return null;
  }
  return {
    endpoint,
    bucket: process.env.S3_BUCKET || STORAGE_DEFAULTS.bucket,
    region: process.env.S3_REGION || STORAGE_DEFAULTS.region,
    forcePathStyle: envFlag(process.env.S3_FORCE_PATH_STYLE, STORAGE_DEFAULTS.forcePathStyle),
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  };
};

/**
 * Whether typing an email signs in. Unsafe on a public network: on only where nothing hostile can reach the port.
 *
 * @returns `SECURE_LOCAL_NET` as a flag, or `AUTH_DEFAULTS.secureLocalNet`.
 */
export const secureLocalNet = (): boolean => envFlag(process.env.SECURE_LOCAL_NET, AUTH_DEFAULTS.secureLocalNet);

/**
 * Whether a public `APP_URL` is accepted alongside `SECURE_LOCAL_NET`. Unsafe: it lets anyone who can reach the port sign in as anyone.
 *
 * @returns `I_KNOW_SECURE_LOCAL_NET_IS_PUBLIC` as a flag, off when unset.
 */
export const allowsPublicLocalNet = (): boolean => envFlag(process.env.I_KNOW_SECURE_LOCAL_NET_IS_PUBLIC, false);

/**
 * Where sessions are kept.
 *
 * @returns `SESSION_STORE` when it names a store, otherwise `AUTH_DEFAULTS.sessionStore`.
 */
export const sessionStore = (): SessionStore => {
  const raw = process.env.SESSION_STORE;
  const isKnown = raw === SESSION_STORE_MEMORY || raw === SESSION_STORE_DATABASE;
  return isKnown ? raw : AUTH_DEFAULTS.sessionStore;
};

/**
 * The better-auth signing secret.
 *
 * @returns `BETTER_AUTH_SECRET`, or an empty string when unset.
 */
export const authSecret = (): string => process.env.BETTER_AUTH_SECRET ?? '';

/**
 * Where email is sent through.
 *
 * @returns `SMTP_URL`, or an empty string when unset.
 */
export const smtpUrl = (): string => process.env.SMTP_URL ?? '';

/**
 * The address sign-in email comes from.
 *
 * @returns `SMTP_FROM`, or `philotes@` the host of `APP_URL`.
 */
export const smtpFrom = (): string => process.env.SMTP_FROM || `philotes@${new URL(appUrl()).hostname}`;

/**
 * Whether email (magic links) can be sent.
 *
 * @returns True when `SMTP_URL` is set.
 */
export const smtpConfigured = (): boolean => smtpUrl() !== '';

/**
 * How long boot waits for Postgres before exiting.
 *
 * @returns `DB_CONNECT_TIMEOUT_MS`, or `DATABASE_DEFAULTS.connectTimeoutMs`, in milliseconds.
 */
export const dbConnectTimeoutMs = (): number =>
  envNumber(process.env.DB_CONNECT_TIMEOUT_MS, DATABASE_DEFAULTS.connectTimeoutMs);

/**
 * Express `trust proxy`: which hops may set X-Forwarded-For, and so what `req.ip` is.
 *
 * @returns `HTTP_DEFAULTS.trustProxy` when `TRUST_PROXY` is unset, false for "false", a hop count for digits, otherwise the value as given ("loopback", an address list).
 *
 * @remarks
 * Trusting a hop that isn't a proxy lets a client pick its own address. Never `true` on a port the internet reaches directly.
 */
export const trustProxy = (): boolean | number | string => {
  const raw = (process.env.TRUST_PROXY ?? '').trim();
  if (raw === '') {
    return HTTP_DEFAULTS.trustProxy;
  }
  if (raw === TRUST_PROXY_OFF) {
    return false;
  }
  const isHopCount = HOP_COUNT.test(raw);
  return isHopCount ? Number(raw) : raw;
};

/**
 * Reads the version semantic-release stamped into the root package.json, which the Dockerfile copies.
 *
 * @returns The released version, or "unknown".
 */
function readVersion(): string {
  try {
    const manifest: { version?: string } = createRequire(import.meta.url)('../../../package.json');
    return manifest.version || UNKNOWN_VERSION;
  } catch {
    return UNKNOWN_VERSION;
  }
}

/** Stamped into the build, not configured. */
const VERSION = readVersion();

/**
 * The version this build was released as.
 *
 * @returns The released version, or "unknown".
 */
export const version = (): string => VERSION;

/** The id the OIDC provider is registered under in better-auth, and so the last part of its callback path. */
export const OIDC_PROVIDER_ID = 'oidc';
/** The `OIDC_CLIENT_AUTH` values a provider can expect. */
export const OIDC_CLIENT_AUTH_METHODS = ['client_secret_basic', 'client_secret_post'] as const;

/** An OpenID Connect provider to sign in with: heautou, Keycloak, Authentik, … */
export interface OidcConfig {
  /** The issuer URL, no trailing slash. Its discovery document is `/.well-known/openid-configuration` under it. */
  issuer: string;
  clientId: string;
  /** Unset for a public client, which proves itself with PKCE alone. */
  clientSecret: string | undefined;
  /** How a confidential client sends its secret. The provider must expect the same. */
  clientAuth: AuthSettings['oidcClientAuth'];
  /** What the login page's button calls the provider. */
  name: string;
}

/**
 * Reads the OIDC provider set in the environment. preflight.ts refuses one of `OIDC_ISSUER` and
 * `OIDC_CLIENT_ID` without the other, and an `OIDC_CLIENT_AUTH` it does not know.
 *
 * @returns The provider when `OIDC_ISSUER` and `OIDC_CLIENT_ID` are both set, otherwise null.
 */
export function oidcConfig(): OidcConfig | null {
  const issuer = process.env.OIDC_ISSUER?.trim();
  const clientId = process.env.OIDC_CLIENT_ID?.trim();
  if (!issuer || !clientId) {
    return null;
  }
  const clientAuth = process.env.OIDC_CLIENT_AUTH?.trim();
  return {
    issuer: issuer.replace(/\/+$/, ''),
    clientId,
    clientSecret: process.env.OIDC_CLIENT_SECRET?.trim() || undefined,
    clientAuth: clientAuth === 'client_secret_post' ? clientAuth : AUTH_DEFAULTS.oidcClientAuth,
    name: process.env.OIDC_NAME?.trim() || AUTH_DEFAULTS.oidcName,
  };
}

/**
 * Names the address to register with the OIDC provider as this client's redirect URI.
 *
 * @returns better-auth's callback for the provider, under `serverUrl()`.
 */
export function oidcRedirectUri(): string {
  return `${serverUrl()}/api/auth/callback/${OIDC_PROVIDER_ID}`;
}

/**
 * The keys a mailbox's app password is sealed with: `<id>:<base64 key>`, comma-separated, the sealing key
 * first. Unset, the server reads no mail.
 *
 * @returns `MAIL_CREDENTIAL_KEYS`, or undefined.
 */
export const mailCredentialKeys = (): string | undefined => process.env.MAIL_CREDENTIAL_KEYS;
