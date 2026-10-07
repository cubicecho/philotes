import { type ApolloError, useQuery } from '@apollo/client';
import { Link, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { CalendarDays } from '@/components/app-icons';
import { LabelChip } from '@/components/domain/label/label-chip';
import { RECURRENCE_OPTIONS } from '@/components/domain/person/important-date-form';
import { GET_PERSON_NOTES } from '@/components/domain/person/person-queries';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { QueryError } from '@/components/query-state';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/spinner';
import { formatDay } from '@/lib/local-date';
import { useAllRows } from '@/lib/use-all-rows';

const GET_DATE_DETAIL = graphql(`
  query GetImportantDateDetail($dateId: UUID!) {
    importantDates(where: { id: { eq: $dateId } }, limit: 1) {
      id
      name
      description
      date
      hasYear
      recurrence
      labels(limit: 10) {
        id
        label
        color
      }
    }
  }
`);

/** What stands in for the page until there is a date: the failure, a spinner, or "not found". */
function DatePlaceholder({
  error,
  loading,
  onRetry,
}: {
  error: ApolloError | undefined;
  loading: boolean;
  onRetry: () => void;
}) {
  if (error) {
    return <QueryError error={error} onRetry={onRetry} what="this date" />;
  }
  if (loading) {
    return <Spinner />;
  }
  return <EmptyState icon={CalendarDays} title="Date not found." />;
}

/** One important date of a person, with that person's notes that share a tag with it. */
export default function ImportantDateDetailPage() {
  const { id: personId, dateId } = useLocalSearchParams<{ id: string; dateId: string }>();

  const { data, loading, error, refetch } = useQuery(GET_DATE_DETAIL, {
    variables: { dateId },
    fetchPolicy: 'cache-and-network',
  });
  const notesQuery = useAllRows(GET_PERSON_NOTES, {
    field: 'notes',
    variables: { personId },
    fetchPolicy: 'cache-and-network',
  });

  const backLink = (
    <Link href={`/persons/${personId}`} asChild>
      <Button variant="link" size="xs" iconSlot={<ArrowLeft />} content="Back to person" />
    </Link>
  );

  const date = data?.importantDates?.[0];
  if (!date) {
    return (
      <PageLayout
        title="Important date"
        iconSlot={<CalendarDays />}
        breadcrumbsSlot={backLink}
        contentSlot={<DatePlaceholder error={error} loading={loading} onRetry={() => refetch()} />}
      />
    );
  }

  const dateLabels = date.labels ?? [];
  const dateLabelIds = new Set(dateLabels.map((l) => l.id));
  const recurrenceLabel = RECURRENCE_OPTIONS.find((o) => o.value === date.recurrence)?.label;

  // Notes that share at least one tag with this date
  const relatedNotes = (notesQuery.data?.notes ?? [])
    .map((note) => ({ id: note.id, body: note.body, labels: note.labels ?? [] }))
    .filter((note) => note.labels.some((l) => dateLabelIds.has(l.id)));

  const dayLabel = formatDay(date.date, date.hasYear);

  return (
    <PageLayout
      title={date.name}
      description={recurrenceLabel ? `${dayLabel} · ${recurrenceLabel}` : dayLabel}
      iconSlot={<CalendarDays />}
      breadcrumbsSlot={backLink}
      contentSlot={
        <View className="gap-6 py-4">
          {date.description ? <Text className="text-foreground/60 text-sm">{date.description}</Text> : null}

          {dateLabels.length > 0 ? (
            <View className="flex-row flex-wrap gap-1.5">
              {dateLabels.map((l) => (
                <LabelChip key={l.id} label={l.label} color={l.color} />
              ))}
            </View>
          ) : null}

          <Section
            surface="card"
            title="Related Notes"
            description="Notes from this person that share at least one tag with this date."
            contentSlot={
              relatedNotes.length === 0 ? (
                <Text className="text-foreground/60 text-sm">
                  {dateLabelIds.size === 0
                    ? 'Add tags to this date to see related notes.'
                    : 'No notes share a tag with this date yet.'}
                </Text>
              ) : (
                <View className="gap-2">
                  {relatedNotes.map((note) => (
                    <View key={note.id} className="gap-1.5 rounded-md border border-foreground/10 px-3 py-2">
                      <Text className="text-foreground text-sm">{note.body}</Text>
                      {note.labels.length > 0 ? (
                        <View className="flex-row flex-wrap gap-1">
                          {note.labels.map((l) => (
                            // The tags this note shares with the date are the reason it is listed; the rest are dimmed.
                            <LabelChip
                              key={l.id}
                              label={l.label}
                              color={l.color}
                              className={dateLabelIds.has(l.id) ? undefined : 'opacity-50'}
                            />
                          ))}
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              )
            }
          />
        </View>
      }
    />
  );
}
