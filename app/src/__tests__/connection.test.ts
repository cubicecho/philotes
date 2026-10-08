import { ApolloLink, execute, type FetchResult, from, Observable } from '@apollo/client';
import { parse } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createConnectionLink,
  isOffline,
  isUnreachable,
  OfflineError,
  RequestTimeoutError,
  setReachable,
} from '@/lib/connection';
import { CONNECTION_DEFAULTS } from '@/lib/defaults';

// Parsed here, not tagged, so codegen does not collect these as the app's own operations.
const QUERY = parse('query People { persons { id } }');
const MUTATION = parse('mutation Rename { updatePerson { id } }');
const SIGN_IN = parse('mutation SignIn { signIn { token } }');

/** What a request ends with in a test: an answer, an error, or `null` for no answer at all. */
type Ending = FetchResult | Error | null;

/** Runs one operation through the connection link, with a server that ends it as told. */
function send(document: typeof QUERY, ending: Ending) {
  const server = vi.fn(
    () =>
      new Observable<FetchResult>((observer) => {
        if (ending instanceof Error) {
          observer.error(ending);
        } else if (ending !== null) {
          observer.next(ending);
          observer.complete();
        }
      }),
  );
  const link = from([createConnectionLink({ alwaysSent: new Set(['SignIn']) }), new ApolloLink(server)]);
  const outcome = new Promise<FetchResult | Error>((resolve) => {
    execute(link, { query: document }).subscribe({ next: resolve, error: resolve });
  });
  return { server, outcome };
}

/** An error as the HTTP link raises it for an answer that is not a GraphQL one. */
function httpError(statusCode: number): Error {
  return Object.assign(new Error(`Response not successful: Received status code ${statusCode}`), { statusCode });
}

describe('the connection link', () => {
  beforeEach(() => {
    setReachable(true);
    // The link asks the server whether it is back when it refuses a change.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('goes offline when a request never reaches the server', async () => {
    const { outcome } = send(QUERY, new TypeError('Network request failed'));

    expect(await outcome).toBeInstanceOf(TypeError);
    expect(isOffline()).toBe(true);
  });

  it('stays online when the server answers with an error', async () => {
    const { outcome } = send(QUERY, httpError(400));

    await outcome;
    expect(isOffline()).toBe(false);
  });

  it('goes offline when a proxy answers for a server that is down', async () => {
    const { outcome } = send(QUERY, httpError(502));

    await outcome;
    expect(isOffline()).toBe(true);
  });

  it('comes back online with the next answer', async () => {
    setReachable(false);

    const { outcome } = send(QUERY, { data: { persons: [] } });

    expect(await outcome).toEqual({ data: { persons: [] } });
    expect(isOffline()).toBe(false);
  });

  it('refuses a change while offline, without sending it', async () => {
    setReachable(false);

    const { server, outcome } = send(MUTATION, { data: {} });

    expect(await outcome).toBeInstanceOf(OfflineError);
    expect(server).not.toHaveBeenCalled();
  });

  it('sends a change while online', async () => {
    const { server, outcome } = send(MUTATION, { data: {} });

    expect(await outcome).toEqual({ data: {} });
    expect(server).toHaveBeenCalledOnce();
  });

  it('sends a sign-in even while offline', async () => {
    setReachable(false);

    const { server, outcome } = send(SIGN_IN, { data: {} });

    expect(await outcome).toEqual({ data: {} });
    expect(server).toHaveBeenCalledOnce();
  });

  it('gives up on a query the server does not answer', async () => {
    vi.useFakeTimers();

    const { outcome } = send(QUERY, null);
    vi.advanceTimersByTime(CONNECTION_DEFAULTS.queryTimeoutMs);

    expect(await outcome).toBeInstanceOf(RequestTimeoutError);
    expect(isOffline()).toBe(true);
  });

  it('waits as long as it takes for a change', async () => {
    vi.useFakeTimers();
    const settled = vi.fn();

    const { outcome } = send(MUTATION, null);
    void outcome.then(settled);
    await vi.advanceTimersByTimeAsync(CONNECTION_DEFAULTS.queryTimeoutMs * 2);

    expect(settled).not.toHaveBeenCalled();
    expect(isOffline()).toBe(false);
  });
});

describe('isUnreachable', () => {
  it('does not count a cancelled request', () => {
    const cancelled = Object.assign(new Error('Aborted'), { name: 'AbortError' });

    expect(isUnreachable(cancelled)).toBe(false);
  });
});
