import type { ButtonProps } from '@/components/ui/button';
import type { SlotNode } from '@/lib/utils';

/**
 * One picked file. Plain data rather than the DOM's `File`, which native does
 * not have: a string and a `Uint8Array` exist on both platforms.
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
  /** The file decoded as text. `""` when `read` is `"bytes"`, which decodes nothing. */
  text: string;
  /** The file as it is on disk. Only there when `read` is `"bytes"`. */
  bytes?: Uint8Array;
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
   * keeps every file. Off, a pick is one file and a drop keeps the first one
   * `accept` allows.
   */
  multiple?: boolean | undefined;
  /**
   * What to read from each file. `text` (the default) decodes it, which is right
   * for JSON or Markdown and corrupts a `.zip` or an image. `bytes` hands back
   * the file undecoded as `bytes`, and leaves `text` empty.
   *
   * `onPick` only ever carries text and a name, so take `bytes` with `onPickMany`.
   */
  read?: 'text' | 'bytes' | undefined;
  /**
   * Pick a folder and everything under it instead of files: the dialog chooses
   * a folder, a dropped folder is walked, and each file reports where it sat as
   * its `path`. A folder is several files, so every one `accept` allows is kept
   * whether or not `multiple` is set — and since only `onPickMany` carries a
   * `path`, that is the callback to give. Web only.
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
  Pick<ButtonProps, 'variant' | 'size'> & {
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
  const tokens = (accept ?? '')
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}
