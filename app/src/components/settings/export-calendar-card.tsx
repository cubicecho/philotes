import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { EmptyState } from '@/components/page';
import { QueryError } from '@/components/query-state';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/components/ui/download-button';
import { Download } from '@/components/ui/icons';
import { PAGE_SIZE_DEFAULTS } from '@/lib/defaults';
import { buildIcsContent } from '@/lib/ics-export';
import { useAllRows } from '@/lib/use-all-rows';

const GET_INTERACTIONS_FOR_EXPORT = graphql(`
  query GetInteractionsForExport($limit: Int!, $offset: Int!) {
    interactions(
      limit: $limit
      offset: $offset
      orderBy: { occurredAt: { direction: asc, priority: 1 }, id: { direction: asc, priority: 2 } }
    ) {
      id
      channel
      occurredAt
      note
      person {
        id
        firstName
        lastName
      }
    }
  }
`);

const GET_IMPORTANT_DATES_FOR_EXPORT = graphql(`
  query GetImportantDatesForExport($limit: Int!, $offset: Int!) {
    importantDates(
      limit: $limit
      offset: $offset
      orderBy: { date: { direction: asc, priority: 1 }, id: { direction: asc, priority: 2 } }
    ) {
      id
      name
      description
      date
      recurrence
      milestoneType
      person {
        id
        firstName
        lastName
      }
    }
  }
`);

export function ExportCalendarCard() {
  const interactionsQuery = useAllRows(GET_INTERACTIONS_FOR_EXPORT, {
    field: 'interactions',
    pageSize: PAGE_SIZE_DEFAULTS.calendarExport,
  });
  const importantDatesQuery = useAllRows(GET_IMPORTANT_DATES_FOR_EXPORT, {
    field: 'importantDates',
    pageSize: PAGE_SIZE_DEFAULTS.calendarExport,
  });
  const interactions = interactionsQuery.data?.interactions ?? [];
  const importantDates = importantDatesQuery.data?.importantDates ?? [];
  const loading = interactionsQuery.loading || importantDatesQuery.loading;
  const error = interactionsQuery.error ?? importantDatesQuery.error;
  const totalCount = interactions.length + importantDates.length;
  const hasEvents = totalCount > 0;
  const isLoaded = loading === false && error === undefined;
  const isExportBlocked = isLoaded === false || hasEvents === false;

  /** Fetches both lists again after a failure. */
  function refetch() {
    void interactionsQuery.refetch();
    void importantDatesQuery.refetch();
  }

  function handleExport() {
    if (hasEvents === false) {
      return;
    }
    void downloadBlob(buildIcsContent({ interactions, importantDates }), 'philotes-events.ics', {
      mimeType: 'text/calendar;charset=utf-8',
    });
  }

  return (
    <Section
      surface="card"
      title="Export Calendar Events"
      description="Download all your interactions and important dates as an ICS file. You can import this into Google Calendar, Apple Calendar, Outlook, or any other calendar application."
      contentSlot={
        <View className="items-start gap-3">
          {error ? <QueryError compact error={error} onRetry={() => refetch()} what="your events" /> : null}
          <Button
            iconSlot={<Download />}
            content={loading ? 'Loading…' : `Export ${totalCount} Events as ICS`}
            disabled={isExportBlocked}
            onPress={handleExport}
          />
          {isLoaded && hasEvents ? (
            <Text className="text-foreground/60 text-sm">
              {`${interactions.length} interactions · ${importantDates.length} important dates`}
            </Text>
          ) : null}
          {isLoaded && hasEvents === false ? <EmptyState compact title="No events to export yet." /> : null}
        </View>
      }
    />
  );
}
