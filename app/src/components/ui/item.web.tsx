import type { VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import {
  ITEM_ACTIONS_CLASS,
  ITEM_ACTIONS_ICON_GAP_SM_WEB,
  ITEM_ACTIONS_SIZES,
  ITEM_ACTIONS_SM_WEB,
  ITEM_CONTENT_CLASS,
  ITEM_CONTENT_SIZES,
  ITEM_CONTENT_SM_WEB,
  ITEM_DESCRIPTION_CLASS,
  ITEM_DESCRIPTION_SIZES,
  ITEM_DESCRIPTION_SM_WEB,
  ITEM_FOOTER_CLASS,
  ITEM_HEADER_CLASS,
  ITEM_SELECTED_CLASS,
  ITEM_SEPARATOR_CLASS,
  ITEM_TITLE_CLASS,
  ITEM_TITLE_SM_WEB,
  ITEM_TITLE_TEXT,
  ITEM_TITLE_TEXT_SIZES,
  ITEM_TITLE_TEXT_SM_WEB,
  itemMediaVariants,
  itemVariants,
} from "@/components/ui/item-base";
import { Separator, type SeparatorProps } from "@/components/ui/separator";
import { actionGap, cn, ICON_ACTION_GAP } from "@/lib/utils";

/**
 * A part's name in a test. A native source drawn on the web — `ListItem` in an Expo web build,
 * which resolves this file beside `item.tsx` — names a part with `testID`, as it does on device.
 * The DOM's word for that is `data-slot`, so it is written there in place of the part's own.
 */
type Named = { testID?: string | undefined };

/**
 * Upstream ships this with `role="list"`, and it is dropped here on purpose: nothing in this
 * file can be the `listitem` that role requires. `Item` takes `asChild`, so a caller may render
 * it as an `<a>` or a `<button>`, and a fixed role here would clobber that one — which is why
 * upstream does not put it there either. A `list` owning no `listitem` is not a neutral
 * overclaim: it announces as an empty list, and an AT that exposes only listitem children hides
 * whatever is inside it. A caller that really is drawing a list can say so on its own wrapper,
 * which is also where it owns the items.
 */
function ItemGroup({ className, testID, ...props }: React.ComponentProps<"div"> & Named) {
  return (
    <div
      data-slot={testID ?? "item-group"}
      className={cn("group/item-group flex flex-col", className)}
      {...props}
    />
  );
}

/** A rule between two items. */
function ItemSeparator({ className, testID, ...props }: SeparatorProps & Named) {
  return (
    <Separator
      data-slot={testID ?? "item-separator"}
      className={cn(ITEM_SEPARATOR_CLASS, className)}
      {...props}
    />
  );
}

/** What only a DOM row has: a link row's hover, and the same fill for its keyboard focus. */
const ITEM_WEB =
  "group/item flex transition-colors duration-100 outline-none [a]:transition-colors [a]:hover:bg-hover [a]:focus-visible:bg-hover";

/**
 * shadcn's type for the whole row, at its own size only. At `sm` the parts set their own, as
 * `ListItem`'s always did, so what a caller puts in a slot keeps the page's type around it.
 */
const ITEM_TEXT_WEB = "data-[size=default]:text-sm";

/** A header's or footer's words at `sm`, which the row no longer sizes: the device half's size. */
const ITEM_LINE_TEXT_WEB = "group-data-[size=sm]/item:text-sm";

/** One row: media, content and actions side by side. */
function Item({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  selected = false,
  testID,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof itemVariants> &
  Named & {
    asChild?: boolean;
    /**
     * The chosen row: the one open beside the list. Tinted in `active`, a step further under the
     * pointer. Set `aria-current` or `aria-selected` on the row or the link inside as well.
     */
    selected?: boolean | undefined;
  }) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot={testID ?? "item"}
      data-variant={variant}
      data-size={size}
      data-selected={selected ? "" : undefined}
      className={cn(
        ITEM_WEB,
        ITEM_TEXT_WEB,
        itemVariants({ variant, size }),
        selected && ITEM_SELECTED_CLASS,
        selected && "[a]:hover:bg-active/60 [a]:focus-visible:bg-active/60",
        className,
      )}
      {...props}
    />
  );
}

