import { useMutation } from '@apollo/client';
import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { LabelChip } from '@/components/domain/label/label-chip';
import { AddTagButton, type TagOption, TagPickerPanel } from '@/components/domain/person/tag-picker';

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const ATTACH_TAG = graphql(`
  mutation AttachTagToImportantDate($importantDateId: UUID!, $labelId: UUID!) {
    createImportantDateTag(
      values: { importantDateId: $importantDateId, labelId: $labelId }
    ) {
      importantDateId
      labelId
    }
  }
`);

const DETACH_TAG = graphql(`
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

// ---------------------------------------------------------------------------
// Tag chip (attached)
// ---------------------------------------------------------------------------

interface TagChipProps {
  importantDateId: string;
  labelId: string;
  label: string;
  color: string;
  onDetach: () => void;
}

function TagChip({ importantDateId, labelId, label, color, onDetach }: TagChipProps) {
  const [detachTag] = useMutation(DETACH_TAG);

  const handleDetach = async () => {
    await detachTag({ variables: { importantDateId, labelId } });
    onDetach();
  };

  return <LabelChip label={label} color={color} onRemove={handleDetach} />;
}

// ---------------------------------------------------------------------------
// Add-tag picker
// ---------------------------------------------------------------------------

interface AddTagPickerProps {
  importantDateId: string;
  allTags: TagOption[];
  attachedTagIds: Set<string>;
  onClose: () => void;
  onAdd: () => void;
}

function AddTagPicker({ importantDateId, allTags, attachedTagIds, onClose, onAdd }: AddTagPickerProps) {
  const [attachTag] = useMutation(ATTACH_TAG);

  const handleSelect = async (labelId: string) => {
    await attachTag({ variables: { importantDateId, labelId } });
    onAdd();
    onClose();
  };

  return <TagPickerPanel allTags={allTags} attachedTagIds={attachedTagIds} onSelect={handleSelect} onClose={onClose} />;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface ImportantDateTagsProps {
  importantDateId: string;
  tags: TagOption[];
  allTags: TagOption[];
  showAdd: boolean;
  onShowAdd: (show: boolean) => void;
  onChanged: () => void;
}

export function ImportantDateTags({
  importantDateId,
  tags,
  allTags,
  showAdd,
  onShowAdd,
  onChanged,
}: ImportantDateTagsProps) {
  const attachedIds = new Set(tags.map((t) => t.id));

  return (
    <View className="mt-1.5 gap-1.5">
      {tags.length > 0 && (
        <View className="flex-row flex-wrap gap-1">
          {tags.map((t) => (
            <TagChip
              key={t.id}
              importantDateId={importantDateId}
              labelId={t.id}
              label={t.label}
              color={t.color}
              onDetach={onChanged}
            />
          ))}
        </View>
      )}

      {showAdd ? (
        <AddTagPicker
          importantDateId={importantDateId}
          allTags={allTags}
          attachedTagIds={attachedIds}
          onClose={() => onShowAdd(false)}
          onAdd={onChanged}
        />
      ) : (
        <AddTagButton onPress={() => onShowAdd(true)} />
      )}
    </View>
  );
}
