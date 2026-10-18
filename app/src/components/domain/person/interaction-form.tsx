import { useState } from 'react';
import { useAppForm } from '@/components/app-form';
import { DialogLayout } from '@/components/dialog-layout';
import { ChannelIcon } from '@/components/domain/person/channel-icon';
import { type TagOption, tagsFieldProps } from '@/components/domain/person/tag-picker';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldWrapper, Form } from '@/components/ui/form';
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

interface InteractionFormDialogProps {
  open: boolean;
  /** Called when the dialog asks to close, and with `false` once the interaction is saved. */
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | undefined;
  /** Every tag the user has. */
  allTags: TagOption[];
  /** Values to start from; a field left out starts as a call, now, with no sentiment, note or tags. */
  initialValues?: Partial<InteractionFormValues>;
  submitLabel?: string;
  /**
   * Saves the interaction. On success the form resets and the dialog closes; a rejection's message is shown under
   * the fields and the form stays as typed.
   */
  onSubmit: (values: InteractionFormValues) => Promise<void>;
}

/** The dialog that logs or edits an interaction: when, the channel, the sentiment, a note and its tags. */
export function InteractionFormDialog({
  open,
  onOpenChange,
  title,
  description,
  allTags,
  initialValues,
  submitLabel = 'Add Interaction',
  onSubmit,
}: InteractionFormDialogProps) {
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
        return;
      }
      form.reset();
      onOpenChange(false);
    },
  });

  // The dialog stays mounted while shut, so whatever way it closes, the next opening starts afresh.
  const handleOpenChange = (next: boolean) => {
    const isClosing = next === false;
    if (isClosing) {
      form.reset();
      setFormError(null);
    }
    onOpenChange(next);
  };

  return (
    <DialogLayout
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      hasUnsavedChanges={() => form.state.isDefaultValue === false}
      contentSlot={
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
                        <SegmentedButton
                          key={opt.value}
                          value={opt.value}
                          iconSlot={<ChannelIcon channel={opt.value} />}
                        >
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

            {allTags.length > 0 && (
              <form.AppField name="labelIds">
                {(field) => <field.ComboboxField multiple {...tagsFieldProps(allTags)} />}
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
            <form.SubmitButton createLabel={submitLabel} savingLabel="Saving..." />
          </form.AppForm>
        </>
      )}
    />
  );
}
