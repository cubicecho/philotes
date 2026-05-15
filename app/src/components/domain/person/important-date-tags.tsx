import { useMutation } from '@apollo/client';
import { Tag, X } from 'lucide-react';
import { graphql } from '@/__generated__/gql';

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const ATTACH_TAG = graphql(`
  mutation AttachTagToImportantDate($importantDateId: String!, $labelId: String!) {
    createImportantDateTag(
      values: { importantDateId: $importantDateId, labelId: $labelId }
    ) {
      importantDateId
      labelId
    }
  }
`);

const DETACH_TAG = graphql(`
  mutation DetachTagFromImportantDate($importantDateId: String!, $labelId: String!) {
    deleteImportantDateTags(
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

  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
      <span
        className="inline-block h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
      <button
        type="button"
        onClick={handleDetach}
        className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
        aria-label={`Remove tag ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add-tag picker
// ---------------------------------------------------------------------------

interface AddTagPickerProps {
  importantDateId: string;
  allTags: Array<{ id: string; label: string; color: string }>;
  attachedTagIds: Set<string>;
  onClose: () => void;
  onAdd: () => void;
}

function AddTagPicker({ importantDateId, allTags, attachedTagIds, onClose, onAdd }: AddTagPickerProps) {
  const [attachTag] = useMutation(ATTACH_TAG);

  const available = allTags.filter((t) => !attachedTagIds.has(t.id));

  const handleSelect = async (labelId: string) => {
    await attachTag({ variables: { importantDateId, labelId } });
    onAdd();
    onClose();
  };

  if (available.length === 0) {
    return (
      <div className="flex flex-wrap gap-1.5 rounded-md border border-border p-3 text-xs text-muted-foreground">
        All tags attached.
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-border p-3">
      {available.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => handleSelect(t.id)}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer"
        >
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: t.color }}
            aria-hidden="true"
          />
          {t.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onClose}
        className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface ImportantDateTagsProps {
  importantDateId: string;
  tags: Array<{ id: string; label: string; color: string }>;
  allTags: Array<{ id: string; label: string; color: string }>;
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
    <div className="mt-1.5 space-y-1.5">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
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
        </div>
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
        <button
          type="button"
          onClick={() => onShowAdd(true)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Tag className="h-3 w-3" />
          Add tag
        </button>
      )}
    </div>
  );
}
