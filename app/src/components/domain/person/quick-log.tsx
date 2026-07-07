import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql.js';
import { Button } from '@/components/ui/button.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.js';

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const CREATE_INTERACTION = graphql(`
  mutation QuickLogInteraction(
    $personId: String!
    $channel: String!
    $sentiment: String
    $note: String
  ) {
    createInteraction(
      values: {
        personId: $personId
        channel: $channel
        sentiment: $sentiment
        note: $note
      }
    ) {
      id
      occurredAt
      channel
      sentiment
    }
  }
`);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNELS = [
  { value: 'call', label: 'Phone call' },
  { value: 'in-person', label: 'In person' },
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
] as const;

const SENTIMENTS = [
  { value: 'great', label: '😄 Great', color: 'text-green-600' },
  { value: 'good', label: '🙂 Good', color: 'text-blue-600' },
  { value: 'neutral', label: '😐 Neutral', color: 'text-muted-foreground' },
  { value: 'difficult', label: '😞 Difficult', color: 'text-amber-600' },
] as const;

// ---------------------------------------------------------------------------
// Props & component
// ---------------------------------------------------------------------------

export interface QuickLogProps {
  personId: string;
  personName: string;
  open: boolean;
  onClose: () => void;
  onLogged: () => void;
}

export function QuickLogModal({ personId, personName, open, onClose, onLogged }: QuickLogProps) {
  const [channel, setChannel] = useState<string>('call');
  const [sentiment, setSentiment] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const [createInteraction, { loading }] = useMutation(CREATE_INTERACTION);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createInteraction({
      variables: {
        personId,
        channel,
        sentiment: sentiment ?? undefined,
        note: note.trim() || undefined,
      },
    });
    onLogged();
    onClose();
    // reset for next use
    setChannel('call');
    setSentiment(null);
    setNote('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Log interaction — {personName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Channel */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium">How did you connect?</p>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setChannel(c.value)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    channel === c.value
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sentiment */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">How did it go? (optional)</p>
            <div className="flex gap-2">
              {SENTIMENTS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSentiment(sentiment === s.value ? null : s.value)}
                  className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                    sentiment === s.value ? 'border-foreground bg-muted font-medium' : 'border-border hover:bg-muted'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-muted-foreground">Quick note (optional)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything worth remembering…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Logging…' : 'Log interaction'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
