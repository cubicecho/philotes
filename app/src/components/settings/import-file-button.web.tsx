import type { ImportFileButtonProps } from '@/components/settings/import-file-button-base';
import { FilePickerButton } from '@/components/ui/file-picker';

/** The button that chooses a file to import. In a browser it opens the file dialog, and takes a dropped file. */
export function ImportFileButton({ label, accept, onPick }: ImportFileButtonProps) {
  return <FilePickerButton variant="outline" label={label} accept={accept} onPick={onPick} />;
}
