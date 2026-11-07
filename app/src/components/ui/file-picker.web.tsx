import { type DragEvent, type ReactNode, useRef, useState } from "react";
import { Text } from "react-native";
import { buttonTextVariants, buttonVariants } from "@/components/ui/button";
import {
  acceptsFile,
  FILE_PICKER_HINT_CLASS,
  FILE_PICKER_ICON_CLASS,
  FILE_PICKER_TITLE_CLASS,
  FILE_PICKER_ZONE_CLASS,
  type FilePickerButtonProps,
  type FilePickerProps,
  type PickedFile,
} from "@/components/ui/file-picker-base";
import { Upload } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type PickOptions = Pick<
  FilePickerProps,
  "onPick" | "onPickMany" | "accept" | "multiple" | "read" | "directory"
>;

/** A file and where it sat in the folder it came from. */
type Found = { file: File; path: string };

/**
 * What makes the dialog choose a folder. Spread onto the input rather than
 * written as a prop because React's typings do not know the attribute, and as a
 * string because React drops an unknown attribute whose value is `true`.
 */
const DIRECTORY_INPUT: Record<string, string> = { webkitdirectory: "" };

/**
 * A pick from the dialog. In a folder pick the browser fills
 * `webkitRelativePath` — the folder's own name first — and leaves it empty
 * otherwise, which is the `path` rule: the place in the folder, or the name.
 */
function fromList(list: FileList | null | undefined): Found[] {
  return Array.from(list ?? [], (file) => ({ file, path: file.webkitRelativePath || file.name }));
}

/**
 * Everything under the dropped entries, depth first, in the order the browser
 * lists them. A dropped folder arrives in `dataTransfer.files` as one
 * unreadable `File` with no children, so the tree has to be walked through its
 * entries. An entry's `fullPath` starts with a slash and then matches what the
 * dialog would report, so a drop and a pick give the same `path`.
 */
async function walk(entries: FileSystemEntry[]): Promise<Found[]> {
  const found: Found[] = [];
  for (const entry of entries) {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      found.push({ file, path: entry.fullPath.replace(/^\//, "") });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // `readEntries` hands back a batch at a time — a hundred, in Chrome — and
      // an empty one when it is done, so one call would cut a big folder short.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
          reader.readEntries(resolve, reject),
        );
        if (batch.length === 0) {
          break;
        }
        found.push(...(await walk(batch)));
      }
    }
  }
  return found;
}

/**
 * What a drop carries, files and folders alike, in drop order. Issue #400: a
 * dropped folder sits in `dataTransfer.files` as one empty `File`, so a zone
 * without `directory` handed it on and the upload failed on it. Each item is
 * taken as an entry and walked, which yields a dropped file as itself with
 * `path` equal to its name, and a dropped folder as the files under it.
 *
 * The entries and the files are taken before the first `await`, because a
 * drop's items are gone once the event returns. An item with no entry (a
 * browser without the entry API, or a file made in script) is taken as a file.
 */
function fromDrop(data: DataTransfer): Promise<Found[]> {
  const items = Array.from(data.items ?? []).filter((item) => item.kind === "file");
  if (items.length === 0) {
    return Promise.resolve(fromList(data.files));
  }
  const dropped = items.map((item) => item.webkitGetAsEntry?.() ?? item.getAsFile?.() ?? null);
  return (async () => {
    const found: Found[] = [];
    for (const item of dropped) {
      if (item instanceof File) {
        found.push({ file: item, path: item.name });
      } else if (item) {
        found.push(...(await walk([item])));
      }
    }
    return found;
  })();
}

/**
 * The picking, apart from the look: the hidden input, what a click and a drop
 * do, and whether something is being dragged over. The zone and the button are
 * two faces on this one hook, so they cannot disagree about what a pick is.
 */
