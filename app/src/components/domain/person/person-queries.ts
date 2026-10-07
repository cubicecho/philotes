import { graphql } from '@/__generated__/gql';

/** One person's notes, newest first. Read with `useAllRows`, a page at a time. */
export const GET_PERSON_NOTES = graphql(`
  query GetPersonNotes($personId: UUID!, $limit: Int!, $offset: Int!) {
    notes(
      where: { personId: { eq: $personId } }
      limit: $limit
      offset: $offset
      orderBy: { createdAt: { direction: desc, priority: 1 }, id: { direction: asc, priority: 2 } }
    ) {
      id
      body
      labels(limit: 10) {
        id
        label
        color
      }
      mentions(limit: 20) {
        id
        displayName
      }
    }
  }
`);

/** One person's interactions, newest first. Read with `useAllRows`, a page at a time. */
export const GET_PERSON_INTERACTIONS = graphql(`
  query GetPersonInteractions($personId: UUID!, $limit: Int!, $offset: Int!) {
    interactions(
      where: { personId: { eq: $personId } }
      limit: $limit
      offset: $offset
      orderBy: { occurredAt: { direction: desc, priority: 1 }, id: { direction: asc, priority: 2 } }
    ) {
      id
      personId
      channel
      occurredAt
      sentiment
      note
      labels(limit: 10) {
        id
        label
        color
      }
    }
  }
`);
