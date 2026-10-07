import { RATE_LIMIT_DEFAULTS, type RateLimitSettings } from '../core/defaults.ts';
import { rateLimited } from '../core/errors.ts';
import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '../core/wire.ts';

/** Counts attempts per key and refuses once a key is over its budget. */
export interface RateLimiter {
  /**
   * Records one attempt against every key, or records nothing and throws.
   *
   * @param keys - For example `signIn:ip:203.0.113.7` and `signIn:email:a@x.com`.
   * @throws A TOO_MANY_REQUESTS error when any key is already at its budget.
   */
  hit(...keys: string[]): void;
}

/**
 * Builds a sliding-window limiter that lives in process memory.
 *
 * @param [overrides] - Settings that differ from `RATE_LIMIT_DEFAULTS`. Tests pass a small budget.
 * @param [now] - Clock. Tests pass one they control.
 * @returns The limiter.
 *
 * @remarks
 * A restart forgets the counts and replicas don't share them, the same trade as in-memory sessions.
 */
export function createRateLimiter(
  overrides: Partial<RateLimitSettings> = {},
  now: () => number = Date.now,
): RateLimiter {
  const { maxAttempts, windowMinutes, sweepAtKeys } = { ...RATE_LIMIT_DEFAULTS, ...overrides };
  const windowMs = windowMinutes * SECONDS_PER_MINUTE * MS_PER_SECOND;
  const attempts = new Map<string, number[]>();
  return {
    hit(...keys) {
      const at = now();
      const windowStart = at - windowMs;
      const recent = keys.map((key) => (attempts.get(key) ?? []).filter((time) => time > windowStart));
      const full = recent.find((times) => times.length >= maxAttempts);
      if (full !== undefined) {
        const [oldest] = full;
        const retryAfter = Math.ceil((oldest + windowMs - at) / MS_PER_SECOND);
        throw rateLimited(`Too many attempts. Try again in ${retryAfter} seconds.`, retryAfter);
      }
      for (const [index, key] of keys.entries()) {
        attempts.set(key, [...recent[index], at]);
      }
      // Every attacker-chosen email is a new key, so the map must not grow without bound.
      const isCrowded = attempts.size > sweepAtKeys;
      if (isCrowded) {
        for (const [key, times] of attempts) {
          const newest = times.at(-1);
          const isStale = newest !== undefined && newest <= windowStart;
          if (isStale) {
            attempts.delete(key);
          }
        }
      }
    },
  };
}
