import { useState } from 'react';
import { useAppForm } from '@/components/app-form';
import { ChannelIcon } from '@/components/domain/person/channel-icon';
import { type TagOption, TagsField } from '@/components/domain/person/tag-picker';
import { FieldWrapper, Form } from '@/components/ui/form';
import { FormDialogFooter } from '@/components/ui/form-dialog';
import { SegmentedButton, SegmentedGroup } from '@/components/ui/segmented';

export type Channel = 'call' | 'text' | 'email' | 'in-person' | 'other';
export type Sentiment = 'great' | 'good' | 'neutral' | 'difficult';

export const CHANNEL_OPTIONS: Array<{ value: Channel; label: string }> = [
  { value: 'call', label: 'Call' },
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'in-person', label: 'In Person' },
  { value: 'other', label: 'Other' },
];

export const SENTIMENT_OPTIONS: Array<{
  value: Sentiment;
  label: string;
  emoji: string;
}> = [
  { value: 'great', label: 'Great', emoji: '😄' },
  { value: 'good', label: 'Good', emoji: '🙂' },
  { value: 'neutral', label: 'Neutral', emoji: '😐' },
  { value: 'difficult', label: 'Difficult', emoji: '😟' },
];

export function sentimentEmoji(sentiment: string | null | undefined): string {
  return SENTIMENT_OPTIONS.find((s) => s.value === sentiment)?.emoji ?? '';
}

export interface InteractionFormValues {
  channel: Channel;
  occurredAt: Date;
  sentiment: Sentiment | '';
  note: string;
  labelIds: string[];
}

interface InteractionFormProps {
  personId: string;
  allTags: TagOption[];
  initialValues?: Partial<InteractionFormValues>;
  submitLabel?: string;
  onSubmit: (values: InteractionFormValues) => Promise<void>;
  onCancel: () => void;
}

export function InteractionForm({
  personId: _personId,
  allTags,
  initialValues,
  submitLabel = 'Add Interaction',
  onSubmit,
  onCancel,
}: InteractionFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const defaultValues: InteractionFormValues = {
    channel: initialValues?.channel ?? 'call',
    occurredAt: initialValues?.occurredAt ?? new Date(),
    sentiment: initialValues?.sentiment ?? '',
    note: initialValues?.note ?? '',
    labelIds: initialValues?.labelIds ?? [],
  };

  const form = useAppForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await onSubmit(value);
      } catch (err: unknown) {
        setFormError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    },
  });

  return (
    <form.AppForm>
      <Form className="gap-4">
        <form.AppField name="occurredAt">
          {(field) => <field.DateTimeField label="Date & Time" required />}
        </form.AppField>

        <form.AppField name="channel">
          {(field) => (
            <FieldWrapper
              label="Channel"
              asGroup
              controlSlot={
                <SegmentedGroup
                  variant="plain"
                  className="flex-wrap"
                  value={field.state.value}
                  onValueChange={(next) => field.handleChange(next as Channel)}
                >
                  {CHANNEL_OPTIONS.map((opt) => (
                    <SegmentedButton key={opt.value} value={opt.value} iconSlot={<ChannelIcon channel={opt.value} />}>
                      {opt.label}
                    </SegmentedButton>
                  ))}
                </SegmentedGroup>
              }
            />
          )}
        </form.AppField>

        <form.AppField name="sentiment">
          {(field) => (
            <FieldWrapper
              label="Sentiment"
              asGroup
              controlSlot={
                <SegmentedGroup
                  variant="plain"
                  className="flex-wrap"
                  value={field.state.value}
                  // Pressing the current sentiment again clears it: it is optional.
                  onValueChange={(next) => field.handleChange(field.state.value === next ? '' : (next as Sentiment))}
                >
                  {SENTIMENT_OPTIONS.map((opt) => (
                    <SegmentedButton key={opt.value} value={opt.value}>
                      {`${opt.emoji} ${opt.label}`}
                    </SegmentedButton>
                  ))}
                </SegmentedGroup>
              }
            />
          )}
        </form.AppField>

        <form.AppField name="note">
          {(field) => <field.TextareaField label="Note" rows={3} placeholder="What happened?" />}
        </form.AppField>

        {allTags.length > 0 && <form.AppField name="labelIds">{() => <TagsField allTags={allTags} />}</form.AppField>}

        <FormDialogFooter onCancel={onCancel} error={formError}>
          <form.SubmitButton createLabel={submitLabel} savingLabel="Saving..." />
        </FormDialogFooter>
      </Form>
    </form.AppForm>
  );
}
