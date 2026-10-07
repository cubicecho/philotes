import { useMutation } from '@apollo/client';
import { graphql } from '@/__generated__/gql';
import { LabelChip } from '@/components/domain/label/label-chip';
import { type TagOption, TagPickerPanel } from '@/components/domain/person/tag-picker';

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

const DETACH_INTERACTION_TAG = graphql(`
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

// ---------------------------------------------------------------------------
// Tag chip (detachable)
// ---------------------------------------------------------------------------

interface InteractionTagChipProps {
  interactionId: string;
  labelId: string;
  label: string;
  color: string;
  onDetach: () => void;
}

export function InteractionTagChip({ interactionId, labelId, label, color, onDetach }: InteractionTagChipProps) {
  const [detachTag] = useMutation(DETACH_INTERACTION_TAG);

  const handleDetach = async () => {
    await detachTag({ variables: { interactionId, labelId } });
    onDetach();
  };

  return <LabelChip label={label} color={color} onRemove={handleDetach} />;
}

// ---------------------------------------------------------------------------
// Tag picker
// ---------------------------------------------------------------------------

interface InteractionTagPickerProps {
  interactionId: string;
  allTags: TagOption[];
  attachedTagIds: Set<string>;
  onClose: () => void;
  onAdd: () => void;
}

export function InteractionTagPicker({
  interactionId,
  allTags,
  attachedTagIds,
  onClose,
  onAdd,
}: InteractionTagPickerProps) {
  const [attachTag] = useMutation(ATTACH_INTERACTION_TAG);

  const handleSelect = async (labelId: string) => {
    await attachTag({ variables: { interactionId, labelId } });
    onAdd();
    onClose();
  };

  return <TagPickerPanel allTags={allTags} attachedTagIds={attachedTagIds} onSelect={handleSelect} onClose={onClose} />;
}
