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
import { CONTACT_IMPORT_DEFAULTS } from '@/lib/defaults';
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

/** Where an import stands, from choosing the file to its result. */
const ImportStage = {
  Idle: 'idle',
  Preview: 'preview',
  Importing: 'importing',
  Done: 'done',
  Error: 'error',
} as const;

/** The stage an import is at, with what that stage has to show. */
type ImportState =
  | { stage: typeof ImportStage.Idle }
  | { stage: typeof ImportStage.Preview; contactCount: number; previewNames: string[]; rawCsv: string }
  | { stage: typeof ImportStage.Importing }
  | { stage: typeof ImportStage.Done; imported: number; merged: number; skipped: number; errors: string[] }
  | { stage: typeof ImportStage.Error; message: string };

/** How many names the preview lists before the import is confirmed. */
const { previewNames: previewNameCount } = CONTACT_IMPORT_DEFAULTS;

/**
 * The settings card that imports a Google Contacts CSV: choose the file, check a rough preview, import, read the
 * result.
 */
export function GoogleCsvImportCard() {
  const [importState, setImportState] = useState<ImportState>({ stage: ImportStage.Idle });

  const [importContacts] = useMutation(IMPORT_GOOGLE_CONTACTS, {
    update: (cache) => invalidateQueryFields(cache, ['persons', 'labels']),
  });

  function handlePick(text: string) {
    // Quick preview: count non-empty non-header lines for an estimate
    const lines = text.split(/\r?\n|\r/).filter((l) => l.trim().length > 0);
    const dataLines = Math.max(0, lines.length - 1); // subtract header row

    // The first names after the header row, read from the raw lines (best-effort, unquoted).
    const previewNames = lines.slice(1, 1 + previewNameCount).map((line) => {
      const firstComma = line.indexOf(',');
      const secondComma = line.indexOf(',', firstComma + 1);
      // A line with no comma is one cell: the whole of it is the first name.
      const firstCell = firstComma === -1 ? line : line.slice(0, firstComma);
      const first = firstCell.replace(/^"|"$/g, '').trim();
      const hasBothCommas = firstComma !== -1 && secondComma !== -1;
      const last = hasBothCommas
        ? line
            .slice(firstComma + 1, secondComma)
            .replace(/^"|"$/g, '')
            .trim()
        : '';
      return [first, last].filter(Boolean).join(' ') || '(unknown)';
    });

    setImportState({
      stage: ImportStage.Preview,
      contactCount: dataLines,
      previewNames,
      rawCsv: text,
    });
  }

  async function handleImport() {
    if (importState.stage !== ImportStage.Preview) {
      return;
    }
    const { rawCsv } = importState;
    if (!rawCsv) {
      return;
    }

    setImportState({ stage: ImportStage.Importing });

    try {
      const result = await importContacts({ variables: { csv: rawCsv } });

      if (result.errors?.length) {
        setImportState({
          stage: ImportStage.Error,
          message: result.errors.map((e) => e.message).join('; '),
        });
        return;
      }

      const summary = result.data?.importGoogleContacts;
      if (!summary) {
        setImportState({ stage: ImportStage.Error, message: 'Unknown error' });
        return;
      }
      setImportState({ stage: ImportStage.Done, ...summary });
    } catch (err) {
      setImportState({
        stage: ImportStage.Error,
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
          {importState.stage === ImportStage.Idle ? (
            <FilePickerButton variant="outline" label="Choose CSV File" accept=".csv" onPick={handlePick} />
          ) : null}

          {importState.stage === ImportStage.Preview ? (
            <>
              <Text className="text-foreground/60 text-sm">
                {`Ready to import approximately ${importState.contactCount} contacts.`}
              </Text>
              {importState.previewNames.length > 0 ? (
                <View className="gap-1">
                  {importState.previewNames.map((name, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: two contacts can share a name, and the list is never reordered
                    <Text key={i} className="text-foreground/60 text-sm">{`• ${name}`}</Text>
                  ))}
                  {importState.contactCount > previewNameCount ? (
                    <Text className="text-foreground/60 text-sm">{`…and ${importState.contactCount - previewNameCount} more`}</Text>
                  ) : null}
                </View>
              ) : null}
              <Button iconSlot={<Upload />} content="Import Contacts" onPress={handleImport} />
            </>
          ) : null}

          {importState.stage === ImportStage.Importing ? (
            <View className="flex-row items-center gap-2">
              <Spinner label="Importing" />
              <Text className="text-foreground/60 text-sm">Importing…</Text>
            </View>
          ) : null}

          {importState.stage === ImportStage.Done ? (
            <>
              <Text className="text-positive text-sm">
                {`✓ ${importState.imported} contacts imported${
                  importState.merged > 0 ? `, ${importState.merged} merged` : ''
                }${importState.skipped > 0 ? `, ${importState.skipped} skipped` : ''}`}
              </Text>
              {importState.errors.length > 0 ? (
                <View className="gap-0.5">
                  {importState.errors.map((e, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the same error can repeat, and the list is never reordered
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
                onPress={() => setImportState({ stage: ImportStage.Idle })}
              />
            </>
          ) : null}

          {importState.stage === ImportStage.Error ? (
            <Alert
              className="self-stretch"
              variant="destructive"
              title={`Import failed: ${importState.message}`}
              actionSlot={
                <Button
                  variant="outline"
                  content="Try Again"
                  onPress={() => setImportState({ stage: ImportStage.Idle })}
                />
              }
            />
          ) : null}
        </View>
      }
    />
  );
}
