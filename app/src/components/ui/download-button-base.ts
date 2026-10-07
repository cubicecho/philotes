import type { ComponentProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Button } from '@/components/ui/button';

type ButtonProps = ComponentProps<typeof Button>;

/** What a file is made of: bytes, or text. */
export type DownloadContent = Blob | string;

/**
 * Where a file goes on device.
 *
 * - `share` opens the system share sheet, which on iOS includes *Save to Files*.
 * - `files` asks for a folder and writes the file into it.
 * - `ask` lets the person holding the phone choose between the two, from a menu on the button.
 */
export type DownloadDestination = 'ask' | 'share' | 'files';

export type DownloadButtonProps = {
  /**
   * The file's content, or a function that fetches it. A function is called on the press and
   * not before, so a list of fifty rows fetches nothing until one is asked for.
   */
  source: DownloadContent | (() => DownloadContent | Promise<DownloadContent>);
  /** The name the file is saved under, extension included: `note.md`. */
  filename: string;
  /** The type of a `source` that is a string. A `Blob` carries its own. The default is `text/plain`. */
  mimeType?: string | undefined;
  /**
   * The accessible name: say what is downloaded when the screen has more than one thing that
   * could be — "Download note.md". The default is `Download`.
   */
  label?: string | undefined;
  /** The button's variant. The default is `outline`. */
  variant?: ButtonProps['variant'] | undefined;
  /** The button's size. The default is `icon-sm`, which sits flush in a row of small text. */
  size?: ButtonProps['size'] | undefined;
  /**
   * Device only: where the file goes. The default is `ask`, which leaves it to the person
   * pressing. The browser has one answer, its own downloads, and ignores this.
   */
  destination?: DownloadDestination | undefined;
  disabled?: boolean | undefined;
  /** Called once the file has been handed over — a toast, an analytics event. */
  onDownloaded?: (() => void) | undefined;
  /**
   * Called when `source` threw or the platform refused the file. The button holds no toasts, so
   * this is where the caller says so.
   */
  onError?: ((error: unknown) => void) | undefined;
  /** The button's class. */
  className?: string | undefined;
};

/**
 * Resolves `source` and hands it to a writer, holding `pending` for as long as both take.
 *
 * A second press while one is pending does nothing, and nothing is set after an unmount — the
 * fetch is async, so the button can be gone by the time it lands.
 */
export function useDownload({
  source,
  onDownloaded,
  onError,
}: Pick<DownloadButtonProps, 'source' | 'onDownloaded' | 'onError'>) {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const download = useCallback(
    async (write: (content: DownloadContent) => Promise<void>) => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      try {
        await write(typeof source === 'function' ? await source() : source);
        onDownloaded?.();
      } catch (error) {
        onError?.(error);
      } finally {
        busy.current = false;
        if (mounted.current) setPending(false);
      }
    },
    [source, onDownloaded, onError],
  );

  return { pending, download };
}
