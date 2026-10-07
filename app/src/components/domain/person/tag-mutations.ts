import { graphql } from '@/__generated__/gql';

export const ATTACH_NOTE_TAG = graphql(`
  mutation AttachTagToNote($noteId: UUID!, $labelId: UUID!) {
    createNoteTag(values: { noteId: $noteId, labelId: $labelId }) {
      noteId
      labelId
    }
  }
`);

export const DETACH_NOTE_TAG = graphql(`
  mutation DetachTagFromNote($noteId: UUID!, $labelId: UUID!) {
    deleteNoteTag(
      where: { noteId: { eq: $noteId }, labelId: { eq: $labelId } }
    ) {
      noteId
      labelId
    }
  }
`);

export const ATTACH_INTERACTION_TAG = graphql(`
  mutation AttachInteractionTag($interactionId: UUID!, $labelId: UUID!) {
    createInteractionTag(
      values: { interactionId: $interactionId, labelId: $labelId }
    ) {
      interactionId
      labelId
    }
  }
`);

export const DETACH_INTERACTION_TAG = graphql(`
  mutation DetachInteractionTag($interactionId: UUID!, $labelId: UUID!) {
    deleteInteractionTag(
      where: {
        interactionId: { eq: $interactionId }
        labelId: { eq: $labelId }
      }
    ) {
      interactionId
      labelId
    }
  }
`);

export const ATTACH_IMPORTANT_DATE_TAG = graphql(`
  mutation AttachTagToImportantDate($importantDateId: UUID!, $labelId: UUID!) {
    createImportantDateTag(
      values: { importantDateId: $importantDateId, labelId: $labelId }
    ) {
      importantDateId
      labelId
    }
  }
`);

export const DETACH_IMPORTANT_DATE_TAG = graphql(`
  mutation DetachTagFromImportantDate($importantDateId: UUID!, $labelId: UUID!) {
    deleteImportantDateTag(
      where: {
        importantDateId: { eq: $importantDateId }
        labelId: { eq: $labelId }
      }
    ) {
      importantDateId
      labelId
    }
  }
`);
