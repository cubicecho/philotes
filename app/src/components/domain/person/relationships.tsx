import { useMutation } from '@apollo/client';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import type { Person_RelationshipsFragment, PersonRelationshipEntry } from '@/__generated__/graphql';
import { ActionButton } from '@/components/action-button';
import { ConfirmButton } from '@/components/confirm-button';
import { type EditingRelationship, RelationshipFormDialog } from '@/components/domain/person/relationship-form-dialog';
import { DELETE_RELATIONSHIP } from '@/components/domain/person/relationship-queries';
import { ListItem } from '@/components/list-item';
import { EmptyState } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2 } from '@/components/ui/icons';
import { personName } from '@/lib/person-name';

export interface RelationshipsProps {
  person: Person_RelationshipsFragment;
  /** Everyone the person could be linked to. */
  allPersons: Array<{ id: string; displayName: string }>;
  /** Called with a relationship's id after it is removed. */
  onDelete: (id: string) => void;
  /** Called after a relationship is created, with both people and its type name. */
  onAdd: (fromPersonId: string, toPersonId: string, type: string) => void;
  /** Called with a relationship's id and its new type name after the change is saved. */
  onEdit: (id: string, type: string) => void;
  /** Whether the Add Relationship dialog is open. */
  showAdd?: boolean;
  /** Receives the Add Relationship dialog's open state. */
  onShowAdd?: (show: boolean) => void;
}

interface RelationshipRowProps {
  relationship: PersonRelationshipEntry;
  /** Called with the relationship's id after it is removed. */
  onDelete: (id: string) => void;
  /** Called when Edit is pressed. */
  onEditPress: () => void;
}

/** One relationship: the other person, opening their page when pressed, the type, and edit and remove. */
function RelationshipRow({ relationship, onDelete, onEditPress }: RelationshipRowProps) {
  const { id, relatedPersonId, relatedPersonDisplayName, type } = relationship;
  const router = useRouter();
  const [deleteRelationship] = useMutation(DELETE_RELATIONSHIP);
  const name = personName({ displayName: relatedPersonDisplayName });

  const handleDelete = async () => {
    await deleteRelationship({ variables: { id } });
    onDelete(id);
  };

  return (
    <ListItem
      className="border border-foreground/10"
      title={name}
      meta={<Badge variant="secondary">{type}</Badge>}
      onPress={() => router.push(`/persons/${relatedPersonId}`)}
      actionSlot={
        <>
          <ActionButton
            variant="ghost"
            size="icon-sm"
            label="Edit relationship"
            onPress={onEditPress}
            iconSlot={<Pencil className="h-4 w-4" />}
          />
          <ConfirmButton
            variant="ghost"
            size="icon-sm"
            label="Remove relationship"
            title="Remove this relationship?"
            description={`${name} is no longer linked as ${type}. Neither person is deleted.`}
            confirmLabel="Remove"
            onConfirm={handleDelete}
            iconSlot={<Trash2 className="h-4 w-4" />}
          />
        </>
      }
    />
  );
}

/** A person's relationships, with the dialog that adds one and the dialog that edits one. */
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
  // Kept apart from the open flag so the dialog still shows the row while it closes.
  const [editing, setEditing] = useState<EditingRelationship | undefined>();
  const [editOpen, setEditOpen] = useState(false);
  const hasNothingToShow = relationships.length === 0 && showAdd === false;

  return (
    <>
      <View className="gap-2">
        {relationships.map((r) => (
          <RelationshipRow
            key={r.id}
            relationship={r}
            onDelete={onDelete}
            onEditPress={() => {
              setEditing(r);
              setEditOpen(true);
            }}
          />
        ))}
        {hasNothingToShow ? <EmptyState compact title="No relationships yet." /> : null}
      </View>

      <RelationshipFormDialog
        open={showAdd}
        onOpenChange={(open) => onShowAdd?.(open)}
        fromPersonId={person.id}
        allPersons={allPersons}
        existingRelatedIds={existingRelatedIds}
        onCreate={onAdd}
      />

      {editing ? (
        <RelationshipFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          fromPersonId={person.id}
          allPersons={allPersons}
          existingRelatedIds={existingRelatedIds}
          editing={editing}
          onEdit={onEdit}
        />
      ) : null}
    </>
  );
}
