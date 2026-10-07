import { useMutation } from '@apollo/client';
import { graphql } from '@/__generated__/gql';
import { LabelChip } from '@/components/domain/label/label-chip';
import { type TagOption, TagPickerPanel } from '@/components/domain/person/tag-picker';

export const ATTACH_NOTE_TAG = graphql(`
  mutation AttachTagToNote($noteId: UUID!, $labelId: UUID!) {
    createNoteTag(values: { noteId: $noteId, labelId: $labelId }) {
      noteId
      labelId
    }
  }
`);

const DETACH_NOTE_TAG = graphql(`
  mutation DetachTagFromNote($noteId: UUID!, $labelId: UUID!) {
    deleteNoteTag(
      where: { noteId: { eq: $noteId }, labelId: { eq: $labelId } }
    ) {
      noteId
      labelId
    }
  }
`);

interface NoteTagChipProps {
  noteId: string;
  labelId: string;
  label: string;
  color: string;
  onDetach: () => void;
}

export function NoteTagChip({ noteId, labelId, label, color, onDetach }: NoteTagChipProps) {
  const [detachTag] = useMutation(DETACH_NOTE_TAG);

  const handleDetach = async () => {
    await detachTag({ variables: { noteId, labelId } });
    onDetach();
  };

  return <LabelChip label={label} color={color} onRemove={handleDetach} />;
}

// ---------------------------------------------------------------------------
// Add-tag picker on a note (for existing notes)
// ---------------------------------------------------------------------------

interface NoteTagPickerProps {
  noteId: string;
  allTags: TagOption[];
  attachedTagIds: Set<string>;
  onClose: () => void;
  onAdd: () => void;
}

export function NoteTagPicker({ noteId, allTags, attachedTagIds, onClose, onAdd }: NoteTagPickerProps) {
  const [attachTag] = useMutation(ATTACH_NOTE_TAG);

  const handleSelect = async (labelId: string) => {
    await attachTag({ variables: { noteId, labelId } });
    onAdd();
    onClose();
  };

  return <TagPickerPanel allTags={allTags} attachedTagIds={attachedTagIds} onSelect={handleSelect} onClose={onClose} />;
}
