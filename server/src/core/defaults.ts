// Every value someone might tune, as plain data. Nothing here computes, reads the environment or imports.

/** Settings for the HTTP doors and the process behind them. */
export interface HttpSettings {
  /** The port to listen on. `PORT` overrides it. */
  port: number;
  /** Largest JSON body /graphql accepts, as `express.json` reads it. Real operations are a few kB. */
  bodyLimit: string;
  /** How long shutdown lets open requests finish before it cuts them. */
  drainSeconds: number;
  /** How long shutdown may take in all before a hard exit. Keep it under Docker's 10 s. */
  shutdownDeadlineSeconds: number;
  /** Express `trust proxy`: which hops may set X-Forwarded-For. False trusts none. `TRUST_PROXY` overrides it. */
  trustProxy: boolean | number | string;
}

export const HTTP_DEFAULTS: Readonly<HttpSettings> = Object.freeze({
  port: 3001,
  bodyLimit: '1mb',
  drainSeconds: 5,
  shutdownDeadlineSeconds: 8,
  trustProxy: false,
});

/** The sign-in throttle. */
export interface RateLimitSettings {
  /** Attempts allowed per key inside one window. */
  maxAttempts: number;
  /** How long an attempt counts against its key. */
  windowMinutes: number;
  /** Past this many keys, a hit sweeps out the ones whose window has passed. */
  sweepAtKeys: number;
}

export const RATE_LIMIT_DEFAULTS: Readonly<RateLimitSettings> = Object.freeze({
  maxAttempts: 10,
  windowMinutes: 15,
  sweepAtKeys: 10_000,
});

/** Sign-in and credential settings. */
export interface AuthSettings {
  /** How long an emailed sign-in link works. */
  magicLinkTtlMinutes: number;
  /** Shortest signing secret production accepts, in characters. */
  minSecretLength: number;
  /** Where better-auth keeps sessions. `SESSION_STORE` overrides it. */
  sessionStore: 'memory' | 'database';
  /** Whether typing an email signs in, with no link. Unsafe on a public network. `SECURE_LOCAL_NET` overrides it. */
  secureLocalNet: boolean;
}

export const AUTH_DEFAULTS: Readonly<AuthSettings> = Object.freeze({
  magicLinkTtlMinutes: 15,
  minSecretLength: 32,
  sessionStore: 'memory',
  secureLocalNet: false,
});

/** How API keys are shown. */
export interface ApiKeySettings {
  /** How many characters after the prefix are kept readable, so a user can tell keys apart. */
  shownCharacters: number;
}

export const API_KEY_DEFAULTS: Readonly<ApiKeySettings> = Object.freeze({
  shownCharacters: 8,
});

/** Bounds on what one GraphQL operation may ask for. */
export interface OperationLimitSettings {
  /** Rows a list returns when the request passes no `limit`. */
  defaultPageSize: number;
  /** Largest `limit` a list accepts. A larger one is refused, not clamped. */
  maxPageSize: number;
  /** Deepest selection nesting an operation may have. */
  maxDepth: number;
  /** Most aliases one operation may use. */
  maxAliases: number;
  /** Highest total cost an operation may have. A list costs its page size times one row. */
  maxCost: number;
  /** Cost of a field that carries no cost hint. */
  defaultFieldCost: number;
}

export const OPERATION_LIMIT_DEFAULTS: Readonly<OperationLimitSettings> = Object.freeze({
  defaultPageSize: 50,
  maxPageSize: 500,
  maxDepth: 8,
  maxAliases: 15,
  maxCost: 10_000,
  defaultFieldCost: 1,
});
