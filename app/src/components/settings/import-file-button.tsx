import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { ImportFileButtonProps } from '@/components/settings/import-file-button-base';
import { Button } from '@/components/ui/button';
import { acceptsFile } from '@/components/ui/file-picker-base';
import { Upload } from '@/components/ui/icons';

/** Every kind of file. Android names a `.vcf` or a `.csv` by several MIME types, so the name is checked instead. */
const ANY_FILE = '*/*';

/** The button that chooses a file to import. On a device it opens the system's file picker. */
export function ImportFileButton({ label, accept, onPick }: ImportFileButtonProps) {
  const [isPicking, setIsPicking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /** Opens the file picker and hands on the text of the file chosen there. */
  async function pick() {
    setIsPicking(true);
    setProblem(null);
    try {
      const result = await getDocumentAsync({ type: ANY_FILE, copyToCacheDirectory: true });
      const asset = result.assets?.[0];
      if (result.canceled || asset === undefined) {
        return;
      }
      const isWrongKind = acceptsFile(accept, { name: asset.name, type: asset.mimeType ?? '' }) === false;
      if (isWrongKind) {
        setProblem(`${asset.name} is not a file this import reads (${accept}).`);
        return;
      }
      onPick(await new File(asset.uri).text());
    } catch (error) {
      console.error('The file could not be read', error);
      setProblem('The file could not be read.');
    } finally {
      setIsPicking(false);
    }
  }

  return (
    <View className="items-start gap-2">
      <Button
        variant="outline"
        disabled={isPicking}
        iconSlot={<Upload />}
        content={label}
        onPress={() => void pick()}
      />
      {problem === null ? null : <Text className="text-negative text-sm">{problem}</Text>}
    </View>
  );
}
