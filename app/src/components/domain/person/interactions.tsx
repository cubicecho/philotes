import { useMutation } from '@apollo/client';
import { Mail, MessageSquare, MoreHorizontal, Pencil, Phone, Tag, Trash2, Users, X } from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TagMultiSelect } from '@/components/ui/tag-multi-select';

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const CREATE_INTERACTION = graphql(`
  mutation CreateInteraction(
    $personId: String!
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
    $id: String!
    $channel: String!
    $occurredAt: DateTime!
    $sentiment: String
    $note: String
  ) {
    updateInteractions(
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
  mutation DeleteInteraction($id: String!) {
    deleteInteractions(where: { id: { eq: $id } }) {
      id
    }
  }
`);

const ATTACH_INTERACTION_TAG = graphql(`
  mutation AttachInteractionTag($interactionId: String!, $labelId: String!) {
    createInteractionTag(
      values: { interactionId: $interactionId, labelId: $labelId }
    ) {
      interactionId
      labelId
    }
  }
`);

const DETACH_INTERACTION_TAG = graphql(`
  mutation DetachInteractionTag($interactionId: String!, $labelId: String!) {
    deleteInteractionTags(
      where: {
        interactionId: { eq: $interactionId }
        labelId: { eq: $labelId }
      }
    ) {
      interactionId
      labelId
    }
  }
`);

// ---------------------------------------------------------------------------
// Channel / Sentiment helpers
// ---------------------------------------------------------------------------

type Channel = 'call' | 'text' | 'email' | 'in-person' | 'other';
type Sentiment = 'great' | 'good' | 'neutral' | 'difficult';

const CHANNEL_OPTIONS: Array<{ value: Channel; label: string }> = [
  { value: 'call', label: 'Call' },
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'in-person', label: 'In Person' },
  { value: 'other', label: 'Other' },
];

const SENTIMENT_OPTIONS: Array<{
  value: Sentiment;
  label: string;
  emoji: string;
}> = [
  { value: 'great', label: 'Great', emoji: '😄' },
  { value: 'good', label: 'Good', emoji: '🙂' },
  { value: 'neutral', label: 'Neutral', emoji: '😐' },
  { value: 'difficult', label: 'Difficult', emoji: '😟' },
];

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  switch (channel as Channel) {
    case 'call':
      return <Phone className={className} />;
    case 'text':
      return <MessageSquare className={className} />;
    case 'email':
      return <Mail className={className} />;
    case 'in-person':
      return <Users className={className} />;
    default:
      return <MoreHorizontal className={className} />;
  }
}

function sentimentEmoji(sentiment: string | null | undefined): string {
  return SENTIMENT_OPTIONS.find((s) => s.value === sentiment)?.emoji ?? '';
}

function relativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

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
  labels: Array<{ id: string; label: string; color: string }>;
}

