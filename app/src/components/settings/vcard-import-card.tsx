import { useMutation } from '@apollo/client';
import { graphql } from '@/__generated__/gql';
import { ImportCard, type ImportSummary, summaryOrThrow } from '@/components/settings/import-card';
import { CONTACT_IMPORT_DEFAULTS } from '@/lib/defaults';
import { previewVCards } from '@/lib/import-preview';
import { invalidateQueryFields } from '@/lib/invalidate';

const IMPORT_VCARDS = graphql(`
  mutation ImportVCards($vcf: String!) {
    importVCards(vcf: $vcf) {
      imported
      merged
      skipped
      errors
    }
  }
`);

/** The settings card that imports a vCard file, as a phone or another contacts app exports it. */
export function VCardImportCard() {
  const [importVCards] = useMutation(IMPORT_VCARDS, {
    update: (cache) => invalidateQueryFields(cache, ['persons', 'labels']),
  });

  async function handleImport(vcf: string): Promise<ImportSummary> {
    const result = await importVCards({ variables: { vcf } });
    return summaryOrThrow(result.errors, result.data?.importVCards);
  }

  return (
    <ImportCard
      title="Import a vCard File"
      description="Upload a .vcf file exported from your phone, Apple Contacts or another contacts app. A contact you already have is filled in, never overwritten."
      pickLabel="Choose vCard File"
      accept=".vcf,text/vcard"
      preview={(text) => previewVCards(text, CONTACT_IMPORT_DEFAULTS.previewNames)}
      onImport={handleImport}
    />
  );
}