/** Sizing what is inside, which a device cannot select for, and the nudge beside a description. */
const ITEM_MEDIA_WEB = {
  default: "",
  icon: "[&_svg:not([class*='size-'])]:size-4",
  image: "[&_img]:size-full [&_img]:object-cover",
} as const;

/** The icon or image at the start of an item. */
function ItemMedia({
  className,
  variant = "default",
  testID,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants> & Named) {
  return (
    <div
      data-slot={testID ?? "item-media"}
      data-variant={variant}
      className={cn(
        "flex [&_svg]:pointer-events-none",
        // shadcn's nudge to the description's first line, at its own size only: at `sm` the media
        // stays centred on the row, as `ListItem`'s `leadingSlot` is.
        "group-data-[size=default]/item:group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-data-[size=default]/item:group-has-[[data-slot=item-description]]/item:self-start",
        itemMediaVariants({ variant }),
        ITEM_MEDIA_WEB[variant ?? "default"],
        className,
      )}
      {...props}
    />
  );
}

/** The middle of an item, holding its title and description. */
function ItemContent({ className, testID, ...props }: React.ComponentProps<"div"> & Named) {
  return (
    <div
      data-slot={testID ?? "item-content"}
      className={cn(
        "flex flex-col [&+[data-slot=item-content]]:flex-none",
        ITEM_CONTENT_CLASS,
        ITEM_CONTENT_SIZES.default,
        ITEM_CONTENT_SM_WEB,
        className,
      )}
      {...props}
    />
  );
}

/** The item's title. */
function ItemTitle({ className, testID, ...props }: React.ComponentProps<"div"> & Named) {
  return (
    <div
      data-slot={testID ?? "item-title"}
      className={cn(
        "flex w-fit",
        ITEM_TITLE_CLASS,
        ITEM_TITLE_SM_WEB,
        ITEM_TITLE_TEXT,
        ITEM_TITLE_TEXT_SIZES.default,
        ITEM_TITLE_TEXT_SM_WEB,
        className,
      )}
      {...props}
    />
  );
}

/** The muted line under the item's title. */
function ItemDescription({ className, testID, ...props }: React.ComponentProps<"p"> & Named) {
  return (
    <p
      data-slot={testID ?? "item-description"}
      className={cn(
        ITEM_DESCRIPTION_CLASS,
        ITEM_DESCRIPTION_SIZES.default,
        ITEM_DESCRIPTION_SM_WEB,
        // ITEM_SELECTED_DESCRIPTION_CLASS on the chosen row, which says so with `data-selected`:
        // read here rather than through context so the part stays a plain `<p>`.
        "in-data-selected:text-foreground",
        // A link is `info` at rest, as every link is, and shown by its underline as well. On the
        // chosen row it is `foreground`: `info` on the tint is about 3.3:1, under AA.
        "text-balance [&>a]:text-info [&>a]:underline [&>a]:underline-offset-4",
        "in-data-selected:[&>a]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** The buttons at the far end of an item. */
function ItemActions({
  className,
  testID,
  children,
  ...props
}: React.ComponentProps<"div"> & Named) {
  return (
    <div
      data-slot={testID ?? "item-actions"}
      className={cn(
        "flex",
        ITEM_ACTIONS_CLASS,
        ITEM_ACTIONS_SIZES.default,
        ITEM_ACTIONS_SM_WEB,
        actionGap(children) === ICON_ACTION_GAP && ITEM_ACTIONS_ICON_GAP_SM_WEB,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** A full-width line above the item's row. */
function ItemHeader({ className, testID, ...props }: React.ComponentProps<"div"> & Named) {
  return (
    <div
      data-slot={testID ?? "item-header"}
      className={cn("flex basis-full", ITEM_LINE_TEXT_WEB, ITEM_HEADER_CLASS, className)}
      {...props}
    />
  );
}

/** A full-width line below the item's row. */
function ItemFooter({ className, testID, ...props }: React.ComponentProps<"div"> & Named) {
  return (
    <div
      data-slot={testID ?? "item-footer"}
      className={cn("flex basis-full", ITEM_LINE_TEXT_WEB, ITEM_FOOTER_CLASS, className)}
      {...props}
    />
  );
}

export {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
};
