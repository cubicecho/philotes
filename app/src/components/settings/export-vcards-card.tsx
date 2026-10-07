import { useApolloClient } from '@apollo/client';
import { useState } from 'react';
import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/components/ui/download-button';
import { Download } from '@/components/ui/icons';

const EXPORT_VCARDS = graphql(`
  query ExportVCards {
    exportVCards
  }
`);

const FILE_NAME = 'philotes-contacts.vcf';
const MIME_TYPE = 'text/vcard;charset=utf-8';

/** The settings card that downloads everyone as `philotes-contacts.vcf`. The server writes the file. */
export function ExportVCardsCard() {
  const apollo = useApolloClient();
  const [isExporting, setIsExporting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function handleExport() {
    setIsExporting(true);
    setFailure(null);
    try {
      // Asked for at the press and never cached: the file is as large as the address book.
      const { data } = await apollo.query({ query: EXPORT_VCARDS, fetchPolicy: 'no-cache' });
      if (data.exportVCards.length === 0) {
        setFailure('There is nobody to export yet.');
        return;
      }
      await downloadBlob(data.exportVCards, FILE_NAME, { mimeType: MIME_TYPE });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Section
      surface="card"
      title="Export vCards"
      description="Download all your contacts as a vCard (.vcf) file, which a phone or another contacts app can import. Pictures are left out."
      contentSlot={
        <View className="items-start gap-3">
          {failure !== null ? <Alert className="self-stretch" variant="destructive" title={failure} /> : null}
          <Button
            iconSlot={<Download />}
            content="Export People as vCard"
            loading={isExporting}
            onPress={handleExport}
          />
        </View>
      }
    />
  );
}
