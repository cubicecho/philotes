import { useQuery } from '@apollo/client';
import { Link, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { GET_PERSON_INTERACTIONS } from '@/components/domain/person/person-queries';
import {
  PersonTimeline,
  type TimelineImportantDate,
  type TimelineInteraction,
} from '@/components/domain/person/timeline';
import { LoadState } from '@/components/load-state';
import { PageLayout } from '@/components/page-layout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock } from '@/components/ui/icons';
import { PAGE_SIZE_DEFAULTS } from '@/lib/defaults';
import { personName } from '@/lib/person-name';
import { useAllRows } from '@/lib/use-all-rows';

const GET_PERSON_TIMELINE = graphql(`
  query GetPersonTimeline($id: UUID!) {
    persons(where: { id: { eq: $id } }, limit: 1) {
      id
      displayName
      importantDates(limit: 100) {
        id
        date
        hasYear
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

/** One person's timeline page: their interactions and important dates on one timeline. */
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
        content={person ? `Back to ${personName(person)}` : 'Back'}
      />
    </Link>
  );

  if (!person) {
    const pending = loading && !error;
    return (
      <PageLayout
        title="Timeline"
        iconSlot={<Clock />}
        backSlot={backLink}
        contentSlot={
          <LoadState
            query={{ isPending: pending, isError: error !== undefined, error, refetch }}
            what="the timeline"
            record={person}
            notFoundLabel="Person not found."
            level={2}
          />
        }
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

  // A date without a year has no moment to stand at on a timeline.
  const datedImportantDates = (person.importantDates ?? []).filter((d) => d.hasYear);
  const importantDates: TimelineImportantDate[] = datedImportantDates.map((d) => ({
    id: d.id,
    date: d.date instanceof Date ? d.date : new Date(d.date),
    name: d.name,
    milestoneType: d.milestoneType,
    labels: d.labels ?? [],
  }));

  return (
    <PageLayout
      title="Timeline"
      description={personName(person)}
      iconSlot={<Clock />}
      backSlot={backLink}
      contentSlot={
        <View className="py-4">
          <PersonTimeline interactions={interactions} importantDates={importantDates} />
        </View>
      }
    />
  );
}
