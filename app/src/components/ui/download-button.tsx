import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Button } from '@/components/ui/button';
import {
  type DownloadButtonProps,
  type DownloadContent,
  type DownloadDestination,
  useDownload,
} from '@/components/ui/download-button-base';
import { Download, Folder, Upload } from '@/components/ui/icons';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';

export type { DownloadButtonProps, DownloadContent, DownloadDestination };

/** A `Blob` read through a data URL, for a runtime whose `Blob` has no `arrayBuffer()`. */
function readAsBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('The file could not be read'));
    reader.onload = () => {
      const encoded = String(reader.result).split(',')[1] ?? '';
      resolve(Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)));
    };
    reader.readAsDataURL(blob);
  });
}

/** What `File.write` takes: text as it is, bytes as a `Uint8Array`. */
async function writable(content: DownloadContent): Promise<string | Uint8Array> {
  if (typeof content === 'string') return content;
  if (typeof content.arrayBuffer === 'function') return new Uint8Array(await content.arrayBuffer());
  return readAsBytes(content);
}

/**
 * Saves `content` as `filename`: to the share sheet, or into a folder the person picks.
 *
 * `share` writes the file to the cache first, because the share sheet shares a file that exists
 * and not bytes in memory; the cache is the system's to clear. `files` writes straight into the
 * picked folder.
 */
export async function downloadBlob(
  content: DownloadContent,
  filename: string,
  {
    mimeType = 'text/plain',
    destination = 'share',
  }: {
    mimeType?: string | undefined;
    destination?: Exclude<DownloadDestination, 'ask'> | undefined;
  } = {},
): Promise<void> {
  const type = typeof content === 'string' ? mimeType : content.type || mimeType;
  const data = await writable(content);

  if (destination === 'files') {
    const folder = await Directory.pickDirectoryAsync();
    folder.createFile(filename, type).write(data);
    return;
  }

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(data);
  await Sharing.shareAsync(file.uri, { mimeType: type, dialogTitle: filename });
}

export function DownloadButton({
  source,
  filename,
  mimeType,
  label = 'Download',
  variant = 'outline',
  size = 'icon-sm',
  destination = 'ask',
  disabled,
  onDownloaded,
  onError,
  className,
}: DownloadButtonProps) {
  const { pending, download } = useDownload({ source, onDownloaded, onError });

  const save = (to: Exclude<DownloadDestination, 'ask'>) =>
    void download((content) => downloadBlob(content, filename, { mimeType, destination: to }));

  const button = (
    <Button
      data-slot="download-button"
      variant={variant}
      size={size}
      aria-label={label}
      loading={pending}
      disabled={disabled}
      className={className}
      {...(destination === 'ask' ? {} : { onPress: () => save(destination) })}
      iconSlot={<Download aria-hidden />}
    />
  );

  if (destination !== 'ask') return button;

  return (
    <Menu>
      <MenuTrigger asChild>{button}</MenuTrigger>
      <MenuContent aria-label={label}>
        <MenuItem iconSlot={<Upload />} label="Share…" onSelect={() => save('share')} />
        <MenuItem iconSlot={<Folder />} label="Save to a folder" onSelect={() => save('files')} />
      </MenuContent>
    </Menu>
  );
}
