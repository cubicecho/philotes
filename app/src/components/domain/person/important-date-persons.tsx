import { useMutation } from '@apollo/client';
import { UserPlus, X } from 'lucide-react';
import { graphql } from '@/__generated__/gql.js';

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const TAG_PERSON = graphql(`
  mutation TagPersonOnImportantDate($importantDateId: String!, $personId: String!) {
    tagPersonOnImportantDate(importantDateId: $importantDateId, personId: $personId)
  }
`);

const UNTAG_PERSON = graphql(`
  mutation UntagPersonOnImportantDate($importantDateId: String!, $personId: String!) {
    untagPersonOnImportantDate(importantDateId: $importantDateId, personId: $personId)
  }
`);

// ---------------------------------------------------------------------------
// Person chip (attached)
// ---------------------------------------------------------------------------

interface PersonChipProps {
  importantDateId: string;
  personId: string;
  firstName: string;
  lastName: string;
  onRemoved: () => void;
}

function PersonChip({ importantDateId, personId, firstName, lastName, onRemoved }: PersonChipProps) {
  const [untag] = useMutation(UNTAG_PERSON);

  const handleRemove = async () => {
    await untag({ variables: { importantDateId, personId } });
    onRemoved();
  };

  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-muted/50">
      {firstName} {lastName}
      <button
        type="button"
        onClick={handleRemove}
        className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
        aria-label={`Remove ${firstName} ${lastName}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Picker
// ---------------------------------------------------------------------------

interface PickerProps {
  importantDateId: string;
  primaryPersonId: string;
  taggedPersonIds: Set<string>;
  allPersons: Array<{ id: string; firstName: string; lastName: string }>;
  onClose: () => void;
  onAdded: () => void;
}

function PersonPicker({
  importantDateId,
  primaryPersonId,
  taggedPersonIds,
  allPersons,
  onClose,
  onAdded,
}: PickerProps) {
  const [tag] = useMutation(TAG_PERSON);

  const available = allPersons.filter(
    (p) => p.id !== primaryPersonId && !taggedPersonIds.has(p.id),
  );

  const handleSelect = async (personId: string) => {
    await tag({ variables: { importantDateId, personId } });
    onAdded();
    onClose();
  };

  if (available.length === 0) {
    return (
      <div className="rounded-md border border-border p-3 text-xs text-muted-foreground flex justify-between">
        No other persons to add.
        <button type="button" onClick={onClose} className="hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-border p-3">
      {available.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => handleSelect(p.id)}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer"
        >
          {p.firstName} {p.lastName}
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

export interface ImportantDatePersonsProps {
  importantDateId: string;
  primaryPersonId: string;
  taggedPersons: Array<{ id: string; firstName: string; lastName: string }>;
  allPersons: Array<{ id: string; firstName: string; lastName: string }>;
  showAdd: boolean;
  onShowAdd: (show: boolean) => void;
  onChanged: () => void;
}

export function ImportantDatePersons({
  importantDateId,
  primaryPersonId,
  taggedPersons,
  allPersons,
  showAdd,
  onShowAdd,
  onChanged,
}: ImportantDatePersonsProps) {
  const taggedIds = new Set(taggedPersons.map((p) => p.id));

  return (
    <div className="mt-1 space-y-1.5">
      {taggedPersons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {taggedPersons.map((p) => (
            <PersonChip
              key={p.id}
              importantDateId={importantDateId}
              personId={p.id}
              firstName={p.firstName}
              lastName={p.lastName}
              onRemoved={onChanged}
            />
          ))}
        </div>
      )}

      {showAdd ? (
        <PersonPicker
          importantDateId={importantDateId}
          primaryPersonId={primaryPersonId}
          taggedPersonIds={taggedIds}
          allPersons={allPersons}
          onClose={() => onShowAdd(false)}
          onAdded={onChanged}
        />
      ) : (
        <button
          type="button"
          onClick={() => onShowAdd(true)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <UserPlus className="h-3 w-3" />
          Tag person
        </button>
      )}
    </div>
  );
}
