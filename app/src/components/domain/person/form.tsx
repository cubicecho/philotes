import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Label_ListFragment } from '@/__generated__/graphql';
import { useAppForm } from '@/components/app-form';
import { DialogLayout } from '@/components/dialog-layout';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldRow, Form } from '@/components/ui/form';
import type { PersonPrefill } from '@/lib/contact-intent';
import { ContactFrequency } from '@/lib/vocabulary';

/** How often to stay in touch, as options; the empty value is no cadence. */
const CONTACT_FREQUENCY_OPTIONS = [
  { value: '', label: 'None' },
  { value: ContactFrequency.Weekly, label: 'Weekly' },
  { value: ContactFrequency.Monthly, label: 'Monthly' },
  { value: ContactFrequency.Quarterly, label: 'Quarterly' },
  { value: ContactFrequency.Yearly, label: 'Yearly' },
] as const;

export { CONTACT_FREQUENCY_OPTIONS };

/** A select item cannot carry an empty value, so "None" travels as this inside the form. */
const NO_FREQUENCY = 'none';

/** The frequency options as the select holds them, with `NO_FREQUENCY` in place of the empty value. */
const FREQUENCY_SELECT_OPTIONS = CONTACT_FREQUENCY_OPTIONS.map((opt) => ({
  value: opt.value || NO_FREQUENCY,
  label: opt.label,
}));

/** The text fields that say who a person is and where they work, each stored as null when left empty. */
const TEXT_FIELDS = [
  'namePrefix',
  'firstName',
  'middleName',
  'lastName',
  'nameSuffix',
  'nickname',
  'organization',
  'jobTitle',
  'department',
  'about',
] as const;
type TextField = (typeof TEXT_FIELDS)[number];

/** The fields a person can be called by. A new person needs one of them, as the server requires. */
const NAMING_FIELDS = ['firstName', 'lastName', 'nickname', 'organization'] as const satisfies readonly TextField[];

/** What the person form must hold before it submits. */
const personSchema = z.object({
  namePrefix: z.string(),
  firstName: z.string(),
  middleName: z.string(),
  lastName: z.string(),
  nameSuffix: z.string(),
  nickname: z.string(),
  organization: z.string(),
  jobTitle: z.string(),
  department: z.string(),
  about: z.string(),
  email: z.union([z.literal(''), z.string().trim().email('Please enter a valid email address.')]),
  phone: z.string(),
  contactFrequency: z.string(),
  howWeMet: z.string(),
  firstMetDate: z.date().nullable(),
  labelIds: z.array(z.string()),
});

/** The person form's values while it is being edited. */
type PersonFormFields = z.infer<typeof personSchema>;

/** What a new person's name fields say when all of them are empty. */
const UNNAMED_MESSAGE = 'Give a name, a nickname or an organization.';

/**
 * `YYYY-MM-DD` read as a local day: `new Date(str)` would be UTC midnight, the day before out west.
 *
 * @param value - The day as a `YYYY-MM-DD` string, or a `Date`, which is returned as it is.
 * @returns Local midnight of that day, or `null` for a missing value or a string without all three parts.
 */
function parseDay(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const [year, month, day] = value.split('-').map(Number);
  const isIncomplete = !year || !month || !day;
  if (isIncomplete) {
    return null;
  }
  return new Date(year, month - 1, day);
}

/**
 * A date's local calendar day, as the server stores it.
 *
 * @param date - The date; its local year, month and day are used.
 * @returns The day as `YYYY-MM-DD`.
 */
function formatDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The person columns the form submits. */
export interface PersonFormPerson extends Record<TextField, string | null> {
  /** `null` when no cadence is chosen. */
  contactFrequency?: string | null;
  howWeMet?: string | null;
  /** A `YYYY-MM-DD` day; `null` when none is set. */
  firstMetDate?: string | null;
}

/**
 * What the form submits: the person, the address and number typed for a new one, and the ids of the labels chosen
 * for them.
 */
