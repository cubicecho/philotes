import { useState } from 'react';
import { useAppForm } from '@/components/app-form';
import { ChannelIcon } from '@/components/domain/person/channel-icon';
import { type TagOption, TagsField } from '@/components/domain/person/tag-picker';
import { FieldWrapper, Form } from '@/components/ui/form';
import { FormDialogFooter } from '@/components/ui/form-dialog';
import { SegmentedButton, SegmentedGroup } from '@/components/ui/segmented';
import { InteractionChannel, InteractionSentiment } from '@/lib/vocabulary';

/** How an interaction took place. */
export type Channel = InteractionChannel;
/** How an interaction went. */
export type Sentiment = InteractionSentiment;

/** The channels an interaction can be logged on, in the order offered. */
export const CHANNEL_OPTIONS: Array<{ value: Channel; label: string }> = [
  { value: InteractionChannel.Call, label: 'Call' },
  { value: InteractionChannel.Text, label: 'Text' },
  { value: InteractionChannel.Email, label: 'Email' },
  { value: InteractionChannel.InPerson, label: 'In Person' },
  { value: InteractionChannel.Other, label: 'Other' },
];

/** The sentiments an interaction can be given, each with the emoji that stands for it. */
export const SENTIMENT_OPTIONS: Array<{
  value: Sentiment;
  label: string;
  emoji: string;
}> = [
  { value: InteractionSentiment.Great, label: 'Great', emoji: '😄' },
  { value: InteractionSentiment.Good, label: 'Good', emoji: '🙂' },
  { value: InteractionSentiment.Neutral, label: 'Neutral', emoji: '😐' },
  { value: InteractionSentiment.Difficult, label: 'Difficult', emoji: '😟' },
];

/**
 * The channel a segmented button reported; undefined for a value that is not one.
 *
 * @param value - What the segmented group reported.
 * @returns The matching channel, or `undefined`.
 */
function findChannel(value: string): Channel | undefined {
  return CHANNEL_OPTIONS.find((option) => option.value === value)?.value;
}

/**
 * The sentiment a segmented button reported; undefined for a value that is not one.
 *
 * @param value - What the segmented group reported.
 * @returns The matching sentiment, or `undefined`.
 */
function findSentiment(value: string): Sentiment | undefined {
  return SENTIMENT_OPTIONS.find((option) => option.value === value)?.value;
}

/**
 * The emoji that stands for a sentiment.
 *
 * @param sentiment - The stored sentiment, if the interaction has one.
 * @returns The emoji, or an empty string for no sentiment or one that is not known.
 */
export function sentimentEmoji(sentiment: string | null | undefined): string {
  return SENTIMENT_OPTIONS.find((s) => s.value === sentiment)?.emoji ?? '';
}

/** What the interaction form holds and submits. */
export interface InteractionFormValues {
  channel: Channel;
  occurredAt: Date;
  /** The empty string when no sentiment is chosen. */
  sentiment: Sentiment | '';
  note: string;
  /** The ids of the tags chosen for the interaction. */
  labelIds: string[];
}

interface InteractionFormProps {
  /** Unused. */
  personId: string;
  /** Every tag the user has. */
  allTags: TagOption[];
  /** Values to start from; a field left out starts as a call, now, with no sentiment, note or tags. */
  initialValues?: Partial<InteractionFormValues>;
  submitLabel?: string;
  /** Saves the interaction. A rejection's message is shown in the footer and the form stays as typed. */
  onSubmit: (values: InteractionFormValues) => Promise<void>;
  onCancel: () => void;
}

/** The interaction fields and their footer. It draws no dialog of its own: render it inside a `FormDialog`. */
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
    channel: initialValues?.channel ?? InteractionChannel.Call,
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
                  onValueChange={(next) => {
                    const channel = findChannel(next);
                    if (channel) {
                      field.handleChange(channel);
                    }
                  }}
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
                  onValueChange={(next) => {
                    const isCurrent = field.state.value === next;
                    field.handleChange(isCurrent ? '' : (findSentiment(next) ?? ''));
                  }}
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
