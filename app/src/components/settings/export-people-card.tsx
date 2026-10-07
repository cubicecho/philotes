import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { QueryError } from '@/components/query-state';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/components/ui/download-button';
import { Download } from '@/components/ui/icons';
import { buildPersonsCsv } from '@/lib/csv-export';
import { PAGE_SIZE_DEFAULTS } from '@/lib/defaults';
import { useAllRows } from '@/lib/use-all-rows';

const GET_EXPORT_PERSONS = graphql(`
  query ExportPersons($limit: Int!, $offset: Int!) {
    persons(
      limit: $limit
      offset: $offset
      orderBy: {
        lastName: { direction: asc, priority: 1 }
        firstName: { direction: asc, priority: 2 }
        id: { direction: asc, priority: 3 }
      }
    ) {
      id
      firstName
      lastName
      email
      contactInfos(limit: 20) {
        type
        label
        value
        isPrimary
      }
      addresses(limit: 10) {
        type
        label
        line1
        line2
        city
        state
        postalCode
        country
      }
      importantDates(where: { name: { eq: "Birthday" } }, limit: 5) {
        name
        date
        recurrence
      }
      labels(limit: 20) {
        id
        label
        color
      }
    }
  }
`);

export function ExportPeopleCard() {
  const {
    data: exportData,
    loading: exportLoading,
    error: exportError,
    refetch,
  } = useAllRows(GET_EXPORT_PERSONS, {
    field: 'persons',
    pageSize: PAGE_SIZE_DEFAULTS.peopleExport,
  });

  function handleExportPeople() {
    if (!exportData?.persons?.length) {
      return;
    }
    void downloadBlob(buildPersonsCsv(exportData.persons), 'philotes-contacts.csv', {
      mimeType: 'text/csv;charset=utf-8',
    });
  }

  return (
    <Section
      surface="card"
      title="Export People"
      description="Download all your contacts as a CSV file compatible with Google Contacts, Apple Contacts, and other applications."
      contentSlot={
        <View className="items-start gap-3">
          {exportError ? <QueryError compact error={exportError} onRetry={() => refetch()} what="your people" /> : null}
          <Button
            iconSlot={<Download />}
            content={exportLoading ? 'Loading…' : `Export ${exportData?.persons?.length ?? 0} People as CSV`}
            disabled={exportLoading || exportError !== undefined || !exportData?.persons?.length}
            onPress={handleExportPeople}
          />
        </View>
      }
    />
  );
}
