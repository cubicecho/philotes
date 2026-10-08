import { describe, expect, it } from 'vitest';
import { mergePeople, PeopleSort, SortDirection, searchPeople, sortPeople } from '@/lib/people';

interface TestPerson {
  id: string;
  displayName: string;
  sortName: string;
  nickname: string | null;
  organization: string | null;
  contactInfos: Array<{ value: string }>;
  interactions: Array<{ occurredAt: Date }>;
}

/** A person with only what a test cares about filled in. */
function person(id: string, overrides: Partial<TestPerson> = {}): TestPerson {
  return {
    id,
    displayName: id,
    sortName: id,
    nickname: null,
    organization: null,
    contactInfos: [],
    interactions: [],
    ...overrides,
  };
}

const ids = (people: TestPerson[]): string[] => people.map(({ id }) => id);

describe('mergePeople', () => {
  it('replaces a changed person and adds a new one', () => {
    const merged = mergePeople(
      [person('a'), person('b', { displayName: 'Before' })],
      [person('b', { displayName: 'After' }), person('c')],
      [],
    );

    expect(ids(merged).sort()).toEqual(['a', 'b', 'c']);
    expect(merged.find(({ id }) => id === 'b')?.displayName).toBe('After');
  });

  it('drops a deleted person', () => {
    const merged = mergePeople([person('a'), person('b')], [], ['a']);

    expect(ids(merged)).toEqual(['b']);
  });

  it('ignores the deletion of someone it never had', () => {
    const merged = mergePeople([person('a')], [], ['gone']);

    expect(ids(merged)).toEqual(['a']);
  });

  it('leaves the list it was given alone', () => {
    const current = [person('a')];

    mergePeople(current, [person('b')], ['a']);

    expect(ids(current)).toEqual(['a']);
  });
});

describe('searchPeople', () => {
  const people = [
    person('ada', { displayName: 'Ada Lovelace', nickname: 'Countess' }),
    person('grace', { displayName: 'Grace Hopper', organization: 'US Navy' }),
    person('alan', { displayName: 'Alan Turing', contactInfos: [{ value: 'alan@bletchley.example' }] }),
  ];

  it('gives everyone for an empty text', () => {
    expect(ids(searchPeople(people, '  '))).toEqual(['ada', 'grace', 'alan']);
  });

  it('matches part of a name, whatever the case', () => {
    expect(ids(searchPeople(people, 'LOVE'))).toEqual(['ada']);
  });

  it('matches a nickname, an organisation and a contact detail', () => {
    expect(ids(searchPeople(people, 'countess'))).toEqual(['ada']);
    expect(ids(searchPeople(people, 'navy'))).toEqual(['grace']);
    expect(ids(searchPeople(people, 'bletchley'))).toEqual(['alan']);
  });

  it('gives nobody when nothing matches', () => {
    expect(searchPeople(people, 'zzz')).toEqual([]);
  });
});

describe('sortPeople', () => {
  const march = new Date('2026-03-01T00:00:00Z');
  const april = new Date('2026-04-01T00:00:00Z');
  const people = [
    person('2', { sortName: 'turing alan', interactions: [{ occurredAt: march }] }),
    person('1', { sortName: 'Hopper Grace' }),
    person('3', { sortName: 'lovelace ada', interactions: [{ occurredAt: april }] }),
  ];

  it('orders by name, whatever the case', () => {
    expect(ids(sortPeople(people, PeopleSort.Name, SortDirection.Ascending))).toEqual(['1', '3', '2']);
    expect(ids(sortPeople(people, PeopleSort.Name, SortDirection.Descending))).toEqual(['2', '3', '1']);
  });

  it('keeps two people of one name in one order', () => {
    const twins = [person('b', { sortName: 'same' }), person('a', { sortName: 'same' })];

    expect(ids(sortPeople(twins, PeopleSort.Name, SortDirection.Ascending))).toEqual(['a', 'b']);
  });

  it('orders by last contact, with the never contacted last either way', () => {
    expect(ids(sortPeople(people, PeopleSort.LastContacted, SortDirection.Descending))).toEqual(['3', '2', '1']);
    expect(ids(sortPeople(people, PeopleSort.LastContacted, SortDirection.Ascending))).toEqual(['2', '3', '1']);
  });
});
