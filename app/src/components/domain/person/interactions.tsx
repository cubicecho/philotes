import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { ActionButton } from '@/components/action-button';
import { ConfirmButton } from '@/components/confirm-button';
import { ChannelIcon } from '@/components/domain/person/channel-icon';
import {
  CHANNEL_OPTIONS,
  type Channel,
  InteractionForm,
  type InteractionFormValues,
  type Sentiment,
  sentimentEmoji,
} from '@/components/domain/person/interaction-form';
import { ATTACH_INTERACTION_TAG, DETACH_INTERACTION_TAG } from '@/components/domain/person/tag-mutations';
import { RowTags, type TagOption } from '@/components/domain/person/tag-picker';
import { EmptyState } from '@/components/page';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { Pencil, Trash2 } from '@/components/ui/icons';
import { EXCERPT_DEFAULTS } from '@/lib/defaults';
import { relativeTime } from '@/lib/relative-time';

/** Logs an interaction. Shared with the quick log on the people list. */
export const CREATE_INTERACTION = graphql(`
  mutation CreateInteraction(
    $personId: UUID!
    $channel: String!
    $occurredAt: DateTime!
    $sentiment: String
    $note: String
  ) {
    createInteraction(
      values: {
        personId: $personId
        channel: $channel
        occurredAt: $occurredAt
        sentiment: $sentiment
        note: $note
      }
    ) {
      id
      personId
      channel
      occurredAt
      sentiment
      note
    }
  }
`);

const UPDATE_INTERACTION = graphql(`
  mutation UpdateInteraction(
    $id: UUID!
    $channel: String!
    $occurredAt: DateTime!
    $sentiment: String
    $note: String
  ) {
    updateInteraction(
      set: {
        channel: $channel
        occurredAt: $occurredAt
        sentiment: $sentiment
        note: $note
      }
      where: { id: { eq: $id } }
    ) {
      id
      channel
      occurredAt
      sentiment
      note
    }
  }
`);

const DELETE_INTERACTION = graphql(`
  mutation DeleteInteraction($id: UUID!) {
    deleteInteraction(where: { id: { eq: $id } }) {
      id
    }
  }
`);

/** An interaction as its row shows it. */
export interface InteractionData {
  id: string;
  personId: string;
  channel: string;
  occurredAt: Date;
  sentiment: string | null | undefined;
  note: string | null | undefined;
  /** The tags attached to the interaction. */
  labels: TagOption[];
}

export interface PersonInteractionsProps {
  personId: string;
  interactions: InteractionData[];
  /** Every tag the user has. */
  allTags: TagOption[];
  /** Called after an interaction is logged, edited or deleted, or its tags change. */
  onChanged: () => void;
  /** Whether the Log Interaction dialog is open. */
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

/** How many characters of an interaction's note a row shows before “more”. */
const { interactionNoteLength } = EXCERPT_DEFAULTS;

interface InteractionRowProps {
  interaction: InteractionData;
  allTags: TagOption[];
  onChanged: () => void;
}

/**
 * One interaction: when and how it happened, its note cut short behind a “more” toggle, its tags, and its edit and
 * delete.
 */
function InteractionRow({ interaction, allTags, onChanged }: InteractionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteInteraction] = useMutation(DELETE_INTERACTION);
  const [attachTag] = useMutation(ATTACH_INTERACTION_TAG);
  const [detachTag] = useMutation(DETACH_INTERACTION_TAG);
  const [updateInteraction] = useMutation(UPDATE_INTERACTION);

  const note = interaction.note ?? '';
  const isLongNote = note.length > interactionNoteLength;
  const isTruncated = isLongNote && expanded === false;
  const displayNote = isTruncated ? `${note.slice(0, interactionNoteLength)}…` : interaction.note;

  const handleDelete = async () => {
    await deleteInteraction({ variables: { id: interaction.id } });
    onChanged();
  };

  const handleEdit = async (values: InteractionFormValues) => {
    await updateInteraction({
      variables: {
        id: interaction.id,
        channel: values.channel,
        occurredAt: values.occurredAt,
        sentiment: values.sentiment || null,
        note: values.note || null,
      },
    });
    // The tags are rows of their own: attach the ones the form added, detach the ones it dropped.
    const currentIds = new Set(interaction.labels.map((l) => l.id));
    const wantedIds = new Set(values.labelIds);
    for (const labelId of wantedIds) {
      const isNew = currentIds.has(labelId) === false;
      if (isNew) {
        await attachTag({ variables: { interactionId: interaction.id, labelId } });
      }
    }
    for (const labelId of currentIds) {
      const isDropped = wantedIds.has(labelId) === false;
      if (isDropped) {
        await detachTag({ variables: { interactionId: interaction.id, labelId } });
      }
    }
    setEditOpen(false);
    onChanged();
  };

