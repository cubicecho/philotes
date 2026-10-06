import { gql, useQuery } from '@apollo/client';
import { Text, View } from 'react-native';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/components/ui/download-button';
import { Download } from '@/components/ui/icons';
import { buildPersonsCsv, type ExportPerson } from '@/lib/csv-export';

const GET_EXPORT_PERSONS = gql`
  query ExportPersons {
    persons(
      orderBy: {
        lastName: { direction: asc, priority: 1 }
        firstName: { direction: asc, priority: 2 }
      }
    ) {
      id
      firstName
      lastName
      email
      contactInfos {
        type
        label
        value
        isPrimary
      }
      addresses {
        type
        label
        line1
        line2
        city
        state
        postalCode
        country
      }
      importantDates(where: { name: { eq: "Birthday" } }) {
        name
        date
        recurrence
      }
      labels {
        id
        label
        color
      }
    }
  }
`;

interface ExportPersonsQueryResult {
  persons: ExportPerson[];
}

export function ExportPeopleCard() {
  const {
    data: exportData,
    loading: exportLoading,
    error: exportError,
  } = useQuery<ExportPersonsQueryResult>(GET_EXPORT_PERSONS);

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
          {exportError ? (
            <Text className="text-destructive text-sm">{`Failed to load people: ${exportError.message}`}</Text>
          ) : null}
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
