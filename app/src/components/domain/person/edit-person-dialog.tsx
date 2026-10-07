import { useMutation } from '@apollo/client';
import {
  ATTACH_LABEL_TO_PERSON,
  DETACH_LABEL_FROM_PERSON,
  type DetailLabel,
  type PersonDetail,
  UPDATE_MY_PERSON_CONTEXT,
  UPDATE_PERSON,
} from '@/components/domain/person/detail-queries';
import { PersonForm, type PersonFormValue } from '@/components/domain/person/form';
import { FormDialog } from '@/components/ui/form-dialog';
import { fullName } from '@/lib/person-name';

export interface EditPersonDialogProps {
  /** The person being edited. */
  person: PersonDetail;
  /** Every label of the caller's, for the form's label picker. */
  allLabels: DetailLabel[];
  /** Whether the dialog is open. */
  open: boolean;
  /** Opens or closes the dialog. */
  onOpenChange: (open: boolean) => void;
  /** Called once every change has been written, after the dialog closes. */
  onSaved: () => void;
}

/** The dialog that edits a person: their shared details, the caller's own context for them, and their labels. */
export function EditPersonDialog({ person, allLabels, open, onOpenChange, onSaved }: EditPersonDialogProps) {
  const [updatePerson] = useMutation(UPDATE_PERSON);
  const [updateMyPersonContext] = useMutation(UPDATE_MY_PERSON_CONTEXT);
  const [attachLabel] = useMutation(ATTACH_LABEL_TO_PERSON);
  const [detachLabel] = useMutation(DETACH_LABEL_FROM_PERSON);
  const id = person.id;

  const handleSubmit = async ({ person: fields, labelIds }: PersonFormValue): Promise<void> => {
    await updatePerson({
      variables: {
        id,
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email,
      },
    });

    await updateMyPersonContext({
      variables: {
        personId: id,
        contactFrequency: fields.contactFrequency || null,
        howWeMet: fields.howWeMet || null,
        firstMetDate: fields.firstMetDate || null,
      },
    });

    // Re-sync labels: detach removed, attach added
    const currentLabelIds = new Set(person.labels.map((l) => l.id));
    const nextLabelIds = new Set(labelIds);
    for (const labelId of currentLabelIds) {
      const isRemoved = nextLabelIds.has(labelId) === false;
      if (isRemoved) {
        await detachLabel({ variables: { personId: id, labelId } });
      }
    }
    for (const labelId of nextLabelIds) {
      const isAdded = currentLabelIds.has(labelId) === false;
      if (isAdded) {
        await attachLabel({ variables: { personId: id, labelId } });
      }
    }

    onOpenChange(false);
    onSaved();
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Person"
      description={`Update details for ${fullName(person)}.`}
      className="sm:max-w-xl"
    >
      <PersonForm
        availableLabels={allLabels.map((l) => ({
          id: l.id,
          label: l.label,
          color: l.color,
          __typename: 'Label' as const,
        }))}
        initialValues={{
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email,
          labelIds: person.labels.map((l) => l.id),
          contactFrequency: person.contactFrequency,
          howWeMet: person.howWeMet,
          firstMetDate: person.firstMetDate ?? null,
        }}
        submitLabel="Save Changes"
        onSubmit={handleSubmit}
        onCancel={() => onOpenChange(false)}
      />
    </FormDialog>
  );
}
