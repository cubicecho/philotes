import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { z } from 'zod';
import { useAppForm } from '@/components/app-form';
import { Form } from '@/components/ui/form';
import { FormDialogFooter } from '@/components/ui/form-dialog';

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

// The select cannot hold an empty-string value, so "no recurrence" and "no
// milestone" travel through the form as this and are stripped on the way out.
const NONE = 'none';

function selectOptions(options: ReadonlyArray<{ value: string; label: string }>) {
  return options.map((opt) => ({ value: opt.value || NONE, label: opt.label }));
}

const RECURRENCE_SELECT_OPTIONS = selectOptions(RECURRENCE_OPTIONS);
const MILESTONE_TYPE_SELECT_OPTIONS = selectOptions(MILESTONE_TYPE_OPTIONS);

const importantDateSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  date: z.custom<Date | null>((value) => value instanceof Date, 'Date is required.'),
  description: z.string(),
  recurrence: z.string(),
  milestoneType: z.string(),
});

/** An important date is a calendar day with no time: `yyyy-MM-dd`, read and written in local time. */
const DATE_FORMAT = 'yyyy-MM-dd';

function parseDay(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = parseISO(value.slice(0, 10));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export function ImportantDateForm({ onSubmit, onCancel, initialValues }: ImportantDateFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const defaultValues: z.input<typeof importantDateSchema> = {
    name: initialValues?.name ?? '',
    date: parseDay(initialValues?.date),
    description: initialValues?.description ?? '',
    recurrence: initialValues?.recurrence || NONE,
    milestoneType: initialValues?.milestoneType || NONE,
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: importantDateSchema,
    },
    onSubmit: async ({ value }) => {
      if (!value.date) {
        return;
      }
      setFormError(null);
      try {
        await onSubmit({
          name: value.name,
          date: format(value.date, DATE_FORMAT),
          description: value.description || undefined,
          recurrence: value.recurrence === NONE ? undefined : value.recurrence,
          milestoneType: value.milestoneType === NONE ? undefined : value.milestoneType,
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
    <form.AppForm>
      <Form className="gap-4">
        <form.AppField name="name">{(field) => <field.InputField label="Name" />}</form.AppField>
        <form.AppField name="date">{(field) => <field.DateTimeField label="Date" mode="date" />}</form.AppField>
        <form.AppField name="description">
          {(field) => <field.InputField label="Description (optional)" />}
        </form.AppField>
        <form.AppField name="recurrence">
          {(field) => <field.SelectField label="Recurrence" options={RECURRENCE_SELECT_OPTIONS} />}
        </form.AppField>
        <form.AppField name="milestoneType">
          {(field) => <field.SelectField label="Milestone Type (optional)" options={MILESTONE_TYPE_SELECT_OPTIONS} />}
        </form.AppField>

        <FormDialogFooter onCancel={onCancel} error={formError}>
          <form.SubmitButton createLabel="Save" savingLabel="Saving..." />
        </FormDialogFooter>
      </Form>
    </form.AppForm>
  );
}
