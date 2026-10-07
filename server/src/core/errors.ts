import { GraphQLError } from 'graphql';

/** The `extensions.code` values clients branch on. */
export const ErrorCode = {
  Unauthenticated: 'UNAUTHENTICATED',
  NotFound: 'NOT_FOUND',
  BadUserInput: 'BAD_USER_INPUT',
  TooManyRequests: 'TOO_MANY_REQUESTS',
  Forbidden: 'FORBIDDEN',
  QueryTooComplex: 'QUERY_TOO_COMPLEX',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Makes an error factory for one code.
 *
 * @param code - The `extensions.code` value.
 * @returns A function from message to GraphQLError.
 */
const withCode =
  (code: ErrorCode) =>
  (message: string): GraphQLError =>
    new GraphQLError(message, { extensions: { code } });

/**
 * Arguments the caller can fix.
 *
 * @param message - Client-readable message.
 * @returns The error, for the caller to throw.
 */
export const badInput = withCode(ErrorCode.BadUserInput);
/**
 * Missing, or someone else's. Deliberately one code.
 *
 * @param message - Client-readable message.
 * @returns The error, for the caller to throw.
 */
export const notFound = withCode(ErrorCode.NotFound);
/**
 * This kind of caller may never do this. Not for rows they don't own.
 *
 * @param message - Client-readable message.
 * @returns The error, for the caller to throw.
 */
export const forbidden = withCode(ErrorCode.Forbidden);
/**
 * The operation is too deep, too aliased or too costly.
 *
 * @param message - Client-readable message.
 * @returns The error, for the caller to throw.
 */
export const tooComplex = withCode(ErrorCode.QueryTooComplex);

/**
 * Builds the rate-limit refusal.
 *
 * @param message - Client-readable message.
 * @param retryAfter - Seconds until the caller may try again.
 * @returns The error, for the caller to throw.
 */
export const rateLimited = (message: string, retryAfter: number): GraphQLError =>
  new GraphQLError(message, { extensions: { code: ErrorCode.TooManyRequests, retryAfter } });

/**
 * Builds the signed-out refusal.
 *
 * @param [message] - Client-readable message.
 * @returns The error, for the caller to throw.
 */
export const unauthenticated = (message = 'Not authenticated'): GraphQLError =>
  new GraphQLError(message, { extensions: { code: ErrorCode.Unauthenticated } });

/**
 * Reads the signed-in user's id.
 *
 * @param ctx - Request context.
 * @returns The user's id.
 * @throws UNAUTHENTICATED when nobody is signed in: the id is missing, null or empty.
 */
export function requireAuth(ctx: { userId?: string | null }): string {
  const { userId } = ctx;
  const isSignedOut = userId === undefined || userId === null || userId === '';
  if (isSignedOut) {
    throw unauthenticated();
  }
  return userId;
}

/**
 * Reads the message of any caught value.
 *
 * @param error - Whatever was thrown.
 * @returns `error.message` for an Error, otherwise `String(error)`.
 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
