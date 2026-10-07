import { graphql } from '@/__generated__/gql';
import type { GetPersonDetailQuery } from '@/__generated__/graphql';

/** The person a person's page shows, with everything its sections list. */
export type PersonDetail = NonNullable<GetPersonDetailQuery['person']>;

/** A label as the page's pickers and chips take it. */
export interface DetailLabel {
  id: string;
  label: string;
  color: string;
}

/** Another person as a picker names them. */
export interface PersonStub {
  id: string;
  firstName: string;
  lastName: string;
}

export const GET_PERSON_DETAIL = graphql(`
  query GetPersonDetail($id: UUID!) {
    person(where: { id: { eq: $id } }) {
      id
      firstName
      lastName
      avatarPath
      contactFrequency
      howWeMet
      firstMetDate
      createdAt
      updatedAt
      labels(limit: 50) {
        id
        label
        color
      }
      gratitudes(limit: 100, orderBy: { createdAt: { direction: desc, priority: 1 } }) {
        id
        body
      }
      importantDates(limit: 50) {
        id
        name
        description
        date
        recurrence
        milestoneType
        labels(limit: 10) {
          id
          label
          color
        }
        taggedPersons(limit: 20) {
          id
          firstName
          lastName
        }
      }
      mentionedInNotes(limit: 50) {
        id
        body
        person {
          id
          firstName
          lastName
        }
      }
      relationships {
        id
        type
        relatedPersonId
        relatedPersonFirstName
        relatedPersonLastName
      }
      tasks(limit: 200) {
        id
        title
        notes
        dueAt
        completedAt
        createdAt
      }
      contactInfos(limit: 50) {
        id
        type
        value
        label
        isPrimary
      }
      addresses(limit: 20) {
        id
        type
        label
        line1
        line2
        city
        state
        postalCode
        country
        isPrimary
      }
    }
  }
`);

export const GET_ALL_PERSONS = graphql(`
  query GetAllPersonsForDetail($limit: Int!, $offset: Int!) {
    persons(
      limit: $limit
      offset: $offset
      orderBy: { createdAt: { direction: asc, priority: 1 }, id: { direction: asc, priority: 2 } }
    ) {
      id
      firstName
      lastName
      avatarPath
      labels(limit: 20) {
        id
        label
        color
      }
      contactInfos(where: { type: { eq: email } }, limit: 5) {
        id
        type
        value
        isPrimary
      }
    }
  }
`);

export const GET_ALL_LABELS = graphql(`
  query GetAllLabelsForDetail($limit: Int!, $offset: Int!) {
    labels(limit: $limit, offset: $offset, orderBy: { label: { direction: asc, priority: 1 }, id: { direction: asc, priority: 2 } }) {
      id
      label
      color
    }
  }
`);

export const DELETE_IMPORTANT_DATE = graphql(`
  mutation DeleteImportantDate($id: UUID!) {
    deleteImportantDate(where: { id: { eq: $id } }) {
      id
    }
  }
`);

export const CREATE_IMPORTANT_DATE = graphql(`
  mutation CreateImportantDate(
    $name: String!
    $date: String!
    $personId: UUID!
    $description: String
    $recurrence: String
    $milestoneType: ImportantDatesMilestoneTypeEnum
  ) {
    createImportantDate(
      values: {
        name: $name
        date: $date
        personId: $personId
        description: $description
        recurrence: $recurrence
        milestoneType: $milestoneType
      }
    ) {
      id
      name
      date
      description
      recurrence
      milestoneType
      personId
    }
  }
`);

export const UPDATE_PERSON = graphql(`
  mutation UpdatePerson(
    $id: UUID!
    $firstName: String!
    $lastName: String!
    $contactFrequency: String
    $howWeMet: String
    $firstMetDate: String
  ) {
    updatePerson(
      set: {
        firstName: $firstName
        lastName: $lastName
        contactFrequency: $contactFrequency
        howWeMet: $howWeMet
        firstMetDate: $firstMetDate
      }
      where: { id: { eq: $id } }
    ) {
      id
      firstName
      lastName
      contactFrequency
      howWeMet
      firstMetDate
    }
  }
`);

export const ATTACH_LABEL_TO_PERSON = graphql(`
  mutation AttachLabelToPersonEdit($personId: UUID!, $labelId: UUID!) {
    createPersonLabel(values: { personId: $personId, labelId: $labelId }) {
      personId
      labelId
    }
  }
`);

export const DETACH_LABEL_FROM_PERSON = graphql(`
  mutation DetachLabelFromPersonEdit($personId: UUID!, $labelId: UUID!) {
    deletePersonLabel(
      where: { personId: { eq: $personId }, labelId: { eq: $labelId } }
    ) {
      personId
      labelId
    }
  }
`);

export const DELETE_PERSON = graphql(`
  mutation DeletePerson($id: UUID!) {
    deletePerson(where: { id: { eq: $id } }) {
      id
    }
  }
`);
