import { type ApolloError, useQuery } from '@apollo/client';
import { Link, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { Users } from '@/components/app-icons';
import { GET_PERSON_INTERACTIONS } from '@/components/domain/person/person-queries';
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
import { PAGE_SIZE_DEFAULTS } from '@/lib/defaults';
import { fullName } from '@/lib/person-name';
import { useAllRows } from '@/lib/use-all-rows';

const GET_PERSON_TIMELINE = graphql(`
  query GetPersonTimeline($id: UUID!) {
    persons(where: { id: { eq: $id } }, limit: 1) {
      id
      firstName
      lastName
      importantDates(limit: 100) {
        id
        date
        name
        milestoneType
        labels(limit: 10) {
          id
          label
          color
        }
      }
    }
  }
`);

/** What stands in for the timeline until there is a person: the failure, a spinner, or "not found". */
function TimelinePlaceholder({
  error,
  pending,
  onRetry,
}: {
  error: ApolloError | undefined;
  pending: boolean;
  onRetry: () => void;
}) {
  if (error) {
    return <QueryError error={error} onRetry={onRetry} what="the timeline" />;
  }
  if (pending) {
    return <Spinner />;
  }
  return <EmptyState icon={Users} title="Person not found." />;
}

export default function PersonTimelinePage() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, loading, error, refetch } = useQuery(GET_PERSON_TIMELINE, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
  });
  const interactionsQuery = useAllRows(GET_PERSON_INTERACTIONS, {
    field: 'interactions',
    variables: { personId: id },
    pageSize: PAGE_SIZE_DEFAULTS.interactions,
    fetchPolicy: 'cache-and-network',
  });

  const person = data?.persons?.[0];
  const backLink = (
    <Link href={`/persons/${id}`} asChild>
      <Button
        variant="link"
        size="xs"
        iconSlot={<ArrowLeft />}
        content={person ? `Back to ${fullName(person)}` : 'Back'}
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
        contentSlot={<TimelinePlaceholder error={error} pending={pending} onRetry={() => refetch()} />}
      />
    );
  }

  const interactions: TimelineInteraction[] = (interactionsQuery.data?.interactions ?? []).map((i) => ({
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
      description={fullName(person)}
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
