import { ApolloClient, ApolloLink, type FetchResult, InMemoryCache, Observable, type Operation } from '@apollo/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { scalarTypePolicies } from '@/__generated__/type-policies';
import { PAGE_SIZE_DEFAULTS } from '@/lib/defaults';
import { PEOPLE_SNAPSHOT, syncPeople } from '@/lib/people-sync';

/** A person as the pretend server holds them. */
interface ServerPerson {
  id: string;
  displayName: string;
  revision: number;
  /** When they were last in contact, as the API sends it. */
  lastContact: string | null;
}

/** The pretend server: a user's people, the ones deleted, and the count of changes. */
interface Server {
  revision: number;
  people: ServerPerson[];
  tombstones: Array<{ id: string; personId: string; revision: number }>;
  /** The names of the operations asked, in order. */
  asked: string[];
  /** Called before each answer, for a test that changes something mid-refresh. */
  beforeAnswer: (operation: Operation) => void;
}

let server: Server;

/** A person as the API sends them in a list row. */
function row(person: ServerPerson) {
  return {
    __typename: 'Person',
    id: person.id,
    cursor: person.id,
    displayName: person.displayName,
    sortName: person.displayName.toLowerCase(),
    nickname: null,
    organization: null,
    avatarPath: null,
    labels: [],
    contactInfos: [],
    interactions: person.lastContact === null ? [] : [{ __typename: 'Interaction', occurredAt: person.lastContact }],
  };
}

/** One page of rows ordered by id, starting after a cursor. */
function page<T extends { id: string }>(rows: T[], limit: number, after: string | null | undefined): T[] {
  const ordered = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return ordered.filter((item) => after == null || item.id > after).slice(0, limit);
}

/** Answers one operation the way the real API would. */
function answer(operation: Operation): FetchResult {
  const { limit, after, where, since } = operation.variables;
  if (operation.operationName === 'PeopleRevision') {
    return { data: { me: { __typename: 'User', id: 'u1', personsRevision: server.revision } } };
  }
  if (operation.operationName === 'ChangedPeople') {
    const floor: number = where?.revision?.gt ?? Number.NEGATIVE_INFINITY;
    const changed = server.people.filter((person) => person.revision > floor);
    return { data: { persons: page(changed, limit, after).map(row) } };
  }
  if (operation.operationName === 'RemovedPeople') {
    const removed = server.tombstones.filter((tombstone) => tombstone.revision > since);
    const rows = page(removed, limit, after).map((tombstone) => ({
      __typename: 'PersonTombstone',
      id: tombstone.id,
      personId: tombstone.personId,
      cursor: tombstone.id,
    }));
    return { data: { personTombstones: rows } };
  }
  if (operation.operationName === 'LastContacts') {
    const rows = page(server.people, limit, after).map((person) => {
      const { __typename, id, cursor, interactions } = row(person);
      return { __typename, id, cursor, interactions };
    });
    return { data: { persons: rows } };
  }
  throw new Error(`The test server does not answer ${operation.operationName}`);
}

function createClient(): ApolloClient<unknown> {
  const link = new ApolloLink(
    (operation) =>
      new Observable((observer) => {
        server.asked.push(operation.operationName);
        server.beforeAnswer(operation);
        observer.next(answer(operation));
        observer.complete();
      }),
  );
  return new ApolloClient({ cache: new InMemoryCache({ typePolicies: scalarTypePolicies }), link });
}

/** What the cache keeps, as a name by id, and the revision it is complete up to. */
function kept(client: ApolloClient<unknown>) {
  const snapshot = client.readQuery({ query: PEOPLE_SNAPSHOT })?.peopleSnapshot ?? null;
  const names = Object.fromEntries((snapshot?.people ?? []).map((person) => [person.id, person.displayName]));
  return { revision: snapshot?.revision ?? null, names, people: snapshot?.people ?? [] };
}

const CHANGES_ONLY = { withLastContact: false };

