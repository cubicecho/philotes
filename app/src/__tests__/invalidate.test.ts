import { InMemoryCache } from '@apollo/client';
import { parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { invalidateQueryFields } from '@/lib/invalidate';

// Parsed here, not tagged, so codegen does not collect these as the app's own operations.
const PERSONS = parse(`
  query Persons {
    persons {
      id
      firstName
    }
  }
`);
const ONE_PERSON = parse(`
  query OnePerson($id: UUID!) {
    persons(where: { id: { eq: $id } }) {
      id
      firstName
    }
  }
`);
const LABELS = parse(`
  query Labels {
    labels {
      id
      label
    }
  }
`);
const ADA = { __typename: 'Person', id: '1', firstName: 'Ada' };

describe('invalidateQueryFields', () => {
  it('drops the field for every set of arguments and leaves other fields alone', () => {
    const cache = new InMemoryCache();
    cache.writeQuery({ query: PERSONS, data: { persons: [ADA] } });
    cache.writeQuery({ query: ONE_PERSON, variables: { id: '1' }, data: { persons: [ADA] } });
    cache.writeQuery({ query: LABELS, data: { labels: [{ __typename: 'Label', id: '9', label: 'Family' }] } });

    invalidateQueryFields(cache, ['persons']);

    expect(cache.readQuery({ query: PERSONS })).toBeNull();
    expect(cache.readQuery({ query: ONE_PERSON, variables: { id: '1' } })).toBeNull();
    expect(cache.readQuery({ query: LABELS })).not.toBeNull();
  });
});