function useFilePick({ onPick, onPickMany, accept, multiple, read, directory }: PickOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function take(found: Found[]) {
    // `accept` is only advisory on the dialog, ignored by a folder dialog and
    // not applied to a drop at all, so it is applied here, to all three.
    const allowed = found.filter(({ file }) => acceptsFile(accept, file));
    // A folder is every file in it; `multiple` is about picking files.
    const files = multiple || directory ? allowed : allowed.slice(0, 1);
    if (files.length === 0) {
      return;
    }
    const picked = await Promise.all(
      files.map(async ({ file, path }): Promise<PickedFile> => {
        const base = { name: file.name, path, type: file.type, size: file.size };
        // The file itself, unread: the browser streams it from disk when it is sent.
        if (read === "none") {
          return { ...base, text: "", blob: file };
        }
        // One or the other: decoding a `.zip` to hand back a string nobody
        // reads would cost its whole size again.
        return read === "bytes"
          ? { ...base, text: "", bytes: new Uint8Array(await file.arrayBuffer()) }
          : { ...base, text: await file.text() };
      }),
    );
    if (onPickMany) {
      onPickMany(picked);
    } else {
      for (const file of picked) {
        onPick?.(file.text, file.name);
      }
    }
  }

  const trigger = {
    type: "button" as const,
    onClick: () => inputRef.current?.click(),
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      // A folder is walked whether or not `directory` is set: that prop is
      // what the click opens, and a drop can carry files and folders at once.
      void fromDrop(e.dataTransfer).then(take);
    },
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      {...(accept ? { accept } : {})}
      {...(multiple ? { multiple: true } : {})}
      {...(directory ? DIRECTORY_INPUT : {})}
      className="hidden"
      onChange={(e) => {
        // Copied before the value is reset, which empties the input's `FileList`.
        void take(fromList(e.target.files));
        // Allow re-selecting the same file after a reset.
        e.target.value = "";
      }}
    />
  );

  return { trigger, input, dragging };
}

/** A drop zone that picks a file and hands its contents to the caller. */
export function FilePicker({ label, hint, ...options }: FilePickerProps) {
  const { trigger, input, dragging } = useFilePick(options);

  return (
    <>
      <button
        {...trigger}
        className={cn(
          FILE_PICKER_ZONE_CLASS,
          "flex text-center transition-colors focus-visible:bg-hover focus-visible:outline-none",
          dragging ? "border-active bg-active/40" : "hover:border-foreground/60",
        )}
      >
        {/* On the drop tint the muted grey is under 4.5:1, so the hint and icon take full ink. */}
        <Upload className={cn(FILE_PICKER_ICON_CLASS, dragging && "text-foreground")} />
        <Text className={FILE_PICKER_TITLE_CLASS}>{label}</Text>
        {hint ? (
          <Text className={cn(FILE_PICKER_HINT_CLASS, dragging && "text-foreground")}>{hint}</Text>
        ) : null}
      </button>
      {input}
    </>
  );
}

/** A button that picks a file and hands its contents to the caller. */
export function FilePickerButton({
  label,
  iconSlot = <Upload />,
  variant,
  size,
  className,
  ...options
}: FilePickerButtonProps) {
  const { trigger, input, dragging } = useFilePick(options);
  // At an icon size the square has no room for words, so `label` is the name alone.
  const iconOnly = typeof size === "string" && size.startsWith("icon");
  let content: ReactNode = iconSlot;
  if (iconOnly === false) {
    content = (
      <>
        {iconSlot}
        <Text className={buttonTextVariants({ variant, size })}>{label}</Text>
      </>
    );
  }

  return (
    <>
      {/* `buttonVariants` on a plain `<button>` rather than `Button`: in an Expo web app `Button`
          is a `Pressable`, which drops the drag handlers a drop needs. */}
      <button
        {...trigger}
        aria-label={label}
        className={cn(
          buttonVariants({ variant, size }),
          dragging && "ring-2 ring-active ring-offset-2 ring-offset-background",
          className,
        )}
      >
        {content}
      </button>
      {input}
    </>
  );
}