describe('syncPeople', () => {
  beforeEach(() => {
    server = {
      revision: 2,
      people: [
        { id: 'a', displayName: 'Ada', revision: 1, lastContact: null },
        { id: 'b', displayName: 'Grace', revision: 2, lastContact: '2026-03-01T10:00:00.000Z' },
      ],
      tombstones: [],
      asked: [],
      beforeAnswer: () => undefined,
    };
  });

  it('reads everyone the first time', async () => {
    const client = createClient();

    await syncPeople(client, CHANGES_ONLY);

    expect(kept(client)).toMatchObject({ revision: 2, names: { a: 'Ada', b: 'Grace' } });
    // Nobody was deleted from a list that did not exist, and a list just read has its last contacts.
    expect(server.asked).toEqual(['PeopleRevision', 'ChangedPeople']);
  });

  it('keeps dates as dates', async () => {
    const client = createClient();

    await syncPeople(client, CHANGES_ONLY);

    const grace = kept(client).people.find((person) => person.id === 'b');
    expect(grace?.interactions[0]?.occurredAt).toEqual(new Date('2026-03-01T10:00:00.000Z'));
  });

  it('asks for nothing more when nothing changed', async () => {
    const client = createClient();
    await syncPeople(client, CHANGES_ONLY);
    server.asked = [];

    await syncPeople(client, CHANGES_ONLY);

    expect(server.asked).toEqual(['PeopleRevision']);
  });

  it('reads only what changed, and drops who was deleted', async () => {
    const client = createClient();
    await syncPeople(client, CHANGES_ONLY);
    server.people = [
      { id: 'b', displayName: 'Grace Hopper', revision: 3, lastContact: null },
      { id: 'c', displayName: 'Alan', revision: 4, lastContact: null },
    ];
    server.tombstones = [{ id: 't1', personId: 'a', revision: 5 }];
    server.revision = 5;
    server.asked = [];

    await syncPeople(client, CHANGES_ONLY);

    expect(kept(client)).toEqual(expect.objectContaining({ revision: 5, names: { b: 'Grace Hopper', c: 'Alan' } }));
    expect(server.asked).toEqual(['PeopleRevision', 'ChangedPeople', 'RemovedPeople']);
  });

  it('reads a long list to its end', async () => {
    const count = PAGE_SIZE_DEFAULTS.peopleSync * 2 + 1;
    server.people = Array.from({ length: count }, (_, index) => ({
      id: `p${String(index).padStart(4, '0')}`,
      displayName: `Person ${index}`,
      revision: 1,
      lastContact: null,
    }));
    const client = createClient();

    await syncPeople(client, CHANGES_ONLY);

    expect(kept(client).people).toHaveLength(count);
    expect(server.asked.filter((name) => name === 'ChangedPeople')).toHaveLength(3);
  });

  it('picks up a last contact logged elsewhere when asked to', async () => {
    const client = createClient();
    await syncPeople(client, CHANGES_ONLY);
    // Logging an interaction is not a change to the person: the revision stays.
    server.people = server.people.map((person) => ({ ...person, lastContact: '2026-05-05T05:05:05.000Z' }));
    server.asked = [];

    await syncPeople(client, { withLastContact: true });

    expect(server.asked).toEqual(['PeopleRevision', 'LastContacts']);
    const ada = kept(client).people.find((person) => person.id === 'a');
    expect(ada?.interactions[0]?.occurredAt).toEqual(new Date('2026-05-05T05:05:05.000Z'));
  });

  it('reads last contacts on the first refresh of a list kept from an earlier run', async () => {
    const first = createClient();
    await syncPeople(first, CHANGES_ONLY);
    // A new run of the app: a new client over the cache the device kept.
    const restored = createClient();
    restored.cache.restore(first.cache.extract());
    server.asked = [];

    await syncPeople(restored, CHANGES_ONLY);

    expect(server.asked).toEqual(['PeopleRevision', 'LastContacts']);
  });

  it('starts over when the server counts from an older number', async () => {
    const client = createClient();
    await syncPeople(client, CHANGES_ONLY);
    server.revision = 1;
    server.people = [{ id: 'z', displayName: 'Restored', revision: 1, lastContact: null }];

    await syncPeople(client, CHANGES_ONLY);

    expect(kept(client)).toMatchObject({ revision: 1, names: { z: 'Restored' } });
  });

  it('writes nothing fetched for a session that ended meanwhile', async () => {
    const client = createClient();
    let isCleared = false;
    server.beforeAnswer = (operation) => {
      if (operation.operationName === 'ChangedPeople' && isCleared === false) {
        isCleared = true;
        void client.clearStore();
      }
    };

    await syncPeople(client, CHANGES_ONLY);

    expect(kept(client).revision).toBeNull();
  });

  it('runs refreshes one after another', async () => {
    const client = createClient();

    await Promise.all([syncPeople(client, CHANGES_ONLY), syncPeople(client, CHANGES_ONLY)]);

    // The second found the first's list current.
    expect(server.asked).toEqual(['PeopleRevision', 'ChangedPeople', 'PeopleRevision']);
  });

  it('reports a refresh that could not reach the server, and works again after', async () => {
    const client = createClient();
    server.beforeAnswer = () => {
      throw new TypeError('Network request failed');
    };

    await expect(syncPeople(client, CHANGES_ONLY)).rejects.toThrow('Network request failed');

    server.beforeAnswer = () => undefined;
    await syncPeople(client, CHANGES_ONLY);
    expect(kept(client).revision).toBe(2);
  });
});
