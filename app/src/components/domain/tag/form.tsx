import { createFormHook } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';
import type { CreateLabelInput as NewTag } from '@/__generated__/graphql';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { FormError, fieldContext, formContext, TextField } from '@/components/ui/form-field.tsx';

const tagSchema = z.object({
  label: z.string().min(1, 'Name is required.'),
  color: z
    .string()
    .min(1, 'Color is required.')
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color (e.g. #ff0000).'),
});

interface TagFormProps {
  initialValues?: { label: string; color: string };
  onSubmit: (value: NewTag) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldComponents: { TextField },
  formComponents: {},
  fieldContext,
  formContext,
});

export function TagForm({ initialValues, onSubmit, onCancel, submitLabel }: TagFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useAppForm({
    defaultValues: {
      label: initialValues?.label ?? '',
      color: initialValues?.color ?? '#000000',
    },
    validators: {
      onSubmit: tagSchema,
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

  const defaultSubmitLabel = initialValues ? 'Save' : 'Create';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-4">
        <form.AppField name="label">{() => <TextField label="Name" />}</form.AppField>
        <form.AppField name="color">{() => <TextField label="Color" type="color" />}</form.AppField>
        <FormError formError={formError} />
        <div className="flex gap-2">
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? 'Saving...' : (submitLabel ?? defaultSubmitLabel)}
              </Button>
            )}
          </form.Subscribe>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
