import { Button } from '@/components/ui/button';
import {
  type DownloadButtonProps,
  type DownloadContent,
  type DownloadDestination,
  useDownload,
} from '@/components/ui/download-button-base';
import { Download } from '@/components/ui/icons';

export type { DownloadButtonProps, DownloadContent, DownloadDestination };

/**
 * Saves `content` as `filename`, through the browser's downloads.
 *
 * The object URL is revoked on the next task rather than straight after the click: the click
 * only *starts* the download, and a URL revoked in the same breath is one some browsers have not
 * read yet, which saves an empty file.
 */
export async function downloadBlob(
  content: DownloadContent,
  filename: string,
  { mimeType = 'text/plain' }: { mimeType?: string | undefined } = {},
): Promise<void> {
  const blob = typeof content === 'string' ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function DownloadButton({
  source,
  filename,
  mimeType,
  label = 'Download',
  variant = 'outline',
  size = 'icon-sm',
  disabled,
  onDownloaded,
  onError,
  className,
}: DownloadButtonProps) {
  const { pending, download } = useDownload({ source, onDownloaded, onError });

  return (
    <Button
      data-slot="download-button"
      variant={variant}
      size={size}
      aria-label={label}
      loading={pending}
      disabled={disabled}
      className={className}
      onPress={() => void download((content) => downloadBlob(content, filename, { mimeType }))}
      iconSlot={<Download aria-hidden />}
    />
  );
}
