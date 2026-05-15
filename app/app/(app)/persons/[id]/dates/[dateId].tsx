import { useQuery } from '@apollo/client';
import { Link, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { graphql } from '@/__generated__/gql.js';
import { RECURRENCE_OPTIONS } from '@/components/domain/person/important-date-form.js';
import { Card, CardContent } from '@/components/ui/card.js';
import { Spinner } from '@/components/ui/spinner.tsx';

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const GET_DATE_DETAIL = graphql(`
  query GetImportantDateDetail($dateId: String!, $personId: String!) {
    importantDates(where: { id: { eq: $dateId } }) {
      id
      name
      description
      date
      recurrence
      labels {
        id
        label
        color
      }
    }
    notes(where: { personId: { eq: $personId } }) {
      id
      body
      labels {
        id
        label
        color
      }
    }
  }
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ImportantDateDetailPage() {
  const { id: personId, dateId } = useLocalSearchParams<{ id: string; dateId: string }>();

  const { data, loading, error } = useQuery(GET_DATE_DETAIL, {
    variables: { dateId, personId },
    fetchPolicy: 'cache-and-network',
  });

  if (loading) return <Spinner />;
  if (error) return <p>Error loading date: {error.message}</p>;

  const date = data?.importantDates?.[0];
  if (!date) return <p className="text-muted-foreground">Date not found.</p>;

  const dateLabelIds = new Set((date.labels ?? []).map((l) => l.id));
  const recurrenceLabel = RECURRENCE_OPTIONS.find((o) => o.value === date.recurrence)?.label;

  // Notes that share at least one tag with this date
  const relatedNotes = (data?.notes ?? []).filter((note) => (note.labels ?? []).some((l) => dateLabelIds.has(l.id)));

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href={`/persons/${personId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to person
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-muted-foreground shrink-0" />
        <div>
          <h1 className="font-bold text-3xl">{date.name}</h1>
          <p className="text-muted-foreground text-sm">
            {formatDate(date.date)}
            {recurrenceLabel && <span className="ml-2">· {recurrenceLabel}</span>}
          </p>
          {date.description && <p className="text-muted-foreground text-sm mt-0.5">{date.description}</p>}
        </div>
      </div>

      {/* Tags */}
      {date.labels && date.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {date.labels.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: l.color }}
                aria-hidden="true"
              />
              {l.label}
            </span>
          ))}
        </div>
      )}

      {/* Related notes */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-semibold text-base">Related Notes</h2>
          <p className="text-xs text-muted-foreground">
            Notes from this person that share at least one tag with this date.
          </p>

          {relatedNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {dateLabelIds.size === 0
                ? 'Add tags to this date to see related notes.'
                : 'No notes share a tag with this date yet.'}
            </p>
          ) : (
            <div className="space-y-2">
              {relatedNotes.map((note) => (
                <div key={note.id} className="rounded-md border border-border px-3 py-2 text-sm space-y-1.5">
                  <p className="whitespace-pre-wrap">{note.body}</p>
                  {note.labels && note.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {note.labels.map((l) => (
                        <span
                          key={l.id}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                            dateLabelIds.has(l.id) ? 'border-primary/40 bg-primary/5' : ''
                          }`}
                        >
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: l.color }}
                            aria-hidden="true"
                          />
                          {l.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
