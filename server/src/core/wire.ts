/** The HTTP statuses this server sends, and its tests expect. */
export const HttpStatus = {
  Ok: 200,
  BadRequest: 400,
  Unauthorized: 401,
  NotFound: 404,
  TooManyRequests: 429,
  PayloadTooLarge: 413,
  ServiceUnavailable: 503,
} as const;
export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];

/** Milliseconds in a second. */
export const MS_PER_SECOND = 1000;
/** Seconds in a minute. */
export const SECONDS_PER_MINUTE = 60;
/** Seconds in a day. */
export const SECONDS_PER_DAY = 86_400;
/** Milliseconds in a day. */
export const MS_PER_DAY = 86_400_000;
/** Days in a week. */
export const DAYS_PER_WEEK = 7;
