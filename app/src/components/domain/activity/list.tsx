import { useMutation } from '@apollo/client';
import { MapPin, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql';
import type { Person_ActivityListFragment } from '@/__generated__/graphql';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ---------------------------------------------------------------------------
// Fragment
// ---------------------------------------------------------------------------

export const PERSON_ACTIVITY_LIST = graphql(`
  fragment Person_ActivityList on Person {
    id
    activities {
      id
      title
      description
      location
      occurredAt
    }
  }
`);

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const CREATE_ACTIVITY = graphql(`
  mutation CreateActivity(
    $personId: String!
    $title: String!
    $occurredAt: DateTime!
    $location: String
    $description: String
  ) {
    createActivity(
      values: {
        personId: $personId
        title: $title
        occurredAt: $occurredAt
        location: $location
        description: $description
      }
    ) {
      id
      personId
      title
      occurredAt
      location
      description
    }
  }
`);

const DELETE_ACTIVITY = graphql(`
  mutation DeleteActivity($id: String!) {
    deleteActivities(where: { id: { eq: $id } }) {
      id
    }
  }
`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityListProps {
  person: Person_ActivityListFragment;
  onAdd: () => void;
  onDelete: () => void;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Activity row
// ---------------------------------------------------------------------------

interface ActivityRowProps {
  activity: Person_ActivityListFragment['activities'][number];
  onDelete: () => void;
}

function ActivityRow({ activity, onDelete }: ActivityRowProps) {
  const [deleteActivity] = useMutation(DELETE_ACTIVITY);

  const handleDelete = async () => {
    await deleteActivity({ variables: { id: activity.id } });
    onDelete();
  };

  const dateLabel = activity.occurredAt.toLocaleDateString();

  return (
    <div className="rounded-md border border-border px-3 py-2 text-sm space-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{activity.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {activity.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {activity.location}
              </span>
            )}
            <span>{dateLabel}</span>
          </div>
          {activity.description && (
            <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{activity.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Delete activity"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create activity form
// ---------------------------------------------------------------------------

interface CreateActivityFormProps {
  personId: string;
  onAdded: () => void;
  onCancel: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 16);
}

function CreateActivityForm({ personId, onAdded, onCancel }: CreateActivityFormProps) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [occurredAt, setOccurredAt] = useState(todayIso());
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createActivity] = useMutation(CREATE_ACTIVITY);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await createActivity({
        variables: {
          personId,
          title: title.trim(),
          occurredAt: new Date(occurredAt),
          location: location.trim() || null,
          description: description.trim() || null,
        },
      });
      onAdded();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Title */}
      <div className="space-y-1.5">
        <label htmlFor="activity-title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="activity-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What happened?"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
          // biome-ignore lint/a11y/noAutofocus: intentional for modal forms
          autoFocus
        />
      </div>

      {/* Date/time */}
      <div className="space-y-1.5">
        <label htmlFor="activity-date" className="text-sm font-medium">
          Date &amp; Time
        </label>
        <input
          id="activity-date"
          type="datetime-local"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <label htmlFor="activity-location" className="text-sm font-medium">
          Location <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          id="activity-location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Where did it happen?"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label htmlFor="activity-description" className="text-sm font-medium">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <textarea
          id="activity-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Any additional details..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={!title.trim() || submitting}>
          {submitting ? 'Saving...' : 'Add Activity'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function ActivityList({ person, onAdd, onDelete, createOpen, onCreateOpenChange }: ActivityListProps) {
  const sorted = [...person.activities].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  return (
    <div className="space-y-2">
      {sorted.length === 0 && <p className="text-muted-foreground text-sm">No activities yet.</p>}

      {sorted.map((activity) => (
        <ActivityRow key={activity.id} activity={activity} onDelete={onDelete} />
      ))}

      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
          </DialogHeader>
          <CreateActivityForm
            personId={person.id}
            onAdded={() => {
              onCreateOpenChange(false);
              onAdd();
            }}
            onCancel={() => onCreateOpenChange(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card wrapper (self-contained with header + add button)
// ---------------------------------------------------------------------------

interface ActivityListCardProps {
  person: Person_ActivityListFragment;
  onAdd: () => void;
  onDelete: () => void;
}

export function ActivityListCard({ person, onAdd, onDelete }: ActivityListCardProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Activities</h2>
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            Add
          </Button>
        </div>
        <ActivityList
          person={person}
          onAdd={onAdd}
          onDelete={onDelete}
          createOpen={createOpen}
          onCreateOpenChange={setCreateOpen}
        />
      </CardContent>
    </Card>
  );
}
