import { useMutation } from '@apollo/client';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { PersonRelationshipEntry } from '@/__generated__/graphql';
import { useAppForm } from '@/components/app-form';
import {
  CREATE_RELATIONSHIP,
  CREATE_RELATIONSHIP_TYPE,
  DELETE_RELATIONSHIP_TYPE,
  GET_RELATIONSHIP_TYPES,
  UPDATE_RELATIONSHIP,
} from '@/components/domain/person/relationship-queries';
import { OptionSelect } from '@/components/option-select';
import { EmptyState } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FieldWrapper, Form } from '@/components/ui/form';
import { FormDialog, FormDialogFooter } from '@/components/ui/form-dialog';
import { personName } from '@/lib/person-name';
import { useAllRows } from '@/lib/use-all-rows';

/** What the dialog needs of the relationship it edits. */
export type EditingRelationship = Pick<
  PersonRelationshipEntry,
  'id' | 'type' | 'relatedPersonId' | 'relatedPersonDisplayName'
>;

interface RelationshipFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The person whose page this is; a new relationship starts at them. */
  fromPersonId: string;
  /** Everyone the person could be linked to. */
  allPersons: Array<{ id: string; displayName: string }>;
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
export function RelationshipFormDialog({
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
          label: personName({ displayName: editing.relatedPersonDisplayName }),
        },
      ]
    : allPersons
        .filter((p) => {
          const isOther = p.id !== fromPersonId;
          const isUnrelated = existingRelatedIds.has(p.id) === false;
          return isOther && isUnrelated;
        })
        .map((p) => ({ value: p.id, label: personName(p) }));

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
