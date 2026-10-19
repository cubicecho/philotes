import { Button } from "@/components/ui/button";
import {
  type DownloadButtonProps,
  type DownloadContent,
  type DownloadDestination,
  useDownload,
} from "@/components/ui/download-button-base";
import { Download } from "@/components/ui/icons";

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
  { mimeType = "text/plain" }: { mimeType?: string | undefined } = {},
): Promise<void> {
  const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  await downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Saves what `url` serves as `filename`, with no fetch in the page: the browser streams the
 * file to disk itself, so its size never passes through memory.
 *
 * `download` is ignored for a URL on another origin. There the server decides: without
 * `Content-Disposition: attachment` a file the browser can show opens in place of the page.
 */
export async function downloadUrl(url: string, filename: string): Promise<void> {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
}

/** An icon button that saves a file, and shows that it is waiting while the file is fetched. */
export function DownloadButton({
  source,
  href,
  filename,
  mimeType,
  label = "Download",
  variant = "outline",
  size = "icon-sm",
  disabled,
  onDownloaded,
  onError,
  className,
}: DownloadButtonProps) {
  const { pending, download } = useDownload({ source, href, onDownloaded, onError });

  return (
    <Button
      data-slot="download-button"
      variant={variant}
      size={size}
      aria-label={label}
      loading={pending}
      disabled={disabled}
      className={className}
      onPress={() =>
        void download({
          content: (content) => downloadBlob(content, filename, { mimeType }),
          url: (url) => downloadUrl(url, filename),
        })
      }
      iconSlot={<Download aria-hidden />}
    />
  );
}
