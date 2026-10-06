import { useState } from 'react';
import { z } from 'zod';
import type { Label_ListFragment } from '@/__generated__/graphql';
import { useAppForm } from '@/components/app-form';
import { MultiSelect } from '@/components/multi-select';
import { FieldRow, FieldWrapper, Form } from '@/components/ui/form';
import { FormDialogFooter } from '@/components/ui/form-dialog';

const CONTACT_FREQUENCY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

export { CONTACT_FREQUENCY_OPTIONS };

/** A select item cannot carry an empty value, so "None" travels as this inside the form. */
const NO_FREQUENCY = 'none';

const FREQUENCY_SELECT_OPTIONS = CONTACT_FREQUENCY_OPTIONS.map((opt) => ({
  value: opt.value || NO_FREQUENCY,
  label: opt.label,
}));

const personSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().min(1, 'Email is required.').email('Please enter a valid email address.'),
  contactFrequency: z.string(),
  howWeMet: z.string(),
  firstMetDate: z.date().nullable(),
  labelIds: z.array(z.string()),
});

type PersonFormFields = z.infer<typeof personSchema>;

/** `YYYY-MM-DD` read as a local day: `new Date(str)` would be UTC midnight, the day before out west. */
function parseDay(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface PersonFormPerson {
  firstName: string;
  lastName: string;
  email: string;
  contactFrequency?: string | null;
  howWeMet?: string | null;
  firstMetDate?: string | null;
}

export interface PersonFormValue {
  person: PersonFormPerson;
  labelIds: string[];
}

export interface PersonFormInitialValues {
  firstName: string;
  lastName: string;
  email: string | null;
  labelIds?: string[];
  contactFrequency?: string | null;
  howWeMet?: string | null;
  /** A `YYYY-MM-DD` string, or the `Date` the cache's type policy has already made of it. */
  firstMetDate?: string | Date | null;
}

interface PersonFormProps {
  availableLabels: Label_ListFragment[];
  initialValues?: PersonFormInitialValues;
  submitLabel?: string;
  onSubmit: (value: PersonFormValue) => Promise<void>;
  onCancel: () => void;
}

/** The person fields and their footer. It draws no dialog of its own: render it inside a `FormDialog`. */
export function PersonForm({ availableLabels, initialValues, submitLabel, onSubmit, onCancel }: PersonFormProps) {
  const [formError, setFormError] = useState<string | null>(null);

  const defaultValues: PersonFormFields = {
    firstName: initialValues?.firstName ?? '',
    lastName: initialValues?.lastName ?? '',
    email: initialValues?.email ?? '',
    contactFrequency: initialValues?.contactFrequency || NO_FREQUENCY,
    howWeMet: initialValues?.howWeMet ?? '',
    firstMetDate: parseDay(initialValues?.firstMetDate),
    labelIds: initialValues?.labelIds ?? [],
  };

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: personSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await onSubmit({
          person: {
            firstName: value.firstName,
            lastName: value.lastName,
            email: value.email,
            contactFrequency: value.contactFrequency === NO_FREQUENCY ? null : value.contactFrequency,
            howWeMet: value.howWeMet || null,
            firstMetDate: value.firstMetDate ? formatDay(value.firstMetDate) : null,
          },
          labelIds: value.labelIds,
        });
        if (!initialValues) {
          form.reset();
        }
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
        <FieldRow>
          <form.AppField name="firstName">{(field) => <field.InputField label="First Name" />}</form.AppField>
          <form.AppField name="lastName">{(field) => <field.InputField label="Last Name" />}</form.AppField>
        </FieldRow>
        <form.AppField name="email">
          {(field) => <field.InputField label="Email" type="email" autoCapitalize="none" />}
        </form.AppField>
        <form.AppField name="contactFrequency">
          {(field) => <field.SelectField label="Contact Frequency" options={FREQUENCY_SELECT_OPTIONS} />}
        </form.AppField>
        <form.AppField name="howWeMet">
          {(field) => (
            <field.TextareaField label="How We Met (optional)" rows={3} placeholder="Share the story of how you met…" />
          )}
        </form.AppField>
        <form.AppField name="firstMetDate">
          {(field) => (
            <field.DateTimeField label="First Met Date (optional)" mode="date" clearable placeholder="Pick a date" />
          )}
        </form.AppField>
        {availableLabels.length > 0 && (
          <form.AppField name="labelIds">
            {(field) => (
              <FieldWrapper
                label="Labels"
                asGroup
                controlSlot={
                  <MultiSelect
                    options={availableLabels.map((l) => ({ value: l.id, label: l.label, color: l.color }))}
                    value={field.state.value}
                    onValueChange={(next) => field.handleChange(next)}
                    onBlur={field.handleBlur}
                    placeholder="Add labels…"
                    searchLabel="Search labels"
                    popoverLabel="Labels"
                  />
                }
              />
            )}
          </form.AppField>
        )}
        <FormDialogFooter onCancel={onCancel} error={formError}>
          <form.SubmitButton
            isEdit={isEdit}
            createLabel={label}
            editLabel={label}
            savingLabel={isEdit ? 'Saving...' : 'Creating...'}
          />
        </FormDialogFooter>
      </Form>
    </form.AppForm>
  );
}
