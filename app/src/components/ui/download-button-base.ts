import { useCallback, useEffect, useRef, useState } from "react";
import type { ButtonProps } from "@/components/ui/button";

/** What a file is made of: bytes, or text. */
export type DownloadContent = Blob | string;

/**
 * Where a file goes on device.
 *
 * - `share` opens the system share sheet, which on iOS includes *Save to Files*.
 * - `files` asks for a folder and writes the file into it.
 * - `ask` lets the person holding the phone choose between the two, from a menu on the button.
 */
export type DownloadDestination = "ask" | "share" | "files";

/** A file the app holds: the page fetched it, or made it. */
type DownloadFromSource = {
  /**
   * The file's content, or a function that fetches it. A function is called on the press and
   * not before, so a list of fifty rows fetches nothing until one is asked for.
   */
  source: DownloadContent | (() => DownloadContent | Promise<DownloadContent>);
  href?: never;
};

/** A file the platform fetches itself, so it is never held in the app's memory. */
type DownloadFromHref = {
  /**
   * A URL, or a function that asks the server for one on the press — a presigned URL that is
   * minted on demand and expires. The browser streams it to disk with its own progress, and a
   * device downloads it to a file, so this is the one to use for a file too big to hold as a
   * `Blob`.
   *
   * In a browser the `download` attribute is ignored for a URL on another origin: a bucket there
   * has to send `Content-Disposition: attachment` itself, both for the file to save rather than
   * open and for it to get `filename`.
   */
  href: string | (() => string | Promise<string>);
  source?: never;
};

export type DownloadButtonProps = (DownloadFromSource | DownloadFromHref) & {
  /** The name the file is saved under, extension included: `note.md`. */
  filename: string;
  /**
   * The type of a `source` that is a string, and on device of an `href`. A `Blob` carries its
   * own. The default is `text/plain` for a `source`.
   */
  mimeType?: string | undefined;
  /**
   * The accessible name: say what is downloaded when the screen has more than one thing that
   * could be — "Download note.md". The default is `Download`.
   */
  label?: string | undefined;
  /** The button's variant. The default is `outline`. */
  variant?: ButtonProps["variant"] | undefined;
  /** The button's size. The default is `icon-sm`, which sits flush in a row of small text. */
  size?: ButtonProps["size"] | undefined;
  /**
   * Device only: where the file goes. The default is `ask`, which leaves it to the person
   * pressing. The browser has one answer, its own downloads, and ignores this.
   */
  destination?: DownloadDestination | undefined;
  disabled?: boolean | undefined;
  /** Called once the file has been handed over — a toast, an analytics event. */
  onDownloaded?: (() => void) | undefined;
  /**
   * Called when `source` or `href` threw or the platform refused the file. The button holds no toasts, so
   * this is where the caller says so.
   */
  onError?: ((error: unknown) => void) | undefined;
  /** The button's class. */
  className?: string | undefined;
};

/** What each half does with a file: one writer for content it holds, one for a URL. */
export type DownloadWriters = {
  content: (content: DownloadContent) => Promise<void>;
  url: (url: string) => Promise<void>;
};

/**
 * Resolves `source` or `href` and hands it to its writer, holding `pending` for as long as both
 * take.
 *
 * A second press while one is pending does nothing, and nothing is set after an unmount — the
 * fetch is async, so the button can be gone by the time it lands.
 */
export function useDownload({
  source,
  href,
  onDownloaded,
  onError,
}: Pick<DownloadButtonProps, "onDownloaded" | "onError"> & {
  source?: DownloadFromSource["source"] | undefined;
  href?: DownloadFromHref["href"] | undefined;
}) {
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
    async (write: DownloadWriters) => {
      if (busy.current) {
        return;
      }
      busy.current = true;
      setPending(true);
      try {
        if (href !== undefined) {
          await write.url(typeof href === "function" ? await href() : href);
        } else if (source !== undefined) {
          await write.content(typeof source === "function" ? await source() : source);
        }
        onDownloaded?.();
      } catch (error) {
        onError?.(error);
      } finally {
        busy.current = false;
        if (mounted.current) {
          setPending(false);
        }
      }
    },
    [source, href, onDownloaded, onError],
  );

  return { pending, download };
}