  return (
    <>
      <View className="gap-1.5 rounded-md border border-foreground/10 px-3 py-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 flex-row items-start gap-2">
            <ChannelIcon channel={interaction.channel} className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60" />
            <View className="min-w-0 flex-1 gap-0.5">
              {/* Date + sentiment */}
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-foreground/60">{relativeTime(interaction.occurredAt)}</Text>
                {interaction.sentiment && (
                  <Text aria-label={interaction.sentiment} className="text-xs text-foreground">
                    {sentimentEmoji(interaction.sentiment)}
                  </Text>
                )}
                <Text className="text-xs capitalize text-foreground/60">
                  {CHANNEL_OPTIONS.find((c) => c.value === interaction.channel)?.label ?? interaction.channel}
                </Text>
              </View>
              {displayNote && <Text className="text-sm text-foreground">{displayNote}</Text>}
              {isLongNote && (
                <Button
                  variant="link"
                  size="xs"
                  className="self-start px-0"
                  content={expanded ? 'less' : 'more'}
                  onPress={() => setExpanded(expanded === false)}
                />
              )}
            </View>
          </View>
          <View className="shrink-0 flex-row gap-1">
            <ActionButton
              label="Edit interaction"
              variant="ghost"
              size="icon-xs"
              iconSlot={<Pencil />}
              onPress={() => setEditOpen(true)}
            />
            <ConfirmButton
              label="Delete interaction"
              variant="ghost"
              size="icon-xs"
              iconSlot={<Trash2 />}
              title="Delete this interaction?"
              description="Its note and tags go with it, and the person's last contact falls back to the one before."
              onConfirm={handleDelete}
            />
          </View>
        </View>

        <RowTags
          tags={interaction.labels}
          allTags={allTags}
          onAttach={(labelId) => attachTag({ variables: { interactionId: interaction.id, labelId } })}
          onDetach={(labelId) => detachTag({ variables: { interactionId: interaction.id, labelId } })}
          onChanged={onChanged}
        />
      </View>

      <FormDialog open={editOpen} onOpenChange={setEditOpen} title="Edit Interaction">
        <InteractionForm
          personId={interaction.personId}
          allTags={allTags}
          initialValues={{
            // Both asserted, not narrowed: a stored value the form no longer offers (an old `video`
            // channel) has to reach the save unchanged, and narrowing would replace it.
            channel: interaction.channel as Channel,
            occurredAt: interaction.occurredAt,
            sentiment: (interaction.sentiment as Sentiment | undefined) ?? '',
            note: interaction.note ?? '',
            labelIds: interaction.labels.map((l) => l.id),
          }}
          submitLabel="Save Changes"
          onSubmit={handleEdit}
          onCancel={() => setEditOpen(false)}
        />
      </FormDialog>
    </>
  );
}

/** A person's interactions, in the order given, and the dialog that logs one. */
export function PersonInteractions({
  personId,
  interactions,
  allTags,
  onChanged,
  createOpen,
  onCreateOpenChange,
}: PersonInteractionsProps) {
  const [createInteraction] = useMutation(CREATE_INTERACTION);
  const [attachTag] = useMutation(ATTACH_INTERACTION_TAG);

  // Sort by most recent first
  const sorted = [...interactions].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  const handleCreate = async (values: InteractionFormValues) => {
    const result = await createInteraction({
      variables: {
        personId,
        channel: values.channel,
        occurredAt: values.occurredAt,
        sentiment: values.sentiment || null,
        note: values.note || null,
      },
    });
    const interactionId = result.data?.createInteraction?.id;
    if (interactionId) {
      for (const labelId of values.labelIds) {
        await attachTag({ variables: { interactionId, labelId } });
      }
    }
    onCreateOpenChange(false);
    onChanged();
  };

  return (
    <View className="gap-2">
      {sorted.length === 0 && <EmptyState compact title="No interactions yet." />}

      {sorted.map((interaction) => (
        <InteractionRow key={interaction.id} interaction={interaction} allTags={allTags} onChanged={onChanged} />
      ))}

      <FormDialog open={createOpen} onOpenChange={onCreateOpenChange} title="Log Interaction">
        <InteractionForm
          personId={personId}
          allTags={allTags}
          onSubmit={handleCreate}
          onCancel={() => onCreateOpenChange(false)}
        />
      </FormDialog>
    </View>
  );
}
