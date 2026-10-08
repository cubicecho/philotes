import { ApolloLink, makeVar, Observable, type Operation, useReactiveVar } from '@apollo/client';
import { Kind, OperationTypeNode } from 'graphql';
import { healthUrl } from '@/lib/api-url';
import { CONNECTION_DEFAULTS } from '@/lib/defaults';

// Whether the server can be reached. Nobody asks the device: a phone on its home network with the
// server switched off is as offline as one in a tunnel, so the app goes by what its requests meet.

const isOfflineVar = makeVar(false);

/** Why a change was not sent. The message is written to be shown. */
export class OfflineError extends Error {
  override name = 'OfflineError';

  constructor() {
    super("You're offline. Changes can be saved once the server can be reached again.");
  }
}

/** Why a query was given up on. */
export class RequestTimeoutError extends Error {
  override name = 'RequestTimeoutError';

  constructor() {
    super('The server took too long to answer.');
  }
}

/** The name a cancelled request's error carries. Cancelling says nothing about the server. */
const ABORT_ERROR_NAME = 'AbortError';

/** The statuses a proxy answers with when the server behind it is down. */
const GatewayStatus = { BadGateway: 502, ServiceUnavailable: 503, GatewayTimeout: 504 } as const;
const UNREACHABLE_STATUSES = new Set<number>(Object.values(GatewayStatus));

/**
 * Whether the server could not be reached the last time the app tried.
 *
 * @returns True while offline.
 */
export function isOffline(): boolean {
  return isOfflineVar();
}

/**
 * Whether the server could not be reached the last time the app tried, for a component.
 *
 * @returns True while offline. The component is drawn again when it changes.
 */
export function useIsOffline(): boolean {
  return useReactiveVar(isOfflineVar);
}

/**
 * Records whether the server answered.
 *
 * @param isReachable - True when a request got an answer from the server.
 */
export function setReachable(isReachable: boolean): void {
  const isChanged = isOfflineVar() === isReachable;
  if (isChanged) {
    isOfflineVar(isReachable === false);
  }
}

/**
 * Tells a failure to reach the server from an answer the server gave.
 *
 * @param error - What a request failed with.
 * @returns True when the request never got an answer from the server itself.
 */
export function isUnreachable(error: unknown): boolean {
  const isCancelled = error instanceof Error && error.name === ABORT_ERROR_NAME;
  if (isCancelled) {
    return false;
  }
  const status = typeof error === 'object' && error !== null && 'statusCode' in error ? error.statusCode : undefined;
  // An error with a status came back over HTTP: the server, or something in front of it, is there.
  return typeof status !== 'number' || UNREACHABLE_STATUSES.has(status);
}

/**
 * Asks the server whether it is there, and records the answer when it is. A failed check changes
 * nothing: only a request the app needed is allowed to call it offline.
 *
 * @returns True when the server answered that it is healthy.
 */
export async function probeServer(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECTION_DEFAULTS.probeTimeoutMs);
  try {
    const response = await fetch(healthUrl(), { signal: controller.signal });
    if (response.ok) {
      setReachable(true);
    }
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads what kind of operation a request is.
 *
 * @param operation - The request.
 * @returns Its kind, or undefined for a document with no operation in it.
 */
function kindOf(operation: Operation): OperationTypeNode | undefined {
  for (const definition of operation.query.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      return definition.operation;
    }
  }
  return undefined;
}

/** What the connection link is built with. */
export interface ConnectionLinkOptions {
  /** Operations sent even while offline, by name: signing in is how a user finds the server is back. */
  alwaysSent: ReadonlySet<string>;
}

/**
 * Builds the link that keeps track of the connection. It records whether each request reached the
 * server, gives up on a query the server does not answer in time, and refuses a mutation while
 * offline: nothing is queued, so a change that cannot be sent now is not taken at all.
 *
 * @param options - The operations to send regardless.
 * @returns The link, to place before the one that sends the request.
 */
export function createConnectionLink({ alwaysSent }: ConnectionLinkOptions): ApolloLink {
  return new ApolloLink((operation, forward) => {
    const kind = kindOf(operation);
    const isRefused =
      kind === OperationTypeNode.MUTATION && isOffline() && alwaysSent.has(operation.operationName) === false;
    if (isRefused) {
      // The server may be back: find out now, so the next attempt is not refused for nothing.
      void probeServer();
      return new Observable((observer) => observer.error(new OfflineError()));
    }

    return new Observable((observer) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const subscription = forward(operation).subscribe({
        next: (result) => {
          clearTimeout(timer);
          setReachable(true);
          observer.next(result);
        },
        error: (error: unknown) => {
          clearTimeout(timer);
          if (isUnreachable(error)) {
            setReachable(false);
          }
          observer.error(error);
        },
        complete: () => {
          clearTimeout(timer);
          observer.complete();
        },
      });
      // Only a query: a mutation such as an import may rightly take longer, and giving up on one
      // would report as failed a change the server then makes.
      if (kind === OperationTypeNode.QUERY) {
        timer = setTimeout(() => {
          // Unsubscribing is what cancels the request underneath.
          subscription.unsubscribe();
          setReachable(false);
          observer.error(new RequestTimeoutError());
        }, CONNECTION_DEFAULTS.queryTimeoutMs);
      }
      return () => {
        clearTimeout(timer);
        subscription.unsubscribe();
      };
    });
  });
}
