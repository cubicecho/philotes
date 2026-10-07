// Getters, not constants, so a test (or a reload) sees the current environment.
import { createRequire } from 'node:module';
import { HTTP_DEFAULTS } from './defaults.ts';

const NODE_ENV_PRODUCTION = 'production';
/** The TRUST_PROXY value that trusts no hop. */
const TRUST_PROXY_OFF = 'false';
/** A hop count: digits only. */
const HOP_COUNT = /^\d+$/;
const UNKNOWN_VERSION = 'unknown';
/** Where `npm run dev` serves the app, a different origin from the server. */
const DEV_APP_ORIGIN = 'http://localhost:3000';

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
 * The secret sign-in tokens are signed with.
 *
 * @returns `JWT_SECRET`, or an empty string when unset.
 */
export const jwtSecret = (): string => process.env.JWT_SECRET ?? '';

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
