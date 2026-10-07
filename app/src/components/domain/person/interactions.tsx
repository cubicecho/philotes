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
import {
  ATTACH_INTERACTION_TAG,
  InteractionTagChip,
  InteractionTagPicker,
} from '@/components/domain/person/interaction-tags';
import { AddTagButton, type TagOption } from '@/components/domain/person/tag-picker';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { Pencil, Trash2 } from '@/components/ui/icons';
import { relativeTime } from '@/lib/relative-time';

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const CREATE_INTERACTION = graphql(`
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InteractionData {
  id: string;
  personId: string;
  channel: string;
  occurredAt: Date;
  sentiment: string | null | undefined;
  note: string | null | undefined;
  labels: TagOption[];
}

export interface PersonInteractionsProps {
  personId: string;
  interactions: InteractionData[];
  allTags: TagOption[];
  onChanged: () => void;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Interaction row
// ---------------------------------------------------------------------------

const NOTE_TRUNCATE = 80;

interface InteractionRowProps {
  interaction: InteractionData;
  allTags: TagOption[];
  onChanged: () => void;
}

function InteractionRow({ interaction, allTags, onChanged }: InteractionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [deleteInteraction] = useMutation(DELETE_INTERACTION);
  const [updateInteraction] = useMutation(UPDATE_INTERACTION);

  const longNote = interaction.note && interaction.note.length > NOTE_TRUNCATE;
  const displayNote = longNote && !expanded ? `${interaction.note?.slice(0, NOTE_TRUNCATE)}…` : interaction.note;

  const attachedIds = new Set(interaction.labels.map((t) => t.id));

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
    setEditOpen(false);
    onChanged();
  };

  return (
    <>
      <View className="gap-1.5 rounded-md border border-border px-3 py-2">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 flex-row items-start gap-2">
            <ChannelIcon channel={interaction.channel} className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <View className="min-w-0 flex-1 gap-0.5">
              {/* Date + sentiment */}
              <View className="flex-row items-center gap-2">
                <Text className="text-xs text-muted-foreground">{relativeTime(interaction.occurredAt)}</Text>
                {interaction.sentiment && (
                  <Text aria-label={interaction.sentiment} className="text-xs text-foreground">
                    {sentimentEmoji(interaction.sentiment)}
                  </Text>
                )}
                <Text className="text-xs capitalize text-muted-foreground">
                  {CHANNEL_OPTIONS.find((c) => c.value === interaction.channel)?.label ?? interaction.channel}
                </Text>
              </View>
              {displayNote && <Text className="text-sm text-foreground">{displayNote}</Text>}
              {longNote && (
                <Button
                  variant="link"
                  size="xs"
                  className="self-start px-0"
                  content={expanded ? 'less' : 'more'}
                  onPress={() => setExpanded(!expanded)}
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

        {/* Tags */}
        <View className="gap-1">
          {interaction.labels.length > 0 && (
            <View className="flex-row flex-wrap gap-1">
              {interaction.labels.map((t) => (
                <InteractionTagChip
                  key={t.id}
                  interactionId={interaction.id}
                  labelId={t.id}
                  label={t.label}
                  color={t.color}
                  onDetach={onChanged}
                />
              ))}
            </View>
          )}
          {showAddTag ? (
            <InteractionTagPicker
              interactionId={interaction.id}
              allTags={allTags}
              attachedTagIds={attachedIds}
              onClose={() => setShowAddTag(false)}
              onAdd={onChanged}
            />
          ) : (
            <AddTagButton onPress={() => setShowAddTag(true)} />
          )}
        </View>
      </View>

      <FormDialog open={editOpen} onOpenChange={setEditOpen} title="Edit Interaction">
        <InteractionForm
          personId={interaction.personId}
          allTags={allTags}
          initialValues={{
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

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

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
      {sorted.length === 0 && <Text className="text-sm text-muted-foreground">No interactions yet.</Text>}

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
