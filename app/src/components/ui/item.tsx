import { Slot } from "@radix-ui/react-slot";
import * as React from "react";
import { Text, View } from "react-native";
import {
  ITEM_ACTIONS_CLASS,
  ITEM_ACTIONS_SIZES,
  ITEM_CONTENT_CLASS,
  ITEM_CONTENT_SIZES,
  ITEM_DESCRIPTION_CLASS,
  ITEM_DESCRIPTION_SIZES,
  ITEM_FOOTER_CLASS,
  ITEM_HEADER_CLASS,
  ITEM_SELECTED_CLASS,
  ITEM_SELECTED_DESCRIPTION_CLASS,
  ITEM_SEPARATOR_CLASS,
  ITEM_TITLE_CLASS,
  ITEM_TITLE_SIZES,
  ITEM_TITLE_TEXT,
  ITEM_TITLE_TEXT_SIZES,
  type ItemMediaVariant,
  type ItemSize,
  type ItemVariant,
  itemMediaVariants,
  itemVariants,
} from "@/components/ui/item-base";
import { Separator, type SeparatorProps } from "@/components/ui/separator";
import { actionGap, cn } from "@/lib/utils";

// `className` is re-declared rather than inherited: nativewind types it as `className?: string`,
// which under `exactOptionalPropertyTypes` rejects the conditional a call site passes.
type ViewProps = Omit<React.ComponentProps<typeof View>, "className"> & {
  className?: string | undefined;
};
type TextProps = Omit<React.ComponentProps<typeof Text>, "className"> & {
  className?: string | undefined;
};

/** The ink and type a string in a part is drawn with, where nothing is inherited. */
const PART_TEXT = "text-foreground text-sm";

/**
 * Each string or number child in its own `Text`, elements left as they are. A part holds a badge
 * beside a word as often as a word alone, so it is the children one by one, not all or nothing.
 */
function withText(children: React.ReactNode, className: string) {
  return React.Children.map(children, (child) =>
    typeof child === "string" || typeof child === "number" ? (
      <Text className={className}>{child}</Text>
    ) : (
      child
    ),
  );
}

/** A list of items. */
function ItemGroup({ className, ...props }: ViewProps) {
  return <View testID="item-group" className={cn("flex-col", className)} {...props} />;
}

/** A rule between two items. */
function ItemSeparator({ className, ...props }: SeparatorProps) {
  return (
    <Separator testID="item-separator" className={cn(ITEM_SEPARATOR_CLASS, className)} {...props} />
  );
}

type ItemProps = ViewProps & {
  variant?: ItemVariant | null | undefined;
  size?: ItemSize | null | undefined;
  /**
   * Hand the row's classes to the one child instead of a `View` around it — a `Pressable` that
   * opens the record, an expo-router `Link`. Radix's `Slot`, as on `Button`.
   */
  asChild?: boolean | undefined;
  /**
   * The chosen row: the one open beside the list. Tinted in `active`. Set `aria-current` or
   * `aria-selected` on the row or the link inside as well.
   */
  selected?: boolean | undefined;
};

/**
 * What the parts need to know about the row they are in, since nothing is inherited on a device:
 * whether it is the chosen one, for the description's ink, and its size, for each part's metrics.
 */
const ItemRowContext = React.createContext<{ selected: boolean; size: ItemSize }>({
  selected: false,
  size: "default",
});

/** One row: media, content and actions side by side. */
function Item({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  selected = false,
  ...props
}: ItemProps) {
  const classes = cn(itemVariants({ variant, size }), selected && ITEM_SELECTED_CLASS, className);
  const row = React.useMemo(() => ({ selected, size: size ?? "default" }), [selected, size]);
  if (asChild) {
    // `Slot` is typed for the DOM, but it renders nothing of its own — it clones the caller's
    // one child with these props merged in — so the cast is the honest way to say neither side's
    // typing describes it (`Button` does the same).
    return (
      <ItemRowContext.Provider value={row}>
        <Slot className={classes} {...(props as unknown as React.HTMLAttributes<HTMLElement>)} />
      </ItemRowContext.Provider>
    );
  }
  return (
    <ItemRowContext.Provider value={row}>
      <View testID="item" className={classes} {...props} />
    </ItemRowContext.Provider>
  );
}

type ItemMediaProps = ViewProps & { variant?: ItemMediaVariant | null | undefined };

/** The icon or image at the start of an item. */
function ItemMedia({ className, variant = "default", ...props }: ItemMediaProps) {
  return (
    <View
      testID="item-media"
      className={cn(itemMediaVariants({ variant }), className)}
      {...props}
    />
  );
}

/** The middle of an item, holding its title and description. */
function ItemContent({ className, children, ...props }: ViewProps) {
  const { size } = React.useContext(ItemRowContext);
  return (
    <View
      testID="item-content"
      className={cn(ITEM_CONTENT_CLASS, ITEM_CONTENT_SIZES[size], className)}
      {...props}
    >
      {withText(children, PART_TEXT)}
    </View>
  );
}

/**
 * A `View` holding the line, not a `Text`, because the line is as often a badge beside a word as a
 * word — and a `View` inside a `Text` is not a row on a device. The string gets the title's type.
 */
function ItemTitle({ className, children, ...props }: ViewProps) {
  const { size } = React.useContext(ItemRowContext);
  return (
    <View
      testID="item-title"
      className={cn("self-start", ITEM_TITLE_CLASS, ITEM_TITLE_SIZES[size], className)}
      {...props}
    >
      {withText(children, cn("text-foreground", ITEM_TITLE_TEXT, ITEM_TITLE_TEXT_SIZES[size]))}
    </View>
  );
}

/** The muted line under the item's title. */
function ItemDescription({ className, ...props }: TextProps) {
  const { selected, size } = React.useContext(ItemRowContext);
  return (
    <Text
      testID="item-description"
      className={cn(
        ITEM_DESCRIPTION_CLASS,
        ITEM_DESCRIPTION_SIZES[size],
        selected && ITEM_SELECTED_DESCRIPTION_CLASS,
        className,
      )}
      {...props}
    />
  );
}

/** The buttons at the far end of an item. */
function ItemActions({ className, children, ...props }: ViewProps) {
  const { size } = React.useContext(ItemRowContext);
  return (
    <View
      testID="item-actions"
      className={cn(
        ITEM_ACTIONS_CLASS,
        ITEM_ACTIONS_SIZES[size],
        // `default` keeps shadcn's gap whatever the buttons are.
        size === "sm" && actionGap(children),
        className,
      )}
      {...props}
    >
      {withText(children, PART_TEXT)}
    </View>
  );
}

/** A full-width line above the item's row. */
function ItemHeader({ className, children, ...props }: ViewProps) {
  return (
    <View testID="item-header" className={cn("w-full", ITEM_HEADER_CLASS, className)} {...props}>
      {withText(children, PART_TEXT)}
    </View>
  );
}

/** A full-width line below the item's row. */
function ItemFooter({ className, children, ...props }: ViewProps) {
  return (
    <View testID="item-footer" className={cn("w-full", ITEM_FOOTER_CLASS, className)} {...props}>
      {withText(children, PART_TEXT)}
    </View>
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
