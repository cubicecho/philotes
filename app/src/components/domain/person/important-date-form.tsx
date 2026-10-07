import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { z } from 'zod';
import { ImportantDatesKindEnum as Kind, ImportantDatesMilestoneTypeEnum as Milestone } from '@/__generated__/graphql';
import { useAppForm } from '@/components/app-form';
import { Form } from '@/components/ui/form';
import { FormDialogFooter } from '@/components/ui/form-dialog';
import { YEARLESS_DATE_YEAR } from '@/lib/time';
import { Recurrence } from '@/lib/vocabulary';

/** How an important date repeats, as options; the empty value is a date that does not. */
export const RECURRENCE_OPTIONS = [
  { value: '', label: 'Does not repeat' },
  { value: Recurrence.Yearly, label: 'Every year' },
  { value: Recurrence.Monthly, label: 'Every month' },
  { value: Recurrence.Weekly, label: 'Every week' },
] as const;

/** A recurrence, or the empty string for a date that does not repeat. */
export type RecurrenceValue = '' | Recurrence;

/** What an important date is, as options. A phone's contact card tells the first two apart from the rest. */
export const KIND_OPTIONS = [
  { value: Kind.Other, label: 'Other' },
  { value: Kind.Birthday, label: 'Birthday' },
  { value: Kind.Anniversary, label: 'Anniversary' },
] as const;

/** The name a date of each kind starts with. `other` has none: its name is the user's to give. */
const KIND_NAMES: Record<Kind, string> = {
  [Kind.Birthday]: 'Birthday',
  [Kind.Anniversary]: 'Anniversary',
  [Kind.Other]: '',
};

/** The milestones an important date can mark, as options; the empty value is a regular date. */
export const MILESTONE_TYPE_OPTIONS = [
  { value: '', label: 'None (regular date)' },
  { value: Milestone.NewJob, label: 'New Job' },
  { value: Milestone.Promotion, label: 'Promotion' },
  { value: Milestone.Moved, label: 'Moved' },
  { value: Milestone.NewBaby, label: 'New Baby' },
  { value: Milestone.Married, label: 'Married' },
  { value: Milestone.Divorced, label: 'Divorced' },
  { value: Milestone.Retired, label: 'Retired' },
  { value: Milestone.HealthEvent, label: 'Health Event' },
  { value: Milestone.Graduation, label: 'Graduation' },
  { value: Milestone.Loss, label: 'Loss / Bereavement' },
  { value: Milestone.Other, label: 'Other' },
] as const;

/** A milestone, or the empty string for a regular date. */
export type MilestoneTypeValue = '' | Milestone;

// The select cannot hold an empty-string value, so "no recurrence" and "no
// milestone" travel through the form as this and are stripped on the way out.
const NONE = 'none';

/**
 * Options as a select can hold them, with `NONE` in place of the empty value.
 *
 * @param options - The options, one of which may have an empty value.
 * @returns The same options and labels, the empty value replaced by `NONE`.
 */
function selectOptions(options: ReadonlyArray<{ value: string; label: string }>) {
  return options.map((opt) => ({ value: opt.value || NONE, label: opt.label }));
}

const RECURRENCE_SELECT_OPTIONS = selectOptions(RECURRENCE_OPTIONS);
const MILESTONE_TYPE_SELECT_OPTIONS = selectOptions(MILESTONE_TYPE_OPTIONS);

/** What the important-date form must hold before it submits: a name and a date. */
const importantDateSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  date: z.custom<Date | null>((value) => value instanceof Date, 'Date is required.'),
  kind: z.nativeEnum(Kind),
  yearUnknown: z.boolean(),
  description: z.string(),
  recurrence: z.string(),
  milestoneType: z.string(),
});

/** An important date is a calendar day with no time: `yyyy-MM-dd`, read and written in local time. */
const DATE_FORMAT = 'yyyy-MM-dd';

