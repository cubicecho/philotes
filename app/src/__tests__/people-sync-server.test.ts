import type { Server } from 'node:http';
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { scalarTypePolicies } from '@/__generated__/type-policies';
import { PEOPLE_SNAPSHOT, syncPeople } from '@/lib/people-sync';
import {
  createSessionToken,
  createTestAuth,
  createTestDb,
  createUser,
  portOf,
} from '../../../server/src/__tests__/helpers.ts';
import { createApp } from '../../../server/src/http/app.ts';

// The refresh against the real API: its queries are ones the server answers, at the page sizes the
// app asks for, within the cost the server allows one operation.

/** Pushing the schema into a fresh database takes seconds on a busy machine. */
const SETUP_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 30_000;

const CREATE = parse(`
  mutation ($values: CreatePersonInput!) {
    createPerson(values: $values) {
      id
    }
  }
`);
const RENAME = parse(`
  mutation ($id: UUID!, $firstName: String!) {
    updatePerson(where: { id: { eq: $id } }, set: { firstName: $firstName }) {
      id
    }
  }
`);
const DELETE = parse(`
  mutation ($id: UUID!) {
    deletePerson(where: { id: { eq: $id } }) {
      id
    }
  }
`);

describe('syncPeople against the server', () => {
  let server: Server;
  let client: ApolloClient<unknown>;

  /** The names the cache keeps, in order. */
  function keptNames(): string[] {
    const snapshot = client.readQuery({ query: PEOPLE_SNAPSHOT })?.peopleSnapshot;
    return (snapshot?.people ?? []).map((person) => person.displayName).sort();
  }

  /** Adds a person through the API, as the app would. */
  async function create(firstName: string): Promise<string> {
    const { data } = await client.mutate({ mutation: CREATE, variables: { values: { firstName } } });
    return data.createPerson.id;
  }

  beforeAll(async () => {
    const db = await createTestDb();
    const userId = await createUser(db, 'sync@example.com');
    const { auth } = createTestAuth(db);
    server = createApp({ db, auth }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const token = await createSessionToken(auth, userId);
    client = new ApolloClient({
      cache: new InMemoryCache({ typePolicies: scalarTypePolicies }),
      link: new HttpLink({
        uri: `http://127.0.0.1:${portOf(server)}/graphql`,
        headers: { authorization: `Bearer ${token}` },
      }),
    });
  }, SETUP_TIMEOUT_MS);

  afterAll(async () => {
    client.stop();
    await new Promise((resolve) => server.close(resolve));
  });

  it(
    'reads everyone, then only what changed and who was deleted',
    async () => {
      const ada = await create('Ada');
      const grace = await create('Grace');

      await syncPeople(client, { withLastContact: true });
      expect(keptNames()).toEqual(['Ada', 'Grace']);

      await client.mutate({ mutation: RENAME, variables: { id: grace, firstName: 'Grace Hopper' } });
      await client.mutate({ mutation: DELETE, variables: { id: ada } });
      await create('Alan');

      await syncPeople(client, { withLastContact: true });
      expect(keptNames()).toEqual(['Alan', 'Grace Hopper']);
    },
    TEST_TIMEOUT_MS,
  );
});
