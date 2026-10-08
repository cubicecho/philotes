import { InMemoryCache } from '@apollo/client';
import { parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { scalarTypePolicies } from '@/__generated__/type-policies';
import { CACHE_FORMAT, decodeCache, encodeCache } from '@/lib/cache-codec';

// Parsed here, not tagged, so codegen does not collect this as one of the app's own operations.
const PERSON = parse(`
  query Person {
    persons {
      id
      displayName
      updatedAt
      importantDates {
        id
        date
        createdAt
      }
      interactions {
        occurredAt
      }
    }
  }
`);

const PERSON_DATA = {
  persons: [
    {
      __typename: 'Person',
      id: 'p1',
      displayName: 'Ada Lovelace',
      updatedAt: '2026-03-09T14:32:00.000Z',
      importantDates: [
        { __typename: 'ImportantDate', id: 'd1', date: '1815-12-10', createdAt: '2026-01-02T03:04:05.000Z' },
      ],
      // No id, so the cache keeps it inside the person rather than as an entry of its own.
      interactions: [{ __typename: 'Interaction', occurredAt: '2026-02-01T10:00:00.000Z' }],
    },
  ],
};

function filledCache(): InMemoryCache {
  const cache = new InMemoryCache({ typePolicies: scalarTypePolicies });
  cache.writeQuery({ query: PERSON, data: PERSON_DATA });
  return cache;
}

describe('the stored cache', () => {
  it('reads back what was written, with dates as dates', () => {
    const cache = filledCache();
    const before = cache.readQuery({ query: PERSON });

    const restored = new InMemoryCache({ typePolicies: scalarTypePolicies });
    const data = decodeCache(encodeCache(cache.extract()));
    expect(data).not.toBeNull();
    restored.restore(data ?? {});

    const after = restored.readQuery<typeof PERSON_DATA>({ query: PERSON });
    expect(after).toEqual(before);
    const [person] = after?.persons ?? [];
    expect(person?.updatedAt).toBeInstanceOf(Date);
    expect(person?.interactions[0]?.occurredAt).toBeInstanceOf(Date);
    expect(person?.importantDates[0]?.date).toBeInstanceOf(Date);
  });

  it('writes a day as the day, not as an instant', () => {
    const text = encodeCache(filledCache().extract());

    expect(text).toContain('"date":"1815-12-10"');
    expect(text).toContain('"updatedAt":"2026-03-09T14:32:00.000Z"');
  });

  it('leaves alone a string that only looks like a date', () => {
    const cache = new InMemoryCache({ typePolicies: scalarTypePolicies });
    cache.writeQuery({
      query: PERSON,
      data: { persons: [{ ...PERSON_DATA.persons[0], displayName: '2026-03-09T14:32:00.000Z' }] },
    });

    const data = decodeCache(encodeCache(cache.extract()));

    expect(data?.['Person:p1']?.displayName).toBe('2026-03-09T14:32:00.000Z');
  });

  it('refuses a copy written in another format', () => {
    const text = JSON.stringify({ format: CACHE_FORMAT + 1, data: {} });

    expect(decodeCache(text)).toBeNull();
  });

  it('refuses text that is not a copy at all', () => {
    expect(decodeCache('not json')).toBeNull();
    expect(decodeCache('null')).toBeNull();
    expect(decodeCache('{"format":1}')).toBeNull();
  });
});