export interface PersonFormValue {
  person: PersonFormPerson;
  /** A new person's email address, to keep as a contact detail; `null` when none was typed, and on an edit. */
  email: string | null;
  /** A new person's phone number, kept the same way; `null` when none was typed, and on an edit. */
  phone: string | null;
  labelIds: string[];
}

/** A stored person's values, to start an edit from. */
export interface PersonFormInitialValues extends Partial<Record<TextField, string | null>> {
  labelIds?: string[];
  contactFrequency?: string | null;
  howWeMet?: string | null;
  /** A `YYYY-MM-DD` string, or the `Date` the cache's type policy has already made of it. */
  firstMetDate?: string | Date | null;
}

interface PersonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Every label the person could be given. */
  availableLabels: Label_ListFragment[];
  /** The person being edited; left out, the form adds one and clears itself after each save. */
  initialValues?: PersonFormInitialValues;
  /** What a new person starts with, such as the number another app asked to add. Ignored on an edit. */
  prefill?: PersonPrefill;
  submitLabel?: string;
  /**
   * Saves the person and closes the dialog. A rejection's message is shown under the fields and the form stays as
   * typed.
   */
  onSubmit: (value: PersonFormValue) => Promise<void>;
}

/** The dialog that adds or edits a person. Each time it opens, it starts from `initialValues`. */
export function PersonFormDialog({
  open,
  onOpenChange,
  title,
  description,
  availableLabels,
  initialValues,
  prefill: givenPrefill,
  submitLabel,
  onSubmit,
}: PersonFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const prefill = initialValues === undefined ? givenPrefill : undefined;

  const defaultValues: PersonFormFields = {
    namePrefix: initialValues?.namePrefix ?? '',
    firstName: initialValues?.firstName ?? prefill?.firstName ?? '',
    middleName: initialValues?.middleName ?? '',
    lastName: initialValues?.lastName ?? prefill?.lastName ?? '',
    nameSuffix: initialValues?.nameSuffix ?? '',
    nickname: initialValues?.nickname ?? '',
    organization: initialValues?.organization ?? prefill?.organization ?? '',
    jobTitle: initialValues?.jobTitle ?? prefill?.jobTitle ?? '',
    department: initialValues?.department ?? '',
    about: initialValues?.about ?? prefill?.about ?? '',
    email: prefill?.email ?? '',
    phone: prefill?.phone ?? '',
    contactFrequency: initialValues?.contactFrequency || NO_FREQUENCY,
    howWeMet: initialValues?.howWeMet ?? '',
    firstMetDate: parseDay(initialValues?.firstMetDate),
    labelIds: initialValues?.labelIds ?? [],
  };

  const isEdit = initialValues !== undefined;

  const form = useAppForm({
    defaultValues,
    validators: {
      onSubmit: personSchema,
    },
    onSubmit: async ({ value }) => {
      // A new person has to have something to be called by, as the server requires. A stored one may
      // have nothing: a contact a phone synced with only a number.
      const isNamed = isEdit || NAMING_FIELDS.some((field) => value[field].trim() !== '');
      if (isNamed === false) {
        setFormError(UNNAMED_MESSAGE);
        return;
      }
      setFormError(null);
      try {
        await onSubmit({
          person: {
            namePrefix: value.namePrefix.trim() || null,
            firstName: value.firstName.trim() || null,
            middleName: value.middleName.trim() || null,
            lastName: value.lastName.trim() || null,
            nameSuffix: value.nameSuffix.trim() || null,
            nickname: value.nickname.trim() || null,
            organization: value.organization.trim() || null,
            jobTitle: value.jobTitle.trim() || null,
            department: value.department.trim() || null,
            about: value.about.trim() || null,
            contactFrequency: value.contactFrequency === NO_FREQUENCY ? null : value.contactFrequency,
            howWeMet: value.howWeMet || null,
            firstMetDate: value.firstMetDate ? formatDay(value.firstMetDate) : null,
          },
          email: value.email.trim() || null,
          phone: value.phone.trim() || null,
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

  const label = submitLabel ?? (isEdit ? 'Save' : 'Create');

  // The dialog keeps its form while it is shut, so a reopened one starts again from the person as they now stand.
  useEffect(() => {
    if (open) {
      form.reset();
      setFormError(null);
    }
  }, [open, form]);

  return (
    <DialogLayout
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="lg"
      hasUnsavedChanges={() => form.state.isDefaultValue === false}
      contentSlot={
        <form.AppForm>
          <Form className="gap-4">
            <FieldRow
              contentSlot={
                <>
                  <form.AppField name="firstName">{(field) => <field.InputField label="First Name" />}</form.AppField>
                  <form.AppField name="lastName">{(field) => <field.InputField label="Last Name" />}</form.AppField>
                </>
              }
            />
            <FieldRow
              perRow={3}
              contentSlot={
                <>
                  <form.AppField name="namePrefix">{(field) => <field.InputField label="Prefix" />}</form.AppField>
                  <form.AppField name="middleName">{(field) => <field.InputField label="Middle Name" />}</form.AppField>
                  <form.AppField name="nameSuffix">{(field) => <field.InputField label="Suffix" />}</form.AppField>
                </>
              }
            />
            <form.AppField name="nickname">{(field) => <field.InputField label="Nickname" />}</form.AppField>
            <FieldRow
              contentSlot={
                <>
                  <form.AppField name="organization">
                    {(field) => <field.InputField label="Organization" />}
                  </form.AppField>
                  <form.AppField name="jobTitle">{(field) => <field.InputField label="Job Title" />}</form.AppField>
                </>
              }
            />
            <form.AppField name="department">{(field) => <field.InputField label="Department" />}</form.AppField>
            {/* A stored person's addresses and numbers are edited with their other contact details, on their page. */}
            {isEdit ? null : (
              <FieldRow
                contentSlot={
                  <>
                    <form.AppField name="email">
                      {(field) => <field.InputField label="Email (optional)" type="email" autoCapitalize="none" />}
                    </form.AppField>
                    <form.AppField name="phone">
                      {(field) => <field.InputField label="Phone (optional)" type="tel" />}
                    </form.AppField>
                  </>
                }
              />
            )}
            <form.AppField name="contactFrequency">
              {(field) => <field.SelectField label="Contact Frequency" options={FREQUENCY_SELECT_OPTIONS} />}
            </form.AppField>
            <form.AppField name="howWeMet">
              {(field) => (
                <field.TextareaField
                  label="How We Met (optional)"
                  rows={3}
                  placeholder="Share the story of how you met…"
                />
              )}
            </form.AppField>
            <form.AppField name="about">
              {(field) => (
                <field.TextareaField
                  label="About (optional)"
                  rows={3}
                  placeholder="Anything worth keeping with the contact…"
                />
              )}
            </form.AppField>
            <form.AppField name="firstMetDate">
              {(field) => (
                <field.DateTimeField
                  label="First Met Date (optional)"
                  mode="date"
                  clearable
                  placeholder="Pick a date"
                />
              )}
            </form.AppField>
            {availableLabels.length > 0 && (
              <form.AppField name="labelIds">
                {(field) => (
                  <field.ComboboxField
                    multiple
                    label="Labels"
                    options={availableLabels.map((l) => ({ value: l.id, label: l.label, color: l.color }))}
                    placeholder="Add labels…"
                    searchLabel="Search labels"
                    popoverLabel="Labels"
                  />
                )}
              </form.AppField>
            )}
            {formError ? <Alert variant="destructive" title={formError} /> : null}
          </Form>
        </form.AppForm>
      }
      footerActionsSlot={(close) => (
        <>
          <Button variant="outline" onPress={close} content="Cancel" />
          <form.AppForm>
            <form.SubmitButton
              isEdit={isEdit}
              createLabel={label}
              editLabel={label}
              savingLabel={isEdit ? 'Saving...' : 'Creating...'}
            />
          </form.AppForm>
        </>
      )}
    />
  );
}
