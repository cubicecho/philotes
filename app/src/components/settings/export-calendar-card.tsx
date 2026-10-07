import { gql, useQuery } from '@apollo/client';
import { Text, View } from 'react-native';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/components/ui/download-button';
import { Download } from '@/components/ui/icons';
import { buildIcsContent, type CalendarEventsData } from '@/lib/ics-export';

const GET_ALL_EVENTS_FOR_EXPORT = gql`
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
`;

export function ExportCalendarCard() {
  const { data, loading, error } = useQuery<CalendarEventsData>(GET_ALL_EVENTS_FOR_EXPORT);

  const totalCount = (data?.interactions?.length ?? 0) + (data?.importantDates?.length ?? 0);

  function handleExport() {
    if (!data) return;
    void downloadBlob(buildIcsContent(data), 'philotes-events.ics', { mimeType: 'text/calendar;charset=utf-8' });
  }

  return (
    <Section
      surface="card"
      title="Export Calendar Events"
      description="Download all your interactions and important dates as an ICS file. You can import this into Google Calendar, Apple Calendar, Outlook, or any other calendar application."
      contentSlot={
        <View className="items-start gap-3">
          {error ? <Text className="text-destructive text-sm">{`Failed to load events: ${error.message}`}</Text> : null}
          <Button
            iconSlot={<Download />}
            content={loading ? 'Loading…' : `Export ${totalCount} Events as ICS`}
            disabled={loading || !!error || totalCount === 0}
            onPress={handleExport}
          />
          {!loading && !error && totalCount > 0 ? (
            <Text className="text-muted-foreground text-sm">
              {`${data?.interactions?.length ?? 0} interactions · ${data?.importantDates?.length ?? 0} important dates`}
            </Text>
          ) : null}
          {!loading && !error && totalCount === 0 ? (
            <Text className="text-muted-foreground text-sm">No events to export yet.</Text>
          ) : null}
        </View>
      }
    />
  );
}
