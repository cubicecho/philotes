import { useQuery } from '@apollo/client';
import { Link, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { Users } from '@/components/app-icons';
import {
  PersonTimeline,
  type TimelineImportantDate,
  type TimelineInteraction,
} from '@/components/domain/person/timeline';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { QueryError } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/spinner';

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const GET_PERSON_TIMELINE = graphql(`
  query GetPersonTimeline($id: UUID!) {
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

  const { data, loading, error, refetch } = useQuery(GET_PERSON_TIMELINE, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
  });

  const person = data?.persons?.[0];
  const backLink = (
    <Link href={`/persons/${id}`} asChild>
      <Button
        variant="link"
        size="xs"
        iconSlot={<ArrowLeft />}
        content={person ? `Back to ${person.firstName} ${person.lastName}` : 'Back'}
      />
    </Link>
  );

  if (!person) {
    const pending = loading && !error;
    return (
      <PageLayout
        title="Timeline"
        iconSlot={<Clock />}
        breadcrumbsSlot={backLink}
        contentSlot={
          error ? (
            <QueryError error={error} onRetry={() => refetch()} what="the timeline" />
          ) : pending ? (
            <Spinner />
          ) : (
            <EmptyState icon={Users} title="Person not found." />
          )
        }
      />
    );
  }

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
    <PageLayout
      title="Timeline"
      description={`${person.firstName} ${person.lastName}`}
      iconSlot={<Clock />}
      breadcrumbsSlot={backLink}
      contentSlot={
        <View className="py-4">
          <PersonTimeline interactions={interactions} importantDates={importantDates} />
        </View>
      }
    />
  );
}
