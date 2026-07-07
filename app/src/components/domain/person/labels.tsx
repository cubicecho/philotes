import { useMutation } from '@apollo/client';
import { Plus } from 'lucide-react';

import { graphql } from '@/__generated__/gql';
import type { Person_LabelsFragment } from '@/__generated__/graphql';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LabelChip } from '@/components/ui/label-chip';

// ---------------------------------------------------------------------------
// Fragment
// ---------------------------------------------------------------------------

export const PERSON_LABELS = graphql(`
  fragment Person_Labels on Person {
    id
    labels {
      id
      label
      color
    }
  }
`);

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const ATTACH_LABEL = graphql(`
  mutation AttachLabelToPerson($personId: String!, $labelId: String!) {
    createPersonLabel(values: { personId: $personId, labelId: $labelId }) {
      personId
      labelId
    }
  }
`);

const DETACH_LABEL = graphql(`
  mutation DetachLabelFromPerson($personId: String!, $labelId: String!) {
    deletePersonLabels(
      where: { personId: { eq: $personId }, labelId: { eq: $labelId } }
    ) {
      personId
      labelId
    }
  }
`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PersonLabelsProps {
  person: Person_LabelsFragment;
  allLabels: Array<{ id: string; label: string; color: string }>;
  onDelete: (labelId: string) => void;
  onAdd: (labelId: string) => void;
  showAdd?: boolean;
  onShowAdd?: (show: boolean) => void;
}

// ---------------------------------------------------------------------------
// Attached label chip (detaches on remove)
// ---------------------------------------------------------------------------

interface AttachedLabelChipProps {
  personId: string;
  labelId: string;
  label: string;
  color: string;
  onDelete: (labelId: string) => void;
}

function AttachedLabelChip({ personId, labelId, label, color, onDelete }: AttachedLabelChipProps) {
  const [detachLabel] = useMutation(DETACH_LABEL);

  const handleDetach = async () => {
    await detachLabel({ variables: { personId, labelId } });
    onDelete(labelId);
  };

  return <LabelChip label={label} color={color} onRemove={handleDetach} />;
}

// ---------------------------------------------------------------------------
// Add-label picker
// ---------------------------------------------------------------------------

interface AddLabelPickerProps {
  personId: string;
  allLabels: Array<{ id: string; label: string; color: string }>;
  attachedLabelIds: Set<string>;
  onClose: () => void;
  onAdd: (labelId: string) => void;
}

function AddLabelPicker({ personId, allLabels, attachedLabelIds, onClose, onAdd }: AddLabelPickerProps) {
  const [attachLabel] = useMutation(ATTACH_LABEL);

  const available = allLabels.filter((l) => !attachedLabelIds.has(l.id));

  const handleSelect = async (labelId: string) => {
    await attachLabel({ variables: { personId, labelId } });
    onAdd(labelId);
    onClose();
  };

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-border p-3">
      {available.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => handleSelect(l.id)}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer"
        >
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: l.color }}
            aria-hidden="true"
          />
          {l.label}
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

export function PersonLabels({ person, allLabels, onDelete, onAdd, showAdd = false, onShowAdd }: PersonLabelsProps) {
  const attachedIds = new Set(person.labels.map((l) => l.id));

  const hasUnattached = allLabels.some((l) => !attachedIds.has(l.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {person.labels.map((l) => (
        <AttachedLabelChip
          key={l.id}
          personId={person.id}
          labelId={l.id}
          label={l.label}
          color={l.color}
          onDelete={onDelete}
        />
      ))}
      {hasUnattached && onShowAdd && (
        <button
          type="button"
          onClick={() => onShowAdd(true)}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Label
        </button>
      )}

      <Dialog open={showAdd} onOpenChange={onShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Label</DialogTitle>
          </DialogHeader>
          <AddLabelPicker
            personId={person.id}
            allLabels={allLabels}
            attachedLabelIds={attachedIds}
            onClose={() => onShowAdd?.(false)}
            onAdd={(labelId) => {
              onAdd(labelId);
              onShowAdd?.(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
