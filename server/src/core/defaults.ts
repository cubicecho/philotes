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

/** Sign-in and credential settings. */
export interface AuthSettings {
  /** Shortest signing secret production accepts, in characters. */
  minSecretLength: number;
}

export const AUTH_DEFAULTS: Readonly<AuthSettings> = Object.freeze({
  minSecretLength: 32,
});
