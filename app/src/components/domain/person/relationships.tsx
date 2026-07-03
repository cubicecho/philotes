import { useMutation, useQuery } from '@apollo/client';
import { Link } from 'expo-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql';
import type { Person_RelationshipsFragment, PersonRelationshipEntry } from '@/__generated__/graphql';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Fragments & queries
// ---------------------------------------------------------------------------

export const PERSON_RELATIONSHIPS = graphql(`
  fragment Person_Relationships on Person {
    id
    relationships {
      id
      type
      relatedPersonId
      relatedPersonFirstName
      relatedPersonLastName
    }
  }
`);

const GET_RELATIONSHIP_TYPES = graphql(`
  query GetRelationshipTypes {
    relationshipTypes {
      id
      name
    }
  }
`);

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const CREATE_RELATIONSHIP = graphql(`
  mutation CreatePersonRelationship(
    $fromPersonId: String!
    $toPersonId: String!
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

const UPDATE_RELATIONSHIP = graphql(`
  mutation UpdatePersonRelationship($id: String!, $type: String!) {
    updatePersonRelationships(
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

const DELETE_RELATIONSHIP = graphql(`
  mutation DeletePersonRelationship($id: String!) {
    deletePersonRelationships(where: { id: { eq: $id } }) {
      id
    }
  }
`);

const CREATE_RELATIONSHIP_TYPE = graphql(`
  mutation CreateRelationshipType($name: String!) {
    createRelationshipType(values: { name: $name }) {
      id
      name
    }
  }
`);

const DELETE_RELATIONSHIP_TYPE = graphql(`
  mutation DeleteRelationshipType($id: String!) {
    deleteRelationshipTypes(where: { id: { eq: $id } }) {
      id
    }
  }
`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelationshipsProps {
  person: Person_RelationshipsFragment;
  allPersons: Array<{ id: string; firstName: string; lastName: string }>;
  onDelete: (id: string) => void;
  onAdd: (fromPersonId: string, toPersonId: string, type: string) => void;
  onEdit: (id: string, type: string) => void;
  showAdd?: boolean;
  onShowAdd?: (show: boolean) => void;
}

// ---------------------------------------------------------------------------
// Relationship type picker (shared between create and edit forms)
// ---------------------------------------------------------------------------

interface TypePickerProps {
  value: string;
  onChange: (v: string) => void;
  types: Array<{ id: string; name: string }>;
  onTypeCreated: () => void;
}

function RelationshipTypePicker({ value, onChange, types, onTypeCreated }: TypePickerProps) {
  const [newTypeName, setNewTypeName] = useState('');
  const [createType, { loading }] = useMutation(CREATE_RELATIONSHIP_TYPE, {
    refetchQueries: ['GetRelationshipTypes'],
  });
  const [deleteType] = useMutation(DELETE_RELATIONSHIP_TYPE, {
    refetchQueries: ['GetRelationshipTypes'],
  });

  const handleAdd = async () => {
    const name = newTypeName.trim();
    if (!name) return;
    const { data } = await createType({ variables: { name } });
    setNewTypeName('');
    if (data?.createRelationshipType?.name) {
      onChange(data.createRelationshipType.name);
    }
    onTypeCreated();
  };

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {types.length === 0 && <option value="">No types yet — add one below</option>}
        {types.map((t) => (
          <option key={t.id} value={t.name}>
            {t.name}
          </option>
        ))}
      </select>

      <div className="flex gap-1.5">
        <input
          type="text"
          placeholder="New type…"
          value={newTypeName}
          onChange={(e) => setNewTypeName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="button" size="sm" variant="outline" disabled={!newTypeName.trim() || loading} onClick={handleAdd}>
          Add
        </Button>
      </div>

      {types.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {types.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {t.name}
              <button
                type="button"
                onClick={() => deleteType({ variables: { id: t.id } })}
                className="hover:text-destructive transition-colors"
                aria-label={`Delete ${t.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared form body
// ---------------------------------------------------------------------------

interface RelationshipFormProps {
  fromPersonId: string;
  allPersons: Array<{ id: string; firstName: string; lastName: string }>;
  existingRelatedIds: Set<string>;
  onClose: () => void;
  onCreate?: (fromPersonId: string, toPersonId: string, type: string) => void;
  editing?: Pick<
    PersonRelationshipEntry,
    'id' | 'type' | 'relatedPersonId' | 'relatedPersonFirstName' | 'relatedPersonLastName'
  >;
  onEdit?: (id: string, type: string) => void;
}

function RelationshipForm({
  fromPersonId,
  allPersons,
  existingRelatedIds,
  onClose,
  onCreate,
  editing,
  onEdit,
}: RelationshipFormProps) {
  const isEditing = editing !== undefined;
  const { data: typesData } = useQuery(GET_RELATIONSHIP_TYPES);
  const types = typesData?.relationshipTypes ?? [];

  const [toPersonId, setToPersonId] = useState(isEditing ? editing.relatedPersonId : '');
  const [type, setType] = useState(isEditing ? editing.type : (types[0]?.name ?? ''));
  const [error, setError] = useState<string | null>(null);

  const [createRelationship, { loading: createLoading }] = useMutation(CREATE_RELATIONSHIP);
  const [updateRelationship, { loading: updateLoading }] = useMutation(UPDATE_RELATIONSHIP);
  const loading = createLoading || updateLoading;

  const availablePersons = isEditing
    ? allPersons.filter((p) => p.id === editing.relatedPersonId)
    : allPersons.filter((p) => p.id !== fromPersonId && !existingRelatedIds.has(p.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toPersonId) {
      setError('Please select a person.');
      return;
    }
    if (!type) {
      setError('Please select or create a relationship type.');
      return;
    }
    setError(null);

    if (isEditing) {
      await updateRelationship({ variables: { id: editing.id, type } });
      onEdit?.(editing.id, type);
    } else {
      await createRelationship({ variables: { fromPersonId, toPersonId, type } });
      onCreate?.(fromPersonId, toPersonId, type);
    }
    onClose();
  };

  if (!isEditing && availablePersons.length === 0) {
    return <p className="text-muted-foreground text-sm">No other persons available to link.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Person</label>
        <select
          value={toPersonId}
          onChange={(e) => setToPersonId(e.target.value)}
          disabled={isEditing}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        >
          {!isEditing && <option value="">Select person…</option>}
          {availablePersons.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
          {isEditing && (
            <option value={editing.relatedPersonId}>
              {editing.relatedPersonFirstName} {editing.relatedPersonLastName}
            </option>
          )}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium mb-1.5 block">Relationship type</label>
        <RelationshipTypePicker value={type} onChange={setType} types={types} onTypeCreated={() => {}} />
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? 'Saving…' : isEditing ? 'Save' : 'Add'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Relationship row
// ---------------------------------------------------------------------------

interface RelationshipRowProps {
  relationship: PersonRelationshipEntry;
  fromPersonId: string;
  allPersons: Array<{ id: string; firstName: string; lastName: string }>;
  onDelete: (id: string) => void;
  onEdit: (id: string, type: string) => void;
}

function RelationshipRow({ relationship, fromPersonId, allPersons, onDelete, onEdit }: RelationshipRowProps) {
  const { id, relatedPersonId, relatedPersonFirstName, relatedPersonLastName, type } = relationship;
  const [editOpen, setEditOpen] = useState(false);
  const [deleteRelationship] = useMutation(DELETE_RELATIONSHIP);

  const handleDelete = async () => {
    await deleteRelationship({ variables: { id } });
    onDelete(id);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
        <div className="min-w-0 flex-1">
          <Link href={`/persons/${relatedPersonId}`} className="font-medium hover:underline">
            {relatedPersonFirstName} {relatedPersonLastName}
          </Link>
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{type}</span>
        </div>
        <div className="flex shrink-0 gap-1 text-muted-foreground">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="hover:text-foreground transition-colors"
            aria-label="Edit relationship"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="hover:text-destructive transition-colors"
            aria-label="Remove relationship"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Relationship</DialogTitle>
          </DialogHeader>
          <RelationshipForm
            fromPersonId={fromPersonId}
            allPersons={allPersons}
            existingRelatedIds={new Set()}
            onClose={() => setEditOpen(false)}
            editing={relationship}
            onEdit={(editedId, editedType) => {
              setEditOpen(false);
              onEdit(editedId, editedType);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PersonRelationships({
  person,
  allPersons,
  onDelete,
  onAdd,
  onEdit,
  showAdd = false,
  onShowAdd,
}: RelationshipsProps) {
  const relationships = person.relationships ?? [];
  const existingRelatedIds = new Set(relationships.map((r) => r.relatedPersonId));

  return (
    <>
      <div className="space-y-2">
        {relationships.map((r) => (
          <RelationshipRow
            key={r.id}
            relationship={r}
            fromPersonId={person.id}
            allPersons={allPersons}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
        {relationships.length === 0 && !showAdd && (
          <p className="text-muted-foreground text-sm">No relationships yet.</p>
        )}
      </div>

      <Dialog open={showAdd} onOpenChange={onShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Relationship</DialogTitle>
          </DialogHeader>
          <RelationshipForm
            fromPersonId={person.id}
            allPersons={allPersons}
            existingRelatedIds={existingRelatedIds}
            onClose={() => onShowAdd?.(false)}
            onCreate={(fromId, toId, t) => onAdd(fromId, toId, t)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
