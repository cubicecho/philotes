import { useQuery } from '@apollo/client';
import { Link, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Clock } from 'lucide-react';
import { graphql } from '@/__generated__/gql';
import {
  PersonTimeline,
  type TimelineImportantDate,
  type TimelineInteraction,
} from '@/components/domain/person/timeline';
import { Spinner } from '@/components/ui/spinner.tsx';

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const GET_PERSON_TIMELINE = graphql(`
  query GetPersonTimeline($id: String!) {
    persons(where: { id: { eq: $id } }) {
      id
      firstName
      lastName
      interactions(orderBy: { occurredAt: { direction: desc, priority: 1 } }) {
        id
        channel
        occurredAt
        sentiment
        note
        labels {
          id
          label
          color
        }
      }
      importantDates {
        id
        date
        name
        milestoneType
        labels {
          id
          label
          color
        }
      }
    }
  }
`);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PersonTimelinePage() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, loading, error } = useQuery(GET_PERSON_TIMELINE, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
  });

  if (loading) return <Spinner />;
  if (error) return <p>Error loading timeline: {error.message}</p>;

  const person = data?.persons?.[0];
  if (!person) return <p className="text-muted-foreground">Person not found.</p>;

  const interactions: TimelineInteraction[] = (person.interactions ?? []).map((i) => ({
    id: i.id,
    channel: i.channel,
    occurredAt: i.occurredAt,
    sentiment: i.sentiment,
    note: i.note,
    labels: i.labels ?? [],
  }));

  const importantDates: TimelineImportantDate[] = (person.importantDates ?? []).map((d) => ({
    id: d.id,
    date: d.date instanceof Date ? d.date : new Date(d.date),
    name: d.name,
    milestoneType: d.milestoneType,
    labels: d.labels ?? [],
  }));

  return (
    <div className="h-full overflow-y-auto min-h-0 pr-2">
      <div className="space-y-6 py-4">
        {/* Back link */}
        <div>
          <Link
            href={`/persons/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {person.firstName} {person.lastName}
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-muted-foreground shrink-0" />
          <div>
            <h1 className="font-bold text-3xl">Timeline</h1>
            <p className="text-muted-foreground text-sm">
              {person.firstName} {person.lastName}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <PersonTimeline interactions={interactions} importantDates={importantDates} />
      </div>
    </div>
  );
}
