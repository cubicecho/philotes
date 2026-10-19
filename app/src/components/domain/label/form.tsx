import { useState } from 'react';
import { z } from 'zod';
import type { CreateLabelInput as NewLabel } from '@/__generated__/graphql';
import { useAppForm } from '@/components/app-form';
import { DialogLayout } from '@/components/dialog-layout';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';

/** What a label must hold: a name and a `#rrggbb` colour. */
const labelSchema = z.object({
  label: z.string().min(1, 'Name is required.'),
  color: z
    .string()
    .min(1, 'Color is required.')
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color (e.g. #ff0000).'),
});

interface LabelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** The label being edited; left out, the form creates one, starting from black. */
  initialValues?: { label: string; color: string };
  /**
   * Saves the label. The caller closes the dialog once it resolves; a rejection's message is
   * shown under the fields and the form stays as typed.
   */
  onSubmit: (value: NewLabel) => Promise<void>;
  /** Replaces the submit button's "Save" (editing) or "Create". */
  submitLabel?: string;
}

/** The dialog that creates or edits a label: its name and colour fields, Cancel and the submit. */
export function LabelFormDialog({
  open,
  onOpenChange,
  title,
  description,
  initialValues,
  onSubmit,
  submitLabel,
}: LabelFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: {
      label: initialValues?.label ?? '',
      color: initialValues?.color ?? '#000000',
    },
    validators: {
      onSubmit: labelSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await onSubmit(value);
        form.reset();
      } catch (err: unknown) {
        if (err instanceof Error) {
          setFormError(err.message);
        } else {
          setFormError('An unexpected error occurred.');
        }
      }
    },
  });

  const isEdit = initialValues !== undefined;
  const label = submitLabel ?? (isEdit ? 'Save' : 'Create');

  // Closing throws the draft away (the dialog has already asked), so the next open starts afresh.
  const handleOpenChange = (next: boolean) => {
    const isClosing = next === false;
    if (isClosing) {
      form.reset();
      setFormError(null);
    }
    onOpenChange(next);
  };

  return (
    <DialogLayout
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      hasUnsavedChanges={() => form.state.isDefaultValue === false}
      contentSlot={
        <form.AppForm>
          <Form className="gap-4">
            <form.AppField name="label">{(field) => <field.InputField label="Name" autoFocus />}</form.AppField>
            <form.AppField name="color">{(field) => <field.ColorField label="Color" />}</form.AppField>
            {formError ? <Alert variant="destructive" title={formError} /> : null}
          </Form>
        </form.AppForm>
      }
      footerActionsSlot={(close) => (
        <>
          <Button variant="outline" onPress={close} content="Cancel" />
          <form.AppForm>
            <form.SubmitButton isEdit={isEdit} createLabel={label} editLabel={label} savingLabel="Saving..." />
          </form.AppForm>
        </>
      )}
    />
  );
}
