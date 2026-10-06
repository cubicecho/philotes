import { useMutation, useQuery } from '@apollo/client';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import type { Person_RelationshipsFragment, PersonRelationshipEntry } from '@/__generated__/graphql';
import { ActionButton } from '@/components/action-button';
import { useAppForm } from '@/components/app-form';
import { ConfirmButton } from '@/components/confirm-button';
import { ListItem } from '@/components/list-item';
import { OptionSelect } from '@/components/option-select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldWrapper, Form } from '@/components/ui/form';
import { FormDialog, FormDialogFooter } from '@/components/ui/form-dialog';
import { Pencil, Trash2 } from '@/components/ui/icons';

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

type EditingRelationship = Pick<
  PersonRelationshipEntry,
  'id' | 'type' | 'relatedPersonId' | 'relatedPersonFirstName' | 'relatedPersonLastName'
>;

// ---------------------------------------------------------------------------
// Add / edit dialog
// ---------------------------------------------------------------------------

interface RelationshipFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromPersonId: string;
  allPersons: Array<{ id: string; firstName: string; lastName: string }>;
  existingRelatedIds: Set<string>;
  onCreate?: (fromPersonId: string, toPersonId: string, type: string) => void;
  /** Set, the dialog changes this relationship's type; the person is fixed. */
  editing?: EditingRelationship | undefined;
  onEdit?: (id: string, type: string) => void;
}

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
  const { data: typesData } = useQuery(GET_RELATIONSHIP_TYPES);
  const types = typesData?.relationshipTypes ?? [];
  const firstType = types[0]?.name ?? '';

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open only, not when the type list refetches
  useEffect(() => {
    if (!open) {
      return;
    }
    form.reset({
      toPersonId: editing?.relatedPersonId ?? '',
      type: editing?.type ?? firstType,
      newTypeName: '',
    });
    resetCreate();
    resetUpdate();
  }, [open, editing, form]);

  const personOptions = isEditing
    ? [
        {
          value: editing.relatedPersonId,
          label: `${editing.relatedPersonFirstName} ${editing.relatedPersonLastName}`,
        },
      ]
    : allPersons
        .filter((p) => p.id !== fromPersonId && existingRelatedIds.has(p.id) === false)
        .map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }));

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
    if (!name || creatingType) {
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
        <Text className="text-muted-foreground text-sm">No other persons available to link.</Text>
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
                {(newTypeName) => (
                  <Button
                    variant="outline"
                    content="Add"
                    disabled={!newTypeName.trim() || creatingType}
                    onPress={() => void addType()}
                  />
                )}
              </form.Subscribe>
            </View>

            {types.length > 0 ? (
              <View className="flex-row flex-wrap gap-1.5">
                {types.map((t) => (
                  <Badge
                    key={t.id}
                    variant="secondary"
                    removeLabel={`Delete ${t.name}`}
                    onRemove={() => void deleteType({ variables: { id: t.id } })}
                  >
                    {t.name}
                  </Badge>
                ))}
              </View>
            ) : null}

            <FormDialogFooter onCancel={() => onOpenChange(false)} error={error?.message ?? null}>
              <form.SubmitButton isEdit={isEditing} createLabel="Add" editLabel="Save" />
            </FormDialogFooter>
          </Form>
        </form.AppForm>
      )}
    </FormDialog>
  );
}

// ---------------------------------------------------------------------------
// Relationship row
// ---------------------------------------------------------------------------

interface RelationshipRowProps {
  relationship: PersonRelationshipEntry;
  onDelete: (id: string) => void;
  onEditPress: () => void;
}

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
      className="border border-border"
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
  // Kept apart from the open flag so the dialog still shows the row while it closes.
  const [editing, setEditing] = useState<EditingRelationship | undefined>();
  const [editOpen, setEditOpen] = useState(false);

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
        {relationships.length === 0 && !showAdd ? (
          <Text className="text-muted-foreground text-sm">No relationships yet.</Text>
        ) : null}
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
