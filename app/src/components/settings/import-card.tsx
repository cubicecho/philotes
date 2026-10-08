import { useState } from 'react';
import { Text, View } from 'react-native';
import { Section } from '@/components/section';
import { ImportFileButton } from '@/components/settings/import-file-button';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Upload } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/spinner';
import { CONTACT_IMPORT_DEFAULTS } from '@/lib/defaults';

/** What a contacts import reports once it has run. */
export interface ImportSummary {
  imported: number;
  merged: number;
  skipped: number;
  errors: string[];
}

/** A rough look at a picked file, shown before the import is confirmed. */
export interface ImportPreview {
  /** About how many contacts the file holds. */
  contactCount: number;
  /** The first few names, at most `CONTACT_IMPORT_DEFAULTS.previewNames` of them. */
  names: string[];
}

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
  | { stage: typeof ImportStage.Preview; preview: ImportPreview; text: string }
  | { stage: typeof ImportStage.Importing }
  | ({ stage: typeof ImportStage.Done } & ImportSummary)
  | { stage: typeof ImportStage.Error; message: string };

/** How many names the preview lists before the import is confirmed. */
const { previewNames: previewNameCount } = CONTACT_IMPORT_DEFAULTS;

const UNKNOWN_ERROR = 'Unknown error';

interface ImportCardProps {
  title: string;
  description: string;
  /** The picker button's words, such as "Choose CSV File". */
  pickLabel: string;
  /** The file types the picker offers, such as `.csv`. */
  accept: string;
  /** Reads a rough preview out of the picked file's text. */
  preview: (text: string) => ImportPreview;
  /** Sends the file's text to the server. Throws when the import fails as a whole. */
  onImport: (text: string) => Promise<ImportSummary>;
}

/**
 * A settings card that imports contacts from a file: choose the file, check a rough preview, import, read the
 * result.
 */
export function ImportCard({ title, description, pickLabel, accept, preview, onImport }: ImportCardProps) {
  const [importState, setImportState] = useState<ImportState>({ stage: ImportStage.Idle });

  function handlePick(text: string) {
    setImportState({ stage: ImportStage.Preview, preview: preview(text), text });
  }

  async function handleImport() {
    if (importState.stage !== ImportStage.Preview) {
      return;
    }
    const { text } = importState;
    setImportState({ stage: ImportStage.Importing });

    try {
      const summary = await onImport(text);
      setImportState({ stage: ImportStage.Done, ...summary });
    } catch (err) {
      setImportState({
        stage: ImportStage.Error,
        message: err instanceof Error ? err.message : UNKNOWN_ERROR,
      });
    }
  }

  return (
    <Section
      surface="card"
      title={title}
      description={description}
      contentSlot={
        <View className="items-start gap-3">
          {importState.stage === ImportStage.Idle ? (
            <ImportFileButton label={pickLabel} accept={accept} onPick={handlePick} />
          ) : null}

          {importState.stage === ImportStage.Preview ? (
            <>
              <Text className="text-foreground/60 text-sm">
                {`Ready to import approximately ${importState.preview.contactCount} contacts.`}
              </Text>
              {importState.preview.names.length > 0 ? (
                <View className="gap-1">
                  {importState.preview.names.map((name, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: two contacts can share a name, and the list is never reordered
                    <Text key={i} className="text-foreground/60 text-sm">{`• ${name}`}</Text>
                  ))}
                  {importState.preview.contactCount > previewNameCount ? (
                    <Text className="text-foreground/60 text-sm">{`…and ${importState.preview.contactCount - previewNameCount} more`}</Text>
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

/**
 * Reads the summary out of an import mutation's result, or throws what went wrong.
 *
 * @param errors - The result's GraphQL errors, if any.
 * @param summary - The mutation's payload, when it came back.
 * @returns The summary.
 */
export function summaryOrThrow(
  errors: ReadonlyArray<{ message: string }> | undefined,
  summary: ImportSummary | null | undefined,
): ImportSummary {
  if (errors !== undefined && errors.length > 0) {
    throw new Error(errors.map((error) => error.message).join('; '));
  }
  if (!summary) {
    throw new Error(UNKNOWN_ERROR);
  }
  return summary;
}