/**
 * A stored day read as a local date.
 *
 * @param [value] - The day as `yyyy-MM-dd`; anything after those ten characters is ignored.
 * @returns Local midnight of that day, or `null` when the value is missing or not a date.
 */
function parseDay(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = parseISO(value.slice(0, 10));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The day the date picker starts on. A day without a year is shown in this one, so the picker opens on a
 * calendar the user knows instead of the placeholder year's.
 *
 * @param [initialValues] - The date being edited.
 * @returns The day, or `null` for a blank form.
 */
function initialDay(initialValues: ImportantDateFormValue | undefined): Date | null {
  const day = parseDay(initialValues?.date);
  const isYearless = initialValues?.hasYear === false;
  if (day === null || isYearless === false) {
    return day;
  }
  return withYear(day, new Date().getFullYear());
}

/**
 * The same month and day in another year. 29 February becomes the 28th in a year without one.
 *
 * @param day - The day to move.
 * @param year - The year to move it to.
 * @returns Local midnight of that day.
 */
function withYear(day: Date, year: number): Date {
  const moved = new Date(year, day.getMonth(), day.getDate());
  const isSameMonth = moved.getMonth() === day.getMonth();
  return isSameMonth ? moved : new Date(year, day.getMonth() + 1, 0);
}

/** What the important-date form reads and submits. */
export interface ImportantDateFormValue {
  name: string;
  /** The day as `yyyy-MM-dd`. Under `YEARLESS_DATE_YEAR` when `hasYear` is false. */
  date: string;
  /** Birthday, anniversary or other. */
  kind: Kind;
  /** false when only the month and day are known. */
  hasYear: boolean;
  description?: string;
  /** A `Recurrence` value; left out when the date does not repeat. */
  recurrence?: string;
  /** A `Milestone` value; left out for a regular date. */
  milestoneType?: string;
}

interface ImportantDateFormProps {
  /** Saves the date. A rejection's message is shown in the footer and the form stays as typed. */
  onSubmit: (value: ImportantDateFormValue) => Promise<void>;
  onCancel: () => void;
  /** The date being edited; left out, the form starts blank. */
  initialValues?: ImportantDateFormValue;
}

/** The important-date fields and their footer. It draws no dialog of its own: render it inside a `FormDialog`. */
export function ImportantDateForm({ onSubmit, onCancel, initialValues }: ImportantDateFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const defaultValues: z.input<typeof importantDateSchema> = {
    name: initialValues?.name ?? '',
    date: initialDay(initialValues),
    kind: initialValues?.kind ?? Kind.Other,
    yearUnknown: initialValues?.hasYear === false,
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
        // A day without a year can only come round once a year.
        const recurrence = value.yearUnknown ? Recurrence.Yearly : value.recurrence;
        const day = value.yearUnknown ? withYear(value.date, YEARLESS_DATE_YEAR) : value.date;
        await onSubmit({
          name: value.name,
          date: format(day, DATE_FORMAT),
          kind: value.kind,
          hasYear: value.yearUnknown === false,
          description: value.description || undefined,
          recurrence: recurrence === NONE ? undefined : recurrence,
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
        <form.AppField
          name="kind"
          listeners={{
            onChange: ({ value }) => {
              // A birthday or an anniversary names itself and comes round every year.
              const kindName = KIND_NAMES[value];
              if (kindName === '') {
                return;
              }
              const isUnnamed = form.getFieldValue('name').trim() === '';
              if (isUnnamed) {
                form.setFieldValue('name', kindName);
              }
              form.setFieldValue('recurrence', Recurrence.Yearly);
            },
          }}
        >
          {(field) => <field.SelectField label="Kind" options={KIND_OPTIONS} />}
        </form.AppField>
        <form.AppField name="name">{(field) => <field.InputField label="Name" />}</form.AppField>
        <form.AppField name="date">{(field) => <field.DateTimeField label="Date" mode="date" />}</form.AppField>
        <form.AppField name="yearUnknown">
          {(field) => <field.CheckboxField label="I don't know the year" />}
        </form.AppField>
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
