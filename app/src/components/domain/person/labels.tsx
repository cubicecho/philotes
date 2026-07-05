import { useMutation } from '@apollo/client';
import { X } from 'lucide-react';

import { graphql } from '@/__generated__/gql';
import type { Person_LabelsFragment } from '@/__generated__/graphql';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
// Label chip (attached)
// ---------------------------------------------------------------------------

interface LabelChipProps {
  personId: string;
  labelId: string;
  label: string;
  color: string;
  onDelete: (labelId: string) => void;
}

function LabelChip({ personId, labelId, label, color, onDelete }: LabelChipProps) {
  const [detachLabel] = useMutation(DETACH_LABEL);

  const handleDetach = async () => {
    await detachLabel({ variables: { personId, labelId } });
    onDelete(labelId);
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

  return (
    <div className="space-y-2">
      {person.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {person.labels.map((l) => (
            <LabelChip
              key={l.id}
              personId={person.id}
              labelId={l.id}
              label={l.label}
              color={l.color}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {person.labels.length === 0 && <p className="text-muted-foreground text-sm">No tags attached.</p>}

      <Dialog open={showAdd} onOpenChange={onShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
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
