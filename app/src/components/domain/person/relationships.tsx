import { useMutation } from '@apollo/client';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import type { Person_RelationshipsFragment, PersonRelationshipEntry } from '@/__generated__/graphql';
import { ActionButton } from '@/components/action-button';
import { useAppForm } from '@/components/app-form';
import { ConfirmButton } from '@/components/confirm-button';
import { ListItem } from '@/components/list-item';
import { OptionSelect } from '@/components/option-select';
import { EmptyState } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FieldWrapper, Form } from '@/components/ui/form';
import { FormDialog, FormDialogFooter } from '@/components/ui/form-dialog';
import { Pencil, Trash2 } from '@/components/ui/icons';
import { fullName } from '@/lib/person-name';
import { useAllRows } from '@/lib/use-all-rows';

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
  query GetRelationshipTypes($limit: Int!, $offset: Int!) {
    relationshipTypes(limit: $limit, offset: $offset, orderBy: { name: { direction: asc, priority: 1 }, id: { direction: asc, priority: 2 } }) {
      id
      name
    }
  }
`);

const CREATE_RELATIONSHIP = graphql(`
  mutation CreatePersonRelationship(
    $fromPersonId: UUID!
    $toPersonId: UUID!
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
  mutation UpdatePersonRelationship($id: UUID!, $type: String!) {
    updatePersonRelationship(
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
  mutation DeletePersonRelationship($id: UUID!) {
    deletePersonRelationship(where: { id: { eq: $id } }) {
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
  mutation DeleteRelationshipType($id: UUID!) {
    deleteRelationshipType(where: { id: { eq: $id } }) {
      id
    }
  }
`);

export interface RelationshipsProps {
  person: Person_RelationshipsFragment;
  /** Everyone the person could be linked to. */
  allPersons: Array<{ id: string; firstName: string; lastName: string }>;
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

/** What the dialog needs of the relationship it edits. */
type EditingRelationship = Pick<
  PersonRelationshipEntry,
  'id' | 'type' | 'relatedPersonId' | 'relatedPersonFirstName' | 'relatedPersonLastName'
>;

interface RelationshipFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The person whose page this is; a new relationship starts at them. */
  fromPersonId: string;
  /** Everyone the person could be linked to. */
  allPersons: Array<{ id: string; firstName: string; lastName: string }>;
  /** The people already related to this person, who are not offered again. */
  existingRelatedIds: Set<string>;
  /** Called after a relationship is created, with both people and its type name. */
  onCreate?: (fromPersonId: string, toPersonId: string, type: string) => void;
  /** Set, the dialog changes this relationship's type; the person is fixed. */
  editing?: EditingRelationship | undefined;
  /** Called with the relationship's id and its new type name after the change is saved. */
  onEdit?: (id: string, type: string) => void;
}

/**
 * The dialog that links two people or changes how they are related. It also adds and deletes the relationship types
 * offered.
 */
function RelationshipFormDialog({
  open,
  onOpenChange,
  fromPersonId,
  allPersons,
  existingRelatedIds,
  onCreate,
  editing,
  onEdit,
}: RelationshipFormDialogProps) {
  const isEditing = editing !== undefined;
  const { data: typesData } = useAllRows(GET_RELATIONSHIP_TYPES, { field: 'relationshipTypes' });
  const types = typesData?.relationshipTypes ?? [];
  const firstType = types[0]?.name ?? '';
  // Read through a ref so the reset below runs on open only, not when the type list refetches.
  const firstTypeRef = useRef(firstType);
  firstTypeRef.current = firstType;
  /** The type whose delete is waiting on the confirm question, if one is. */
  const [typeToDelete, setTypeToDelete] = useState<{ id: string; name: string } | null>(null);

  const [createRelationship, { error: createError, reset: resetCreate }] = useMutation(CREATE_RELATIONSHIP);
  const [updateRelationship, { error: updateError, reset: resetUpdate }] = useMutation(UPDATE_RELATIONSHIP);
  const [createType, { loading: creatingType }] = useMutation(CREATE_RELATIONSHIP_TYPE, {
    refetchQueries: ['GetRelationshipTypes'],
    // The new type is selected as soon as this resolves, and the select drops a value it has no option for.
    awaitRefetchQueries: true,
  });
  const [deleteType] = useMutation(DELETE_RELATIONSHIP_TYPE, {
    refetchQueries: ['GetRelationshipTypes'],
  });

  const form = useAppForm({
    // `newTypeName` is the "add a type" box beside the picker; it is never sent with the relationship.
    defaultValues: { toPersonId: '', type: '', newTypeName: '' },
    onSubmit: async ({ value }) => {
      const { toPersonId, type } = value;
      try {
        if (isEditing) {
          await updateRelationship({ variables: { id: editing.id, type } });
          onEdit?.(editing.id, type);
        } else {
          await createRelationship({ variables: { fromPersonId, toPersonId, type } });
          onCreate?.(fromPersonId, toPersonId, type);
        }
      } catch {
        // Stay open with what was chosen; the footer shows the mutation's error.
        return;
      }
      onOpenChange(false);
    },
  });

  useEffect(() => {
    const isClosed = open === false;
    if (isClosed) {
      return;
    }
    form.reset({
      toPersonId: editing?.relatedPersonId ?? '',
      type: editing?.type ?? firstTypeRef.current,
      newTypeName: '',
    });
    resetCreate();
    resetUpdate();
  }, [open, editing, form, resetCreate, resetUpdate]);

  const personOptions = isEditing
    ? [
        {
          value: editing.relatedPersonId,
          label: `${editing.relatedPersonFirstName} ${editing.relatedPersonLastName}`,
        },
      ]
    : allPersons
        .filter((p) => {
          const isOther = p.id !== fromPersonId;
          const isUnrelated = existingRelatedIds.has(p.id) === false;
          return isOther && isUnrelated;
        })
        .map((p) => ({ value: p.id, label: fullName(p) }));

  // A relationship keeps its type's name after the type is deleted, so the one being edited may
  // no longer be in the list.
  const typeNames = types.map((t) => t.name);
  const isDeletedType = isEditing && typeNames.includes(editing.type) === false;
  if (isDeletedType) {
    typeNames.push(editing.type);
  }
  const typeOptions = typeNames.map((name) => ({ value: name, label: name }));

  const addType = async () => {
    const name = form.state.values.newTypeName.trim();
    const isAddBlocked = name === '' || creatingType;
    if (isAddBlocked) {
      return;
    }
    const { data } = await createType({ variables: { name } });
    form.setFieldValue('newTypeName', '');
    if (data?.createRelationshipType?.name) {
      form.setFieldValue('type', data.createRelationshipType.name);
    }
  };

  const error = createError ?? updateError;
  const hasNobodyToLink = isEditing === false && personOptions.length === 0;

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={isEditing ? 'Edit Relationship' : 'Add Relationship'}>
      {hasNobodyToLink ? (
        <EmptyState compact title="No other persons available to link." />
      ) : (
        <form.AppForm>
          <Form className="gap-4">
            <form.AppField
              name="toPersonId"
              validators={{ onChange: ({ value }) => (value ? undefined : 'Please select a person.') }}
            >
              {(field) => (
                <FieldWrapper
                  label="Person"
                  asGroup
                  controlSlot={
                    <OptionSelect
                      options={personOptions}
                      value={field.state.value}
                      onValueChange={(value) => {
                        field.handleChange(value);
                        field.handleBlur();
                      }}
                      disabled={isEditing}
                      placeholder="Select person…"
                      searchable
                      searchPlaceholder="Search persons…"
                      searchLabel="Search persons"
                      emptyMessage="No persons found."
                    />
                  }
                />
              )}
            </form.AppField>

            <form.AppField
              name="type"
              validators={{
                onChange: ({ value }) => (value ? undefined : 'Please select or create a relationship type.'),
              }}
            >
              {(field) => (
                <field.SelectField
                  label="Relationship type"
                  options={typeOptions}
                  placeholder={types.length === 0 ? 'No types yet — add one below' : 'Select type…'}
                />
              )}
            </form.AppField>

            <View className="flex-row items-end gap-2">
              <form.AppField name="newTypeName">
                {(field) => (
                  <field.InputField
                    className="flex-1"
                    label="New relationship type"
                    placeholder="New type…"
                    // Enter here adds the type; it must not submit the relationship.
                    onSubmitEditing={() => void addType()}
                  />
                )}
              </form.AppField>
              <form.Subscribe selector={(state) => state.values.newTypeName}>
                {(newTypeName) => {
                  const isAddBlocked = newTypeName.trim() === '' || creatingType;
                  return (
                    <Button variant="outline" content="Add" disabled={isAddBlocked} onPress={() => void addType()} />
                  );
                }}
              </form.Subscribe>
            </View>

            {types.length > 0 ? (
              <View className="flex-row flex-wrap gap-1.5">
                {types.map((t) => (
                  <Badge
                    key={t.id}
                    variant="secondary"
                    removeLabel={`Delete ${t.name}`}
                    onRemove={() => setTypeToDelete(t)}
                  >
                    {t.name}
                  </Badge>
                ))}
              </View>
            ) : null}

            <ConfirmDialog
              open={typeToDelete !== null}
              onOpenChange={(open) => {
                const isClosing = open === false;
                if (isClosing) {
                  setTypeToDelete(null);
                }
              }}
              title={`Delete ${typeToDelete?.name ?? 'this type'}?`}
              description="It is no longer offered when you link two people. Relationships that already use it keep it."
              confirmLabel="Delete"
              cancelLabel="Cancel"
              onConfirm={() => {
                if (typeToDelete) {
                  void deleteType({ variables: { id: typeToDelete.id } });
                }
                setTypeToDelete(null);
              }}
            />

            <FormDialogFooter onCancel={() => onOpenChange(false)} error={error?.message ?? null}>
              <form.SubmitButton isEdit={isEditing} createLabel="Add" editLabel="Save" />
            </FormDialogFooter>
          </Form>
        </form.AppForm>
      )}
    </FormDialog>
  );
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
  const { id, relatedPersonId, relatedPersonFirstName, relatedPersonLastName, type } = relationship;
  const router = useRouter();
  const [deleteRelationship] = useMutation(DELETE_RELATIONSHIP);
  const name = `${relatedPersonFirstName} ${relatedPersonLastName}`;

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
