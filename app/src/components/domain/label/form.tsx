import { useState } from 'react';
import { z } from 'zod';
import type { CreateLabelInput as NewLabel } from '@/__generated__/graphql';
import { useAppForm } from '@/components/app-form';
import { Form } from '@/components/ui/form';
import { FormDialogFooter } from '@/components/ui/form-dialog';

const labelSchema = z.object({
  label: z.string().min(1, 'Name is required.'),
  color: z
    .string()
    .min(1, 'Color is required.')
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color (e.g. #ff0000).'),
});

interface LabelFormProps {
  initialValues?: { label: string; color: string };
  onSubmit: (value: NewLabel) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

/** The label fields and their footer. It draws no dialog of its own: render it inside a `FormDialog`. */
export function LabelForm({ initialValues, onSubmit, onCancel, submitLabel }: LabelFormProps) {
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

  return (
    <form.AppForm>
      <Form className="gap-4">
        <form.AppField name="label">{(field) => <field.InputField label="Name" autoFocus />}</form.AppField>
        <form.AppField name="color">{(field) => <field.ColorField label="Color" />}</form.AppField>
        <FormDialogFooter onCancel={onCancel} error={formError}>
          <form.SubmitButton isEdit={isEdit} createLabel={label} editLabel={label} savingLabel="Saving..." />
        </FormDialogFooter>
      </Form>
    </form.AppForm>
  );
}
