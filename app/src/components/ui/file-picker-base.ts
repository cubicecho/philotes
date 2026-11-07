import type { ButtonProps } from "@/components/ui/button";
import type { SlotNode } from "@/lib/utils";

/**
 * One picked file. Plain data rather than the DOM's `File`, which native does
 * not have: a string, a `Uint8Array` and a `Blob` exist on both platforms.
 */
export type PickedFile = {
  name: string;
  /**
   * Where the file sits inside a picked folder, the folder's own name first:
   * `my-skill/assets/logo.png`. Outside a folder pick it is `name`.
   */
  path: string;
  /** The MIME type, when the platform knows it; `""` when it does not. */
  type: string;
  /**
   * How many bytes the file is on disk. Known without reading it, so it is there
   * whatever `read` is — which is what lets "too large" be said before the read.
   */
  size: number;
  /** The file decoded as text. `""` unless `read` is `"text"`: the other two decode nothing. */
  text: string;
  /** The file as it is on disk. Only there when `read` is `"bytes"`. */
  bytes?: Uint8Array;
  /**
   * A handle on the file, unread. Only there when `read` is `"none"`. In a
   * browser it is the `File` the input gave — a `Blob` the browser streams from
   * disk, so `XMLHttpRequest.send(blob)` or `fetch(url, { body: blob })` uploads
   * a file of any size without holding it; on device it is what
   * `fetch(uri).blob()` gives.
   */
  blob?: Blob;
};

type FilePickerCommonProps = {
  /**
   * e.g. `"application/json,.json"`. Advisory on the dialog, which lets the user
   * pick "All files", so the web half also applies it to what comes back — to a
   * pick and to a drop alike. A file that does not match is skipped, never read.
   */
  accept?: string | undefined;
  /**
   * Take several files per pick: the dialog allows a multi-select and a drop
   * keeps every file, a dropped folder's included. Off, a pick is one file and
   * a drop keeps the first one `accept` allows.
   */
  multiple?: boolean | undefined;
  /**
   * What to read from each file. `text` (the default) decodes it, which is right
   * for JSON or Markdown and corrupts a `.zip` or an image. `bytes` hands back
   * the file undecoded as `bytes`, and leaves `text` empty. `none` reads nothing
   * at all and hands back a `blob` to read or upload later — for a file too big
   * to hold in memory, or one to refuse by its `size` first.
   *
   * `onPick` only ever carries text and a name, so take `bytes` or `none` with
   * `onPickMany`.
   */
  read?: "text" | "bytes" | "none" | undefined;
  /**
   * Make the dialog choose a folder instead of files, and take everything under
   * it, each file reporting where it sat as its `path`. A folder is several
   * files, so every one `accept` allows is kept whether or not `multiple` is
   * set — and since only `onPickMany` carries a `path`, that is the callback to
   * give. Web only.
   *
   * A drop does not need it: a folder dropped on any picker is walked the same
   * way, so a files zone also takes a folder. Without `directory` that drop
   * follows `multiple`, like a drop of files.
   */
  directory?: boolean | undefined;
  /** What is being picked. On the zone it is the visible heading; on the button, the accessible name. */
  label: string;
};

/**
 * One of `onPick` and `onPickMany` is required, and both may be given.
 * `onPickMany` wins when it is there; `onPick` alone is called once per file, so
 * a caller that handles files one at a time needs nothing new to take several.
 */
type FilePickerCallbacks =
  | {
      /**
       * Handed the picked file's decoded text, never the `File` object itself.
       * `File` is DOM-only, so a contract carrying one could not be implemented on
       * native. A screen that wants the bytes, the type or the path takes
       * `onPickMany`, whose `PickedFile` has them. With `multiple` and no
       * `onPickMany`, called once per file, in pick order.
       */
      onPick: (text: string, fileName: string) => void;
      /**
       * Called once per pick with every file in it, in pick order — one file
       * without `multiple`. Given, `onPick` is not called at all.
       */
      onPickMany?: ((files: PickedFile[]) => void) | undefined;
    }
  | {
      onPick?: ((text: string, fileName: string) => void) | undefined;
      onPickMany: (files: PickedFile[]) => void;
    };

export type FilePickerProps = FilePickerCommonProps &
  FilePickerCallbacks & {
    /** The zone's second line, under `label`: what to drop, or where it goes. */
    hint?: string | undefined;
  };

/**
 * The same picker as a `Button`, for where a drop zone does not fit — a page
 * header's actions, a toolbar. It still takes a drop onto itself.
 *
 * A component of its own rather than a `variant="button"` on `FilePicker`,
 * because `variant` and `size` are the `Button`'s, forwarded as they are, and a
 * prop cannot mean both the button's look and which of two shapes to draw.
 */
export type FilePickerButtonProps = FilePickerCommonProps &
  FilePickerCallbacks &
  Pick<ButtonProps, "variant" | "size"> & {
    /**
     * Drawn before the label, or alone at an `icon*` size, where `label` is only
     * the accessible name. Pass a bare `<Upload />`; the button sizes and
     * colours it. Defaults to the upload icon.
     */
    iconSlot?: SlotNode | undefined;
    className?: string | undefined;
  };

/**
 * Whether `file` is one `accept` allows, by the rules the `<input accept>`
 * attribute uses: `.ext` matches the name's ending, `type/*` the MIME type's
 * first half, and anything else the whole MIME type — all ignoring case. An
 * empty or absent `accept` allows everything.
 *
 * Here rather than in the web half so the rule has one home. It takes a name
 * and a type rather than a `File`, which native does not have.
 */
export function acceptsFile(accept: string | undefined, file: { name: string; type: string }) {
  const tokens = (accept ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith(".")) {
      return name.endsWith(token);
    }
    if (token.endsWith("/*")) {
      return type.startsWith(token.slice(0, -1));
    }
    return type === token;
  });
}

/** The drop zone's box. The web half swaps its edge for `border-active` while a file is dragged over it. */
export const FILE_PICKER_ZONE_CLASS =
  "w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-foreground/50 px-6 py-12";
/** The upload icon in the drop zone. */
export const FILE_PICKER_ICON_CLASS = "h-8 w-8 text-foreground/60";
/** The drop zone's label. */
export const FILE_PICKER_TITLE_CLASS = "text-center text-sm font-semibold text-foreground";
/** The line under the label. */
export const FILE_PICKER_HINT_CLASS = "text-center text-xs text-foreground/60";
