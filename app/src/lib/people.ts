// Plain functions over the people list a device keeps: bringing it up to date, searching it and
// ordering it. They touch no cache and no network, so they are what the tests cover.

/** The least a person needs to be kept in the list. */
export interface PersonKey {
  id: string;
}

/** What searching reads of a person. */
export interface SearchablePerson {
  displayName: string;
  nickname: string | null;
  organization: string | null;
  contactInfos: ReadonlyArray<{ value: string }>;
}

/** What ordering reads of a person. */
export interface SortablePerson extends PersonKey {
  sortName: string;
  /** The newest interaction, if any: the list keeps no more than that one. */
  interactions: ReadonlyArray<{ occurredAt: Date }>;
}

/** What the people list can be ordered by, as the sort picker and the URL spell it. */
export const PeopleSort = { Name: 'name', LastContacted: 'lastContacted' } as const;
export type PeopleSort = (typeof PeopleSort)[keyof typeof PeopleSort];

/** The two directions of a sort, as the sort picker and the URL spell them. */
export const SortDirection = { Ascending: 'asc', Descending: 'desc' } as const;
export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];

/**
 * Brings a list of people up to date with what changed on the server.
 *
 * @typeParam T - A person as the list keeps them.
 * @param current - The list as it was.
 * @param changed - People created or changed since, as they are now.
 * @param removedIds - Ids of people deleted since.
 * @returns The list as it is now. Order is not kept; `sortPeople` orders it for showing.
 */
export function mergePeople<T extends PersonKey>(
  current: readonly T[],
  changed: readonly T[],
  removedIds: Iterable<string>,
): T[] {
  const byId = new Map(current.map((person) => [person.id, person]));
  for (const id of removedIds) {
    byId.delete(id);
  }
  // After the removals: a person in both was changed and is still there.
  for (const person of changed) {
    byId.set(person.id, person);
  }
  return [...byId.values()];
}

/**
 * Finds the people a search text matches, the way the server's search does: anywhere in the name,
 * the nickname, the organisation or a contact detail, whatever the case.
 *
 * @typeParam T - A person as the list keeps them.
 * @param people - The list to search.
 * @param text - What was typed.
 * @returns The matches, in the order they were given. Everyone, for an empty text.
 */
export function searchPeople<T extends SearchablePerson>(people: readonly T[], text: string): T[] {
  const wanted = text.trim().toLowerCase();
  if (wanted === '') {
    return [...people];
  }
  const matches = (value: string | null): boolean => value?.toLowerCase().includes(wanted) ?? false;
  return people.filter(
    (person) =>
      matches(person.displayName) ||
      matches(person.nickname) ||
      matches(person.organization) ||
      person.contactInfos.some((info) => matches(info.value)),
  );
}

const nameOrder = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/**
 * Compares two people by name, then by id so that two people who share a name keep one order.
 *
 * @param a - One person.
 * @param b - The other.
 * @returns Negative when `a` comes first.
 */
function byName(a: SortablePerson, b: SortablePerson): number {
  return nameOrder.compare(a.sortName, b.sortName) || a.id.localeCompare(b.id);
}

/**
 * Reads when a person was last in contact.
 *
 * @param person - The person.
 * @returns The time in milliseconds, or null when nothing is logged.
 */
function lastContactOf(person: SortablePerson): number | null {
  return person.interactions[0]?.occurredAt.getTime() ?? null;
}

/**
 * Orders people for showing.
 *
 * @typeParam T - A person as the list keeps them.
 * @param people - The people.
 * @param sort - What to order by.
 * @param direction - Which way.
 * @returns A new, ordered list. By last contact, people never contacted come last in either direction.
 */
export function sortPeople<T extends SortablePerson>(
  people: readonly T[],
  sort: PeopleSort,
  direction: SortDirection,
): T[] {
  const sign = direction === SortDirection.Ascending ? 1 : -1;
  if (sort === PeopleSort.Name) {
    return [...people].sort((a, b) => sign * byName(a, b));
  }
  return [...people].sort((a, b) => {
    const aTime = lastContactOf(a);
    const bTime = lastContactOf(b);
    if (aTime === null || bTime === null) {
      const isNeitherContacted = aTime === null && bTime === null;
      if (isNeitherContacted) {
        return byName(a, b);
      }
      return aTime === null ? 1 : -1;
    }
    return sign * (aTime - bTime) || byName(a, b);
  });
}