export interface PersonInteractionsProps {
  personId: string;
  interactions: InteractionData[];
  allTags: Array<{ id: string; label: string; color: string }>;
  onChanged: () => void;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Tag chip (detachable)
// ---------------------------------------------------------------------------

interface InteractionTagChipProps {
  interactionId: string;
  labelId: string;
  label: string;
  color: string;
  onDetach: () => void;
}

function InteractionTagChip({ interactionId, labelId, label, color, onDetach }: InteractionTagChipProps) {
  const [detachTag] = useMutation(DETACH_INTERACTION_TAG);

  const handleDetach = async () => {
    await detachTag({ variables: { interactionId, labelId } });
    onDetach();
  };

  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
      <span
        className="inline-block h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
      <button
        type="button"
        onClick={handleDetach}
        className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
        aria-label={`Remove tag ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tag picker
// ---------------------------------------------------------------------------

interface InteractionTagPickerProps {
  interactionId: string;
  allTags: Array<{ id: string; label: string; color: string }>;
  attachedTagIds: Set<string>;
  onClose: () => void;
  onAdd: () => void;
}

function InteractionTagPicker({ interactionId, allTags, attachedTagIds, onClose, onAdd }: InteractionTagPickerProps) {
  const [attachTag] = useMutation(ATTACH_INTERACTION_TAG);
  const available = allTags.filter((t) => !attachedTagIds.has(t.id));

  const handleSelect = async (labelId: string) => {
    await attachTag({ variables: { interactionId, labelId } });
    onAdd();
    onClose();
  };

  if (available.length === 0) {
    return (
      <div className="flex gap-1.5 rounded-md border border-border p-2 text-xs text-muted-foreground">
        All tags attached.
        <button type="button" onClick={onClose} className="ml-auto hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-border p-2">
      {available.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => handleSelect(t.id)}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer"
        >
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: t.color }}
            aria-hidden="true"
          />
          {t.label}
        </button>
      ))}
      <button
        type="button"
        onClick={onClose}
        className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interaction form (create + edit)
// ---------------------------------------------------------------------------

interface InteractionFormValues {
  channel: Channel;
  occurredAt: string;
  sentiment: Sentiment | '';
  note: string;
  labelIds: string[];
}

interface InteractionFormProps {
  personId: string;
  allTags: Array<{ id: string; label: string; color: string }>;
  initialValues?: Partial<InteractionFormValues>;
  submitLabel?: string;
  onSubmit: (values: InteractionFormValues) => Promise<void>;
  onCancel: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 16);
}

function InteractionForm({
  personId: _personId,
  allTags,
  initialValues,
  submitLabel = 'Add Interaction',
  onSubmit,
  onCancel,
}: InteractionFormProps) {
  const [channel, setChannel] = useState<Channel>(initialValues?.channel ?? 'call');
  const [occurredAt, setOccurredAt] = useState(
    initialValues?.occurredAt ? new Date(initialValues.occurredAt).toISOString().slice(0, 16) : todayIso(),
  );
  const [sentiment, setSentiment] = useState<Sentiment | ''>(initialValues?.sentiment ?? '');
  const [note, setNote] = useState(initialValues?.note ?? '');
  const [labelIds, setLabelIds] = useState<string[]>(initialValues?.labelIds ?? []);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({ channel, occurredAt, sentiment, note, labelIds });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Date/time */}
      <div className="space-y-1.5">
        <label htmlFor="interaction-date" className="text-sm font-medium">
          Date &amp; Time
        </label>
        <input
          id="interaction-date"
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </div>

      {/* Channel */}
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Channel</span>
        <div className="flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setChannel(opt.value)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                channel === opt.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <ChannelIcon channel={opt.value} className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sentiment */}
      <div className="space-y-1.5">
        <span className="text-sm font-medium">Sentiment</span>
        <div className="flex flex-wrap gap-2">
          {SENTIMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSentiment(sentiment === opt.value ? '' : opt.value)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                sentiment === opt.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <span>{opt.emoji}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <label htmlFor="interaction-note" className="text-sm font-medium">
          Note
        </label>
        <textarea
          id="interaction-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What happened?"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="interaction-tags" className="text-sm font-medium">
            Tags
          </label>
          <TagMultiSelect
            id="interaction-tags"
            options={allTags}
            selected={labelIds}
            onChange={setLabelIds}
            placeholder="Add tags..."
          />
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Interaction row
// ---------------------------------------------------------------------------

interface InteractionRowProps {
  interaction: InteractionData;
  allTags: Array<{ id: string; label: string; color: string }>;
  onChanged: () => void;
}

function InteractionRow({ interaction, allTags, onChanged }: InteractionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [deleteInteraction] = useMutation(DELETE_INTERACTION);
  const [updateInteraction] = useMutation(UPDATE_INTERACTION);

  const NOTE_TRUNCATE = 80;
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
        occurredAt: new Date(values.occurredAt),
        sentiment: values.sentiment || null,
        note: values.note || null,
      },
    });
    setEditOpen(false);
    onChanged();
  };

  return (
    <>
      <div className="rounded-md border border-border px-3 py-2 text-sm space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {/* Channel icon */}
            <ChannelIcon channel={interaction.channel} className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              {/* Date + sentiment */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{relativeTime(interaction.occurredAt)}</span>
                {interaction.sentiment && (
                  <span title={interaction.sentiment}>{sentimentEmoji(interaction.sentiment)}</span>
                )}
                <span className="capitalize">
                  {CHANNEL_OPTIONS.find((c) => c.value === interaction.channel)?.label ?? interaction.channel}
                </span>
              </div>
              {/* Note */}
              {displayNote && (
                <p className="mt-0.5 text-sm whitespace-pre-wrap">
                  {displayNote}
                  {longNote && (
                    <button
                      type="button"
                      onClick={() => setExpanded(!expanded)}
                      className="ml-1 text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      {expanded ? 'less' : 'more'}
                    </button>
                  )}
                </p>
              )}
            </div>
          </div>
          {/* Actions */}
          <div className="flex shrink-0 gap-1 text-muted-foreground">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="hover:text-foreground transition-colors"
              aria-label="Edit interaction"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="hover:text-destructive transition-colors"
              aria-label="Delete interaction"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-1">
          {interaction.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
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
            </div>
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
            <button
              type="button"
              onClick={() => setShowAddTag(true)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Tag className="h-3 w-3" />
              Add tag
            </button>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Interaction</DialogTitle>
          </DialogHeader>
          <InteractionForm
            personId={interaction.personId}
            allTags={allTags}
            initialValues={{
              channel: interaction.channel as Channel,
              occurredAt: interaction.occurredAt.toISOString().slice(0, 16),
              sentiment: (interaction.sentiment as Sentiment | undefined) ?? '',
              note: interaction.note ?? '',
              labelIds: interaction.labels.map((l) => l.id),
            }}
            submitLabel="Save Changes"
            onSubmit={handleEdit}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Create interaction form (in a dialog)
// ---------------------------------------------------------------------------

interface CreateInteractionFormProps {
  personId: string;
  allTags: Array<{ id: string; label: string; color: string }>;
  onAdded: () => void;
  onCancel: () => void;
}

function CreateInteractionForm({ personId, allTags, onAdded, onCancel }: CreateInteractionFormProps) {
  const [createInteraction] = useMutation(CREATE_INTERACTION);
  const [attachTag] = useMutation(ATTACH_INTERACTION_TAG);

  const handleSubmit = async (values: InteractionFormValues) => {
    const result = await createInteraction({
      variables: {
        personId,
        channel: values.channel,
        occurredAt: new Date(values.occurredAt),
        sentiment: values.sentiment || null,
        note: values.note || null,
      },
    });
    const interactionId = result.data?.createInteraction?.id;
    if (interactionId && values.labelIds.length > 0) {
      for (const labelId of values.labelIds) {
        await attachTag({ variables: { interactionId, labelId } });
      }
    }
    onAdded();
  };

  return <InteractionForm personId={personId} allTags={allTags} onSubmit={handleSubmit} onCancel={onCancel} />;
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
  // Sort by most recent first
  const sorted = [...interactions].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  return (
    <div className="space-y-2">
      {sorted.length === 0 && <p className="text-muted-foreground text-sm">No interactions yet.</p>}

      {sorted.map((interaction) => (
        <InteractionRow key={interaction.id} interaction={interaction} allTags={allTags} onChanged={onChanged} />
      ))}

      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Interaction</DialogTitle>
          </DialogHeader>
          <CreateInteractionForm
            personId={personId}
            allTags={allTags}
            onAdded={() => {
              onCreateOpenChange(false);
              onChanged();
            }}
            onCancel={() => onCreateOpenChange(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
