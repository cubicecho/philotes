import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signToken } from '../../auth/resolvers.ts';
import { OPERATION_LIMIT_DEFAULTS } from '../../core/defaults.ts';
import { ErrorCode } from '../../core/errors.ts';
import { HttpStatus } from '../../core/wire.ts';
import { createApp } from '../../http/app.ts';
import { createTestDb, createUser, portOf } from '../helpers.ts';

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
/** Just past `HTTP_DEFAULTS.bodyLimit`. */
const OVERSIZED_BODY_BYTES = 1_100_000;
const ME = '{ me { id } }';
const { maxPageSize, maxDepth, maxAliases } = OPERATION_LIMIT_DEFAULTS;
/** drizzle-graphql's own code for a `limit` over the page cap. */
const LIMIT_EXCEEDED = 'DRIZZLE_LIMIT_EXCEEDED';
/** Notes and their person, nested `maxDepth` times: two levels each. One row per list keeps it cheap. */
const TOO_DEEP = `{ ${'notes(limit: 1) { person { '.repeat(maxDepth)} id ${'} } '.repeat(maxDepth)} }`;
/** One alias more than `maxAliases`. */
const TOO_ALIASED = `{ ${Array.from({ length: maxAliases + 1 }, (_, index) => `a${index}: me { id }`).join(' ')} }`;
/** Three full pages multiplied together, far past `maxCost`. */
const TOO_COSTLY = `{ persons(limit: ${maxPageSize}) { notes(limit: ${maxPageSize}) { labels(limit: ${maxPageSize}) { id } } } }`;
const REVOKE = `mutation { myRevokeApiKey(id: "${UNKNOWN_ID}") }`;

describe('the app over HTTP', () => {
  let server: Server;
  let baseUrl: string;
  let userId: string;

  /**
   * Posts one operation to /graphql.
   *
   * @param query - The operation text.
   * @param asUserId - Who is asking, or null to send no token.
   * @returns The response.
   */
  function post(query: string, asUserId: string | null = null): Promise<Response> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (asUserId !== null) {
      headers.authorization = `Bearer ${signToken(asUserId)}`;
    }
    return fetch(`${baseUrl}/graphql`, { method: 'POST', headers, body: JSON.stringify({ query }) });
  }

  beforeAll(async () => {
    const db = await createTestDb();
    userId = await createUser(db, 'http@example.com');
    server = createApp({ db }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${portOf(server)}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('reports health with a database round trip', async () => {
    const response = await fetch(`${baseUrl}/healthz`);

    expect(response.status).toBe(HttpStatus.Ok);
    expect(await response.json()).toMatchObject({ ok: true });
  });

  it('resolves the caller from the bearer token', async () => {
    const response = await post(ME, userId);

    expect(await response.json()).toEqual({ data: { me: { id: userId } } });
  });

  it('keeps the code of an error a resolver threw on purpose', async () => {
    const anonymous = await (await post(REVOKE)).json();
    const missing = await (await post(REVOKE, userId)).json();

    expect(anonymous.errors[0].extensions.code).toBe(ErrorCode.Unauthenticated);
    expect(missing.errors[0].extensions.code).toBe(ErrorCode.NotFound);
  });

  it('refuses a body over the cap', async () => {
    const response = await post(`{ me { id } } # ${'x'.repeat(OVERSIZED_BODY_BYTES)}`);

    expect(response.status).toBe(HttpStatus.PayloadTooLarge);
  });

  it('refuses a page larger than the cap', async () => {
    const body = await (await post(`{ persons(limit: ${maxPageSize + 1}) { id } }`, userId)).json();

    expect(body.errors[0].extensions.code).toBe(LIMIT_EXCEEDED);
  });

  it('serves a page at the cap', async () => {
    const body = await (await post(`{ persons(limit: ${maxPageSize}) { id } }`, userId)).json();

    expect(body).toEqual({ data: { persons: [] } });
  });

  it.each([
    ['too deep', TOO_DEEP],
    ['too aliased', TOO_ALIASED],
    ['too costly', TOO_COSTLY],
  ])('refuses an operation that is %s', async (_what, query) => {
    const body = await (await post(query, userId)).json();

    expect(body.errors[0].extensions.code).toBe(ErrorCode.QueryTooComplex);
  });
});
