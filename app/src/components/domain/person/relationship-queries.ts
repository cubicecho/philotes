import { graphql } from '@/__generated__/gql';

export const PERSON_RELATIONSHIPS = graphql(`
  fragment Person_Relationships on Person {
    id
    relationships {
      id
      type
      relatedPersonId
      relatedPersonDisplayName
    }
  }
`);

export const GET_RELATIONSHIP_TYPES = graphql(`
  query GetRelationshipTypes($limit: Int!, $offset: Int!) {
    relationshipTypes(limit: $limit, offset: $offset, orderBy: { name: { direction: asc, priority: 1 }, id: { direction: asc, priority: 2 } }) {
      id
      name
    }
  }
`);

export const CREATE_RELATIONSHIP = graphql(`
  mutation CreatePersonRelationship(
    $fromPersonId: UUID!
    $toPersonId: UUID!
    $type: String!
  ) {
    createPersonRelationship(
      values: {
        fromPersonId: $fromPersonId
        toPersonId: $toPersonId
        type: $type
      }
    ) {
      id
      fromPersonId
      toPersonId
      type
    }
  }
`);

export const UPDATE_RELATIONSHIP = graphql(`
  mutation UpdatePersonRelationship($id: UUID!, $type: String!) {
    updatePersonRelationship(
      set: { type: $type }
      where: { id: { eq: $id } }
    ) {
      id
      fromPersonId
      toPersonId
      type
    }
  }
`);

export const DELETE_RELATIONSHIP = graphql(`
  mutation DeletePersonRelationship($id: UUID!) {
    deletePersonRelationship(where: { id: { eq: $id } }) {
      id
    }
  }
`);

export const CREATE_RELATIONSHIP_TYPE = graphql(`
  mutation CreateRelationshipType($name: String!) {
    createRelationshipType(values: { name: $name }) {
      id
      name
    }
  }
`);

export const DELETE_RELATIONSHIP_TYPE = graphql(`
  mutation DeleteRelationshipType($id: UUID!) {
    deleteRelationshipType(where: { id: { eq: $id } }) {
      id
    }
  }
`);
