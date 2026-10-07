import { useQuery } from '@apollo/client';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { EmptyState } from '@/components/page';
import { QueryError } from '@/components/query-state';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/components/ui/download-button';
import { Download } from '@/components/ui/icons';
import { buildIcsContent } from '@/lib/ics-export';

const GET_ALL_EVENTS_FOR_EXPORT = graphql(`
  query GetAllEventsForExport {
    interactions {
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
    importantDates {
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
  const { data, loading, error, refetch } = useQuery(GET_ALL_EVENTS_FOR_EXPORT);

  const totalCount = (data?.interactions?.length ?? 0) + (data?.importantDates?.length ?? 0);

  function handleExport() {
    if (!data) {
      return;
    }
    void downloadBlob(buildIcsContent(data), 'philotes-events.ics', { mimeType: 'text/calendar;charset=utf-8' });
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
            disabled={loading || error !== undefined || totalCount === 0}
            onPress={handleExport}
          />
          {!loading && !error && totalCount > 0 ? (
            <Text className="text-foreground/60 text-sm">
              {`${data?.interactions?.length ?? 0} interactions · ${data?.importantDates?.length ?? 0} important dates`}
            </Text>
          ) : null}
          {!loading && !error && totalCount === 0 ? <EmptyState compact title="No events to export yet." /> : null}
        </View>
      }
    />
  );
}
