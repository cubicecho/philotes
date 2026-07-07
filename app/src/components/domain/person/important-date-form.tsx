import { createFormHook } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { FormError, fieldContext, formContext, TextField } from '@/components/ui/form-field.tsx';

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

export const RECURRENCE_OPTIONS = [
  { value: '', label: 'Does not repeat' },
  { value: 'yearly', label: 'Every year' },
  { value: 'monthly', label: 'Every month' },
  { value: 'weekly', label: 'Every week' },
] as const;

export type RecurrenceValue = '' | 'yearly' | 'monthly' | 'weekly';

// ---------------------------------------------------------------------------
// Milestone type
// ---------------------------------------------------------------------------

export const MILESTONE_TYPE_OPTIONS = [
  { value: '', label: 'None (regular date)' },
  { value: 'new_job', label: 'New Job' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'moved', label: 'Moved' },
  { value: 'new_baby', label: 'New Baby' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'retired', label: 'Retired' },
  { value: 'health_event', label: 'Health Event' },
  { value: 'graduation', label: 'Graduation' },
  { value: 'loss', label: 'Loss / Bereavement' },
  { value: 'other', label: 'Other' },
] as const;

export type MilestoneTypeValue =
  | ''
  | 'new_job'
  | 'promotion'
  | 'moved'
  | 'new_baby'
  | 'married'
  | 'divorced'
  | 'retired'
  | 'health_event'
  | 'graduation'
  | 'loss'
  | 'other';

// ---------------------------------------------------------------------------
// Schema & types
// ---------------------------------------------------------------------------

const importantDateSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  date: z.string().min(1, 'Date is required.'),
  description: z.string(),
  recurrence: z.enum(['', 'yearly', 'monthly', 'weekly']),
  milestoneType: z.enum([
    '',
    'new_job',
    'promotion',
    'moved',
    'new_baby',
    'married',
    'divorced',
    'retired',
    'health_event',
    'graduation',
    'loss',
    'other',
  ]),
});

export interface ImportantDateFormValue {
  name: string;
  date: string;
  description?: string;
  recurrence?: string;
  milestoneType?: string;
}

interface ImportantDateFormProps {
  onSubmit: (value: ImportantDateFormValue) => Promise<void>;
  onCancel: () => void;
  initialValues?: ImportantDateFormValue;
}

const { useAppForm } = createFormHook({
  fieldComponents: { TextField },
  formComponents: {},
  fieldContext,
  formContext,
});

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export function ImportantDateForm({ onSubmit, onCancel, initialValues }: ImportantDateFormProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      name: initialValues?.name ?? '',
      date: initialValues?.date ?? '',
      description: initialValues?.description ?? '',
      recurrence: (initialValues?.recurrence ?? '') as RecurrenceValue,
      milestoneType: (initialValues?.milestoneType ?? '') as MilestoneTypeValue,
    },
    validators: {
      onSubmit: importantDateSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await onSubmit({
          name: value.name,
          date: value.date,
          description: value.description || undefined,
          recurrence: value.recurrence || undefined,
          milestoneType: value.milestoneType || undefined,
        });
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-4">
        <form.AppField name="name">{() => <TextField label="Name" />}</form.AppField>
        <form.AppField name="date">{() => <TextField label="Date" type="date" />}</form.AppField>
        <form.AppField name="description">{() => <TextField label="Description (optional)" />}</form.AppField>

        <form.Subscribe selector={(state) => state.values.recurrence}>
          {(recurrence) => (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="recurrence-select" className="text-sm font-medium">
                Recurrence
              </label>
              <select
                id="recurrence-select"
                value={recurrence}
                onChange={(e) => form.setFieldValue('recurrence', e.target.value as RecurrenceValue)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form.Subscribe>

        <form.Subscribe selector={(state) => state.values.milestoneType}>
          {(milestoneType) => (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="milestone-type-select" className="text-sm font-medium">
                Milestone Type (optional)
              </label>
              <select
                id="milestone-type-select"
                value={milestoneType}
                onChange={(e) => form.setFieldValue('milestoneType', e.target.value as MilestoneTypeValue)}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {MILESTONE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form.Subscribe>

        <FormError formError={formError} />

        <div className="flex gap-2">
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
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
