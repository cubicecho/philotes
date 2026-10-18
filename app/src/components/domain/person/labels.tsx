import { useMutation } from '@apollo/client';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import type { Person_LabelsFragment } from '@/__generated__/graphql';
import { useAppForm } from '@/components/app-form';
import { DialogLayout } from '@/components/dialog-layout';
import { LabelChip } from '@/components/domain/label/label-chip';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { Plus } from '@/components/ui/icons';

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

const ATTACH_LABEL = graphql(`
  mutation AttachLabelToPerson($personId: UUID!, $labelId: UUID!) {
    createPersonLabel(values: { personId: $personId, labelId: $labelId }) {
      personId
      labelId
    }
  }
`);

const DETACH_LABEL = graphql(`
  mutation DetachLabelFromPerson($personId: UUID!, $labelId: UUID!) {
    deletePersonLabel(
      where: { personId: { eq: $personId }, labelId: { eq: $labelId } }
    ) {
      personId
      labelId
    }
  }
`);

/** A label as a chip or a picker option needs it. */
type LabelOption = { id: string; label: string; color: string };

export interface PersonLabelsProps {
  person: Person_LabelsFragment;
  /** Every label the user has; the ones not yet on the person are offered. */
  allLabels: LabelOption[];
  /** Called with a label's id after it is taken off the person. */
  onDelete: (labelId: string) => void;
  /** Called with a label's id after it is put on the person. */
  onAdd: (labelId: string) => void;
  /** Whether the Add Label dialog is open. */
  showAdd?: boolean;
  /** Receives the dialog's open state. Without it the Label button is not drawn. */
  onShowAdd?: (show: boolean) => void;
}

interface AttachedLabelChipProps {
  personId: string;
  labelId: string;
  label: string;
  color: string;
  /** Called with the label's id after it is taken off the person. */
  onDelete: (labelId: string) => void;
}

/** One of a person's labels, with the ✕ that takes it off them. */
function AttachedLabelChip({ personId, labelId, label, color, onDelete }: AttachedLabelChipProps) {
  const [detachLabel] = useMutation(DETACH_LABEL);

  const handleDetach = async () => {
    await detachLabel({ variables: { personId, labelId } });
    onDelete(labelId);
  };

  return <LabelChip label={label} color={color} onRemove={handleDetach} />;
}

interface AddLabelDialogProps {
  personId: string;
  /** The labels not yet on the person. */
  available: LabelOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with each label's id as it is put on the person. */
  onAdd: (labelId: string) => void;
}

/** The Add Label form's starting values: nothing chosen. */
const NO_LABELS: { labelIds: string[] } = { labelIds: [] };

/** The dialog that puts one or more labels on a person, one mutation per label. */
function AddLabelDialog({ personId, available, open, onOpenChange, onAdd }: AddLabelDialogProps) {
  const [attachLabel] = useMutation(ATTACH_LABEL);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: NO_LABELS,
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        for (const labelId of value.labelIds) {
          await attachLabel({ variables: { personId, labelId } });
          onAdd(labelId);
        }
        onOpenChange(false);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    },
  });

  useEffect(() => {
    const isClosed = open === false;
    if (isClosed) {
      return;
    }
    form.reset(NO_LABELS);
    setFormError(null);
  }, [open, form]);

  return (
    <DialogLayout
      open={open}
      onOpenChange={onOpenChange}
      title="Add Label"
      hasUnsavedChanges={() => form.state.isDefaultValue === false}
      contentSlot={
        <form.AppForm>
          <Form className="gap-4">
            <form.AppField
              name="labelIds"
              validators={{ onSubmit: ({ value }) => (value.length > 0 ? undefined : 'Pick at least one label.') }}
            >
              {(field) => (
                <field.ComboboxField
                  multiple
                  label="Labels"
                  options={available.map((l) => ({ value: l.id, label: l.label, color: l.color }))}
                  placeholder="Add labels…"
                  searchLabel="Search labels"
                  popoverLabel="Labels"
                />
              )}
            </form.AppField>
            {formError ? <Alert variant="destructive" title={formError} /> : null}
          </Form>
        </form.AppForm>
      }
      footerActionsSlot={(close) => (
        <>
          <Button variant="outline" onPress={close} content="Cancel" />
          <form.AppForm>
            <form.SubmitButton createLabel="Add" savingLabel="Adding..." />
          </form.AppForm>
        </>
      )}
    />
  );
}

/** A person's labels as removable chips, the button that offers the rest, and its dialog. */
export function PersonLabels({ person, allLabels, onDelete, onAdd, showAdd = false, onShowAdd }: PersonLabelsProps) {
  const attachedIds = new Set(person.labels.map((l) => l.id));
  const available = allLabels.filter((l) => attachedIds.has(l.id) === false);
  const hasAvailable = available.length > 0;

  return (
    <View className="flex-row flex-wrap items-center gap-1.5">
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
      {hasAvailable && onShowAdd ? (
        <Button variant="outline" size="xs" iconSlot={<Plus />} content="Label" onPress={() => onShowAdd(true)} />
      ) : null}

      <AddLabelDialog
        personId={person.id}
        available={available}
        open={showAdd}
        onOpenChange={(open) => onShowAdd?.(open)}
        onAdd={onAdd}
      />
    </View>
  );
}
