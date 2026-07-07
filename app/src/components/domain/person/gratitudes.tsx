import { useMutation } from '@apollo/client';
import { Heart, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql.js';
import { Button } from '@/components/ui/button.js';

// ---------------------------------------------------------------------------
// GraphQL mutations (no refetchQueries — parent calls onAdd / onDelete)
// ---------------------------------------------------------------------------

const CREATE_GRATITUDE = graphql(`
  mutation CreateGratitude($personId: String!, $body: String!) {
    createGratitude(values: { personId: $personId, body: $body }) {
      id
      body
      createdAt
    }
  }
`);

const DELETE_GRATITUDE = graphql(`
  mutation DeleteGratitude($id: String!) {
    deleteGratitudes(where: { id: { eq: $id } }) {
      id
    }
  }
`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GratitudeEntry {
  id: string;
  body: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Single entry row
// ---------------------------------------------------------------------------

interface EntryRowProps {
  entry: GratitudeEntry;
  onDeleted: (id: string) => void;
}

function EntryRow({ entry, onDeleted }: EntryRowProps) {
  const [del, { loading }] = useMutation(DELETE_GRATITUDE);

  const handleDelete = async () => {
    await del({ variables: { id: entry.id } });
    onDeleted(entry.id);
  };

  return (
    <div className="group flex items-start gap-2 rounded-md px-3 py-2 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
      <Heart className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
      <p className="flex-1 text-sm leading-snug">{entry.body}</p>
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
        aria-label="Remove"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add form
// ---------------------------------------------------------------------------

interface AddFormProps {
  personId: string;
  onAdded: () => void;
  onCancel: () => void;
}

function AddForm({ personId, onAdded, onCancel }: AddFormProps) {
  const [body, setBody] = useState('');
  const [create, { loading }] = useMutation(CREATE_GRATITUDE);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    await create({ variables: { personId, body: body.trim() } });
    setBody('');
    onAdded();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="What do you appreciate about this person?"
        className="w-full rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-700 resize-none"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading || !body.trim()}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface PersonGratitudesProps {
  personId: string;
  entries: GratitudeEntry[];
  onAdd: () => void;
  onDelete: () => void;
}

export function PersonGratitudes({ personId, entries, onAdd, onDelete }: PersonGratitudesProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base flex items-center gap-1.5">
          <Heart className="h-4 w-4 text-amber-500" />
          Gratitude
          {entries.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">({entries.length})</span>
          )}
        </h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      {showForm && (
        <AddForm
          personId={personId}
          onAdded={() => { setShowForm(false); onAdd(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {entries.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground italic">
          What do you appreciate about this person?
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} onDeleted={() => onDelete()} />
          ))}
        </div>
      )}
    </div>
  );
}
