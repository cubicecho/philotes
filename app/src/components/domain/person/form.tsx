import { createFormHook } from '@tanstack/react-form';
import { X } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import type { Label_ListFragment } from '@/__generated__/graphql';
import { Button } from '@/components/ui/button';
import { FieldGroup } from '@/components/ui/field';
import { FormError, fieldContext, formContext, TextField } from '@/components/ui/form-field.tsx';

const CONTACT_FREQUENCY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

export { CONTACT_FREQUENCY_OPTIONS };

const personSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().min(1, 'Email is required.').email('Please enter a valid email address.'),
  contactFrequency: z.string(),
  howWeMet: z.string(),
  firstMetDate: z.string(),
});

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
  firstMetDate?: string | null;
}

interface PersonFormProps {
  availableLabels: Label_ListFragment[];
  initialValues?: PersonFormInitialValues;
  submitLabel?: string;
  onSubmit: (value: PersonFormValue) => Promise<void>;
  onCancel: () => void;
}

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldComponents: { TextField },
  formComponents: {},
  fieldContext,
  formContext,
});

export function PersonForm({ availableLabels, initialValues, submitLabel, onSubmit, onCancel }: PersonFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set(initialValues?.labelIds ?? []));

  const toggleLabel = (id: string) => {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const form = useAppForm({
    defaultValues: {
      firstName: initialValues?.firstName ?? '',
      lastName: initialValues?.lastName ?? '',
      email: initialValues?.email ?? '',
      contactFrequency: initialValues?.contactFrequency ?? '',
      howWeMet: initialValues?.howWeMet ?? '',
      firstMetDate: initialValues?.firstMetDate ?? '',
    },
    validators: {
      onSubmit: personSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await onSubmit({
          person: {
            ...value,
            contactFrequency: value.contactFrequency || null,
            howWeMet: value.howWeMet || null,
            firstMetDate: value.firstMetDate || null,
          },
          labelIds: Array.from(selectedLabelIds),
        });
        if (!initialValues) {
          form.reset();
          setSelectedLabelIds(new Set());
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

  const defaultSubmitLabel = initialValues ? 'Save' : 'Create';
  const submittingLabel = initialValues ? 'Saving...' : 'Creating...';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-4">
        <div className="grid grid-cols-2 gap-4">
          <form.AppField name="firstName">{() => <TextField label="First Name" />}</form.AppField>
          <form.AppField name="lastName">{() => <TextField label="Last Name" />}</form.AppField>
        </div>
        <form.AppField name="email">{() => <TextField label="Email" />}</form.AppField>
        <form.AppField name="contactFrequency">
          {(field) => (
            <div className="space-y-1.5">
              <label htmlFor="contact-frequency" className="text-sm font-medium">
                Contact Frequency
              </label>
              <select
                id="contact-frequency"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {CONTACT_FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form.AppField>
        <form.AppField name="howWeMet">
          {(field) => (
            <div className="space-y-1.5">
              <label htmlFor="how-we-met" className="text-sm font-medium">
                How We Met (optional)
              </label>
              <textarea
                id="how-we-met"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                rows={3}
                placeholder="Share the story of how you met…"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          )}
        </form.AppField>
        <form.AppField name="firstMetDate">
          {(field) => (
            <div className="space-y-1.5">
              <label htmlFor="first-met-date" className="text-sm font-medium">
                First Met Date (optional)
              </label>
              <input
                id="first-met-date"
                type="date"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        </form.AppField>
        {availableLabels.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium text-sm">Labels</p>
            {/* Selected label chips */}
            {selectedLabelIds.size > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {availableLabels
                  .filter((l) => selectedLabelIds.has(l.id))
                  .map((l) => (
                    <span key={l.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: l.color }}
                        aria-hidden="true"
                      />
                      {l.label}
                      <button
                        type="button"
                        onClick={() => toggleLabel(l.id)}
                        className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label={`Remove label ${l.label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
              </div>
            )}
            {/* Available label picker */}
            {availableLabels.some((l) => !selectedLabelIds.has(l.id)) && (
              <div className="flex flex-wrap gap-1.5 rounded-md border border-border p-3">
                {availableLabels
                  .filter((l) => !selectedLabelIds.has(l.id))
                  .map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLabel(l.id)}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer"
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: l.color }}
                        aria-hidden="true"
                      />
                      {l.label}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
        <FormError formError={formError} />
        <div className="flex gap-2">
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? submittingLabel : (submitLabel ?? defaultSubmitLabel)}
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
