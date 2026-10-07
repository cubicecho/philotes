/** The HTTP statuses this server sends, and its tests expect. */
export const HttpStatus = {
  Ok: 200,
  BadRequest: 400,
  Unauthorized: 401,
  NotFound: 404,
  PayloadTooLarge: 413,
  ServiceUnavailable: 503,
} as const;
export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];

export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_DAY = 86_400;
