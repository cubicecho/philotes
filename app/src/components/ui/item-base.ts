import { cva } from "class-variance-authority";
import {
  cn,
  HEADING_DESCRIPTION,
  HEADING_GAP,
  HEADING_TITLE,
  HEADING_WRAP_FLOOR,
  HEADING_WRAP_GAP,
} from "@/lib/utils";

/** How an `Item`'s surface is drawn. */
export type ItemVariant = "default" | "outline" | "muted";
/** How much padding an `Item` has. */
export type ItemSize = "default" | "sm";
/** What `ItemMedia` holds, which picks its box. */
export type ItemMediaVariant = "default" | "icon" | "image";

/**
 * The row: its children side by side, wrapping — `ItemHeader` and `ItemFooter` take a line of their
 * own. `outline` is the bordered card-per-row, `muted` a filled one.
 */
export const itemVariants = cva(
  "flex-row flex-wrap items-center rounded-md border border-transparent",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border-foreground/10",
        muted: "bg-foreground/10",
      },
      size: {
        default: "gap-4 p-4",
        // `ListItem`'s row: 12px across and 8px down to the content, and no edge, so a border a
        // caller adds (`border border-foreground/10` for a card per row) goes outside that, as it
        // always did on `ListItem`. A line the row wraps onto is the rhythm's 8px under the last.
        sm: cn("gap-3 border-0 px-3 py-2", HEADING_WRAP_GAP),
      },
    },
    compoundVariants: [
      // The outline draws its edge inside the same box, so an outlined row and a plain one are
      // the same size at `sm` as they are at shadcn's own.
      { variant: "outline", size: "sm", className: "border px-2.75 py-1.75" },
    ],
    defaultVariants: { variant: "default", size: "default" },
  },
);

/**
 * The chosen row: the one whose record is open beside the list. A tint in `active` and not the
 * hover grey, which on a row that stays put reads as a hover that stuck. The colour is not the
 * whole of it: say which row it is with `aria-current` on the link, or `aria-selected` in a listbox.
 */
export const ITEM_SELECTED_CLASS = "bg-active/40";

/**
 * The muted line's ink on the chosen row. `text-foreground/60` is 4.2:1 on the tint, short of the
 * 4.5:1 text needs, so on that row the description is full `foreground`, as ListItem's is.
 */
export const ITEM_SELECTED_DESCRIPTION_CLASS = "text-foreground";

/**
 * The start of the row: an icon in a small tile, an image, or whatever is passed. On the web an
 * `<svg>` or `<img>` inside is sized for you; on a device pass it sized (`size-4`, `size-full`).
 */
export const itemMediaVariants = cva("shrink-0 flex-row items-center justify-center gap-2", {
  variants: {
    variant: {
      default: "bg-transparent",
      // The fill alone, as EmptyMedia's tile: a ring on top of it was a second edge on one boundary.
      icon: "size-8 rounded-sm bg-foreground/10",
      image: "size-10 overflow-hidden rounded-sm",
    },
  },
  defaultVariants: { variant: "default" },
});

/** The middle: the title over the description, taking the row's spare width. */
export const ITEM_CONTENT_CLASS = "flex-1";

/**
 * At `sm` the two lines are the rhythm's `HEADING_GAP` apart, and the middle gives way to a long
 * title instead of growing, down to the rhythm's wrap floor: below 10rem the actions go under it.
 */
export const ITEM_CONTENT_SIZES = {
  default: "gap-1",
  sm: cn(HEADING_WRAP_FLOOR, HEADING_GAP),
} as const;
export const ITEM_CONTENT_SM_WEB =
  "group-data-[size=sm]/item:min-w-0 group-data-[size=sm]/item:basis-40 group-data-[size=sm]/item:gap-1";

/** The title's line: text, a badge beside it, side by side. */
export const ITEM_TITLE_CLASS = "flex-row items-center gap-2";

/**
 * At `sm` the line is held to the row's width, so a title truncated inside it has an edge to stop
 * at. Sized to its content, it ran past the row instead.
 */
export const ITEM_TITLE_SIZES = { default: "", sm: "max-w-full" } as const;
export const ITEM_TITLE_SM_WEB = "group-data-[size=sm]/item:max-w-full";

/** The title's type. On a device it goes on the `Text` a string is wrapped in, with its ink. */
export const ITEM_TITLE_TEXT = "text-sm font-semibold";

/**
 * At `sm` the title is the rhythm's `HEADING_TITLE`, on `text-sm`'s own 20px line. On the web the
 * line height is the title line's, which a `Text` inside inherits, so that half says `leading-5`,
 * the same 20px, to undo `leading-snug`.
 */
export const ITEM_TITLE_TEXT_SIZES = { default: "leading-snug", sm: HEADING_TITLE } as const;
export const ITEM_TITLE_TEXT_SM_WEB = "group-data-[size=sm]/item:leading-5";

/** The muted line under the title, two lines at most. */
export const ITEM_DESCRIPTION_CLASS = "line-clamp-2 font-normal text-foreground/60";

/**
 * At `sm` the description is the rhythm's `HEADING_DESCRIPTION`: the title's size, quieter by ink.
 * On the web `leading-5` is `text-sm`'s own 20px, said because `leading-normal` would carry over,
 * and the line is filled rather than balanced and keeps a string's newlines, as a native `Text`
 * does.
 */
export const ITEM_DESCRIPTION_SIZES = {
  default: "text-sm leading-normal",
  sm: HEADING_DESCRIPTION,
} as const;
export const ITEM_DESCRIPTION_SM_WEB =
  "group-data-[size=sm]/item:leading-5 group-data-[size=sm]/item:text-wrap group-data-[size=sm]/item:whitespace-pre-wrap";

/** The far end: buttons, a menu. */
export const ITEM_ACTIONS_CLASS = "flex-row items-center";

/**
 * At `sm` the buttons are level with the title's top rather than centred on the row, and never
 * give their width up to a long title. On a row that wraps, a wrapped action keeps to the far end,
 * clear of the row's media. Their gap is the rhythm's, by what they are: `actionGap` in
 * `@/lib/utils`, 4px between `icon-xs` buttons and 8px otherwise.
 */
export const ITEM_ACTIONS_SIZES = { default: "gap-2", sm: "ml-auto shrink-0 self-start" } as const;
export const ITEM_ACTIONS_SM_WEB =
  "group-data-[size=sm]/item:ml-auto group-data-[size=sm]/item:shrink-0 group-data-[size=sm]/item:self-start";

/**
 * The web half's gap between `icon-xs` buttons at `sm`, behind the row's `data-size`: the rest
 * keep the `gap-2` both sizes start from. `default` stays shadcn's whatever the buttons are.
 */
export const ITEM_ACTIONS_ICON_GAP_SM_WEB = "group-data-[size=sm]/item:gap-1";

/** A full-width line above the rest of the row. */
export const ITEM_HEADER_CLASS = "flex-row items-center justify-between gap-2";

/** A full-width line below the rest of the row. */
export const ITEM_FOOTER_CLASS = "flex-row items-center justify-between gap-2";

/** The rule between rows in an `ItemGroup`: a `Separator`, with shadcn's reset margin. */
export const ITEM_SEPARATOR_CLASS = "my-0";
