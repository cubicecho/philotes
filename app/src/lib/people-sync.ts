import type { ApolloClient } from '@apollo/client';
import { graphql } from '@/__generated__/gql';
import type { PersonRowFragment } from '@/__generated__/graphql';
import { PAGE_SIZE_DEFAULTS } from '@/lib/defaults';
import { mergePeople } from '@/lib/people';

// The people list is kept whole in the cache, and so on the device, and is brought up to date by
// asking the server only for what changed. The server numbers every change to a user's people
// (`User.personsRevision`) and stamps each person with the number of their last change, so "what
// changed since I last looked" is one filter.

/** A person as the people list shows them. Everything the list searches, orders and draws. */
export const PERSON_ROW = graphql(`
  fragment PersonRow on Person {
    id
    displayName
    sortName
    nickname
    organization
    avatarPath
    labels(limit: 20) {
      id
      label
      color
    }
    contactInfos(limit: 10) {
      id
      type
      value
      isPrimary
    }
    interactions(limit: 1, orderBy: { occurredAt: { direction: desc, priority: 1 } }) {
      occurredAt
    }
  }
`);

/** The list as the cache keeps it. Never sent: the field exists only in the app. */
export const PEOPLE_SNAPSHOT = graphql(`
  query PeopleSnapshot {
    peopleSnapshot @client {
      revision
      people {
        ...PersonRow
      }
    }
  }
`);

const PEOPLE_REVISION = graphql(`
  query PeopleRevision {
    me {
      id
      personsRevision
    }
  }
`);

// Paged by cursor, not by offset: a person deleted between two pages would shift every later row
// up by one, and the row that moved onto the page boundary would be skipped.
const CHANGED_PEOPLE = graphql(`
  query ChangedPeople($where: PersonFilters, $limit: Int!, $after: String) {
    persons(where: $where, orderBy: { id: { direction: asc, priority: 1 } }, limit: $limit, after: $after) {
      ...PersonRow
      cursor
    }
  }
`);

const REMOVED_PEOPLE = graphql(`
  query RemovedPeople($since: Float!, $limit: Int!, $after: String) {
    personTombstones(
      where: { revision: { gt: $since } }
      orderBy: { id: { direction: asc, priority: 1 } }
      limit: $limit
      after: $after
    ) {
      id
      personId
      cursor
    }
  }
`);

const LAST_CONTACTS = graphql(`
  query LastContacts($limit: Int!, $after: String) {
    persons(orderBy: { id: { direction: asc, priority: 1 } }, limit: $limit, after: $after) {
      id
      cursor
      interactions(limit: 1, orderBy: { occurredAt: { direction: desc, priority: 1 } }) {
        occurredAt
      }
    }
  }
`);

const LAST_CONTACT = graphql(`
  fragment PersonLastContact on Person {
    interactions(limit: 1, orderBy: { occurredAt: { direction: desc, priority: 1 } }) {
      occurredAt
    }
  }
`);

/** How thorough a refresh is. */
export interface SyncOptions {
  /**
   * Also reads everyone's last contact. Logging an interaction does not count as a change to the
   * person, so one logged on another device reaches the list only this way. The first refresh
   * after the cache was emptied or restored does it regardless.
   */
  withLastContact: boolean;
}

/** What the module remembers about one client. */
interface SyncState {
  /** The refreshes asked for so far, each starting when the one before has ended. */
  queue: Promise<void>;
  /** Whether everyone's last contact has been read since the cache was last emptied. */
  hasReadLastContacts: boolean;
}

const states = new WeakMap<ApolloClient<unknown>, SyncState>();

/** Thrown inside a refresh whose session ended while it ran, to drop what it fetched. */
class SessionEndedError extends Error {
  override name = 'SessionEndedError';
}

/** A row that says where it stands in its list. */
interface Paged {
  cursor: string | null;
}

/**
 * Reads a list to its end, a page at a time.
 *
 * @typeParam T - A row of the list.
 * @param fetchPage - Fetches the page after a cursor, or the first page for null.
 * @param pageSize - How many rows a full page has.
 * @returns Every row.
 */
async function readAll<T extends Paged>(
  fetchPage: (after: string | null) => Promise<readonly T[]>,
  pageSize: number,
): Promise<T[]> {
  const rows: T[] = [];
  let after: string | null = null;
  for (;;) {
    const page = await fetchPage(after);
    rows.push(...page);
    after = page.at(-1)?.cursor ?? null;
    const isLastPage = page.length < pageSize || after === null;
    if (isLastPage) {
      return rows;
    }
  }
}

/**
 * Reads the list the cache keeps.
 *
 * @param client - The Apollo client.
 * @returns The list and its revision, or null when there is none or part of it is missing.
 */
function readSnapshot(client: ApolloClient<unknown>): { revision: number; people: PersonRowFragment[] } | null {
  return client.readQuery({ query: PEOPLE_SNAPSHOT })?.peopleSnapshot ?? null;
}

/**
 * Fetches the people changed after a revision.
 *
 * @param client - The Apollo client.
 * @param since - The revision the list is already complete up to, or null for everyone.
 * @returns The people, as they are now.
 */
