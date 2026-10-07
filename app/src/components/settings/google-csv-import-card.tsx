import { useMutation } from '@apollo/client';
import { graphql } from '@/__generated__/gql';
import { ImportCard, type ImportSummary, summaryOrThrow } from '@/components/settings/import-card';
import { CONTACT_IMPORT_DEFAULTS } from '@/lib/defaults';
import { previewGoogleCsv } from '@/lib/import-preview';
import { invalidateQueryFields } from '@/lib/invalidate';

const IMPORT_GOOGLE_CONTACTS = graphql(`
  mutation ImportGoogleContacts($csv: String!) {
    importGoogleContacts(csv: $csv) {
      imported
      merged
      skipped
      errors
    }
  }
`);

/** The settings card that imports a Google Contacts CSV. */
export function GoogleCsvImportCard() {
  const [importContacts] = useMutation(IMPORT_GOOGLE_CONTACTS, {
    update: (cache) => invalidateQueryFields(cache, ['persons', 'labels']),
  });

  async function handleImport(csv: string): Promise<ImportSummary> {
    const result = await importContacts({ variables: { csv } });
    return summaryOrThrow(result.errors, result.data?.importGoogleContacts);
  }

  return (
    <ImportCard
      title="Import from Google Contacts"
      description="Upload a CSV export from Google Contacts to import your contacts into Philotes. Contacts without an email address will be skipped."
      pickLabel="Choose CSV File"
      accept=".csv"
      preview={(text) => previewGoogleCsv(text, CONTACT_IMPORT_DEFAULTS.previewNames)}
      onImport={handleImport}
    />
  );
}
