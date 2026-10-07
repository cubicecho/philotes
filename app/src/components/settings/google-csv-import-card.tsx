import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FilePickerButton } from '@/components/ui/file-picker';
import { Upload } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/spinner';
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

type ImportState =
  | { stage: 'idle' }
  | { stage: 'preview'; contactCount: number; firstFiveNames: string[]; rawCsv: string }
  | { stage: 'importing' }
  | { stage: 'done'; imported: number; merged: number; skipped: number; errors: string[] }
  | { stage: 'error'; message: string };

export function GoogleCsvImportCard() {
  const [importState, setImportState] = useState<ImportState>({ stage: 'idle' });

  const [importContacts] = useMutation(IMPORT_GOOGLE_CONTACTS, {
    update: (cache) => invalidateQueryFields(cache, ['persons', 'labels']),
  });

  function handlePick(text: string) {
    // Quick preview: count non-empty non-header lines for an estimate
    const lines = text.split(/\r?\n|\r/).filter((l) => l.trim().length > 0);
    const dataLines = Math.max(0, lines.length - 1); // subtract header row

    // Get first 5 names from raw lines for preview (best-effort, unquoted)
    const firstFiveNames = lines.slice(1, 6).map((line) => {
      const firstComma = line.indexOf(',');
      const secondComma = line.indexOf(',', firstComma + 1);
      const first = line.slice(0, firstComma).replace(/^"|"$/g, '').trim();
      const last =
        firstComma !== -1 && secondComma !== -1
          ? line
              .slice(firstComma + 1, secondComma)
              .replace(/^"|"$/g, '')
              .trim()
          : '';
      return [first, last].filter(Boolean).join(' ') || '(unknown)';
    });

    setImportState({
      stage: 'preview',
      contactCount: dataLines,
      firstFiveNames,
      rawCsv: text,
    });
  }

  async function handleImport() {
    if (importState.stage !== 'preview' || !importState.rawCsv) {
      return;
    }

    setImportState({ stage: 'importing' });

    try {
      const result = await importContacts({ variables: { csv: importState.rawCsv } });

      if (result.errors?.length) {
        setImportState({
          stage: 'error',
          message: result.errors.map((e) => e.message).join('; '),
        });
        return;
      }

      const summary = result.data?.importGoogleContacts;
      if (!summary) {
        setImportState({ stage: 'error', message: 'Unknown error' });
        return;
      }
      setImportState({ stage: 'done', ...summary });
    } catch (err) {
      setImportState({
        stage: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return (
    <Section
      surface="card"
      title="Import from Google Contacts"
      description="Upload a CSV export from Google Contacts to import your contacts into Philotes. Contacts without an email address will be skipped."
      contentSlot={
        <View className="items-start gap-3">
          {importState.stage === 'idle' ? (
            <FilePickerButton variant="outline" label="Choose CSV File" accept=".csv" onPick={handlePick} />
          ) : null}

          {importState.stage === 'preview' ? (
            <>
              <Text className="text-foreground/60 text-sm">
                {`Ready to import approximately ${importState.contactCount} contacts.`}
              </Text>
              {importState.firstFiveNames.length > 0 ? (
                <View className="gap-1">
                  {importState.firstFiveNames.map((name, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static preview list
                    <Text key={i} className="text-foreground/60 text-sm">{`• ${name}`}</Text>
                  ))}
                  {importState.contactCount > 5 ? (
                    <Text className="text-foreground/60 text-sm">{`…and ${importState.contactCount - 5} more`}</Text>
                  ) : null}
                </View>
              ) : null}
              <Button iconSlot={<Upload />} content="Import Contacts" onPress={handleImport} />
            </>
          ) : null}

          {importState.stage === 'importing' ? (
            <View className="flex-row items-center gap-2">
              <Spinner label="Importing" />
              <Text className="text-foreground/60 text-sm">Importing…</Text>
            </View>
          ) : null}

          {importState.stage === 'done' ? (
            <>
              <Text className="text-positive text-sm">
                {`✓ ${importState.imported} contacts imported${
                  importState.merged > 0 ? `, ${importState.merged} merged` : ''
                }${importState.skipped > 0 ? `, ${importState.skipped} skipped` : ''}`}
              </Text>
              {importState.errors.length > 0 ? (
                <View className="gap-0.5">
                  {importState.errors.map((e, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static error list
                    <Text key={i} className="text-negative text-sm">
                      {e}
                    </Text>
                  ))}
                </View>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                content="Import Another File"
                onPress={() => setImportState({ stage: 'idle' })}
              />
            </>
          ) : null}

          {importState.stage === 'error' ? (
            <Alert
              className="self-stretch"
              variant="destructive"
              title={`Import failed: ${importState.message}`}
              actionSlot={
                <Button variant="outline" content="Try Again" onPress={() => setImportState({ stage: 'idle' })} />
              }
            />
          ) : null}
        </View>
      }
    />
  );
}