function fetchChanged(client: ApolloClient<unknown>, since: number | null): Promise<PersonRowFragment[]> {
  const limit = PAGE_SIZE_DEFAULTS.peopleSync;
  const where = since === null ? undefined : { revision: { gt: since } };
  return readAll(async (after) => {
    // Not cached: the list below is where these rows are kept.
    const { data } = await client.query({
      query: CHANGED_PEOPLE,
      variables: { where, limit, after },
      fetchPolicy: 'no-cache',
    });
    return data.persons;
  }, limit);
}

/**
 * Fetches the ids of the people deleted after a revision.
 *
 * @param client - The Apollo client.
 * @param since - The revision the list is complete up to.
 * @returns The ids.
 */
async function fetchRemovedIds(client: ApolloClient<unknown>, since: number): Promise<string[]> {
  const limit = PAGE_SIZE_DEFAULTS.peopleSyncLight;
  const tombstones = await readAll(async (after) => {
    const { data } = await client.query({
      query: REMOVED_PEOPLE,
      variables: { since, limit, after },
      fetchPolicy: 'no-cache',
    });
    return data.personTombstones;
  }, limit);
  return tombstones.map((tombstone) => tombstone.personId);
}

/**
 * Reads everyone's last contact and writes it onto the people the cache holds.
 *
 * @param client - The Apollo client.
 * @param isSessionOver - Whether the session the refresh began in has ended.
 */
async function refreshLastContacts(client: ApolloClient<unknown>, isSessionOver: () => boolean): Promise<void> {
  const limit = PAGE_SIZE_DEFAULTS.peopleSyncLight;
  const rows = await readAll(async (after) => {
    const { data } = await client.query({ query: LAST_CONTACTS, variables: { limit, after }, fetchPolicy: 'no-cache' });
    return data.persons;
  }, limit);
  if (isSessionOver()) {
    throw new SessionEndedError();
  }
  // One batch, so the list is drawn again once and not once for each person.
  client.cache.batch({
    update: (cache) => {
      for (const { id, interactions } of rows) {
        cache.writeFragment({
          id: cache.identify({ __typename: 'Person', id }),
          fragment: LAST_CONTACT,
          data: { __typename: 'Person', interactions },
        });
      }
    },
  });
}

/**
 * One refresh, start to end.
 *
 * @param client - The Apollo client.
 * @param state - What is remembered about the client.
 * @param options - How thorough to be.
 */
async function runSync(client: ApolloClient<unknown>, state: SyncState, options: SyncOptions): Promise<void> {
  let isOver = false;
  // What a refresh fetched belongs to the session it began in. `onClearStore` is how every way a
  // session ends is seen from here.
  const stopWatching = client.onClearStore(async () => {
    isOver = true;
    state.hasReadLastContacts = false;
  });
  const isSessionOver = (): boolean => isOver;
  try {
    // Asked first: every person changed up to this number is committed by now, so the list written
    // below is complete up to it whatever else changes while the pages are read.
    const head = await client.query({ query: PEOPLE_REVISION, fetchPolicy: 'no-cache' });
    const revision = head.data.me?.personsRevision;
    if (revision === undefined) {
      return;
    }
    const kept = readSnapshot(client);
    // A server put back from a backup counts from an older number, and nothing kept can be trusted.
    const snapshot = kept !== null && kept.revision <= revision ? kept : null;
    const isCurrent = snapshot !== null && snapshot.revision === revision;
    if (isCurrent === false) {
      const changed = await fetchChanged(client, snapshot?.revision ?? null);
      const removedIds = snapshot === null ? [] : await fetchRemovedIds(client, snapshot.revision);
      if (isSessionOver()) {
        throw new SessionEndedError();
      }
      client.writeQuery({
        query: PEOPLE_SNAPSHOT,
        data: {
          peopleSnapshot: {
            __typename: 'PeopleSnapshot',
            revision,
            people: mergePeople(snapshot?.people ?? [], changed, removedIds),
          },
        },
      });
    }
    // A list read whole just now already has everyone's last contact.
    const isFreshList = snapshot === null;
    const needsLastContacts = options.withLastContact || state.hasReadLastContacts === false;
    if (needsLastContacts && isFreshList === false) {
      await refreshLastContacts(client, isSessionOver);
    }
    state.hasReadLastContacts = true;
  } catch (error) {
    const isDropped = error instanceof SessionEndedError;
    if (isDropped === false) {
      throw error;
    }
  } finally {
    stopWatching();
  }
}

/**
 * Brings the people list in the cache up to date with the server. Refreshes of one client run one
 * after another, so two can never write over each other.
 *
 * @param client - The Apollo client.
 * @param options - How thorough to be.
 * @returns Once the list is current.
 * @throws What the server could not be asked: a network error while offline, most often.
 */
export function syncPeople(client: ApolloClient<unknown>, options: SyncOptions): Promise<void> {
  const state = states.get(client) ?? { queue: Promise.resolve(), hasReadLastContacts: false };
  states.set(client, state);
  const run = state.queue.then(() => runSync(client, state, options));
  // The queue carries on after a failed refresh; the caller of that one still hears of it.
  state.queue = run.catch(() => undefined);
  return run;
}
