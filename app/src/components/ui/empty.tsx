import * as React from "react";
import { Platform, Text, View } from "react-native";
import { IconClassContext } from "@/components/ui/icons-base";
import { cn } from "@/lib/utils";

// `className` is re-declared rather than inherited: nativewind types it as `className?: string`,
// which under `exactOptionalPropertyTypes` rejects the `cond ? "x" : undefined` call sites pass.
type ViewProps = Omit<React.ComponentProps<typeof View>, "className"> & {
  className?: string | undefined;
};
type TextProps = Omit<React.ComponentProps<typeof Text>, "className"> & {
  className?: string | undefined;
};

/** The root of an empty state: a centred column. */
const Empty = React.forwardRef<React.ElementRef<typeof View>, ViewProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      testID="empty"
      // `border-dashed` with no width, as shadcn's Empty: no edge unless a caller adds one. The /10
      // edge it had was 1.24:1, barely there in light and gone in dark.
      className={cn(
        "w-full min-w-0 items-center justify-center gap-3 rounded-lg border-dashed py-10",
        className,
      )}
      {...props}
    />
  ),
);
Empty.displayName = "Empty";

/** The block holding the media, the title and the description. */
const EmptyHeader = React.forwardRef<React.ElementRef<typeof View>, ViewProps>(
  ({ className, ...props }, ref) => (
    // 4px between the title and its line, so a wrapped title does not run into it; the media's
    // `mb-2` adds to it for the 12px under the bubble.
    <View
      ref={ref}
      testID="empty-header"
      className={cn("items-center gap-1", className)}
      {...props}
    />
  ),
);
EmptyHeader.displayName = "EmptyHeader";

/** How `EmptyMedia` is drawn: as given, or as an icon in a muted bubble. */
export type EmptyMediaVariant = "default" | "icon";

/** `icon` is the muted bubble `EmptyState` draws; `default` is a bare box for an avatar or image. */
const EMPTY_MEDIA = {
  default: "",
  icon: "rounded-full bg-foreground/10 p-3 text-foreground/60",
} satisfies Record<EmptyMediaVariant, string>;

const MEDIA_SVG = Platform.select({
  web: "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  default: "",
});

// A glyph that names its own size keeps it; every other one is the bubble's 24px.
const ICON_SVG = Platform.select({ web: "[&_svg:not([class*='size-'])]:size-6", default: "" });

type EmptyMediaProps = ViewProps & {
  /** `icon` draws the child glyph in a muted bubble, sized and inked; `default` leaves it alone. */
  variant?: EmptyMediaVariant | null | undefined;
};

/** The icon or image above the title. */
const EmptyMedia = React.forwardRef<React.ElementRef<typeof View>, EmptyMediaProps>(
  ({ className, variant, children, ...props }, ref) => {
    const box = cn(
      "mb-2 shrink-0 items-center justify-center",
      MEDIA_SVG,
      EMPTY_MEDIA[variant ?? "default"],
      variant === "icon" ? ICON_SVG : "",
      className,
    );
    if (variant === "icon") {
      return (
        <View ref={ref} testID="empty-icon" className={box} {...props}>
          <IconClassContext.Provider value="h-6 w-6 text-foreground/60">
            {children}
          </IconClassContext.Provider>
        </View>
      );
    }
    return (
      <View ref={ref} testID="empty-icon" className={box} {...props}>
        {children}
      </View>
    );
  },
);
EmptyMedia.displayName = "EmptyMedia";

type EmptyTitleProps = TextProps & {
  /**
   * Makes the title a heading of this rank: `1` when the empty or error block is the whole screen,
   * `2` or `3` under a title that is already there. Left out, it is plain text, as shadcn's is. The
   * size does not follow it: a block's title is 16px at every rank.
   */
  level?: 1 | 2 | 3 | undefined;
};

// A size over the description's, so the first thing a new user reads leads the block. Centred, so
// a title that wraps stays over the bubble.
const EMPTY_TITLE = "text-center font-semibold text-base text-foreground";

// One arm per level because the compiler emits `<h1>`–`<h3>` from a *literal* `aria-level`; a level
// held in a variable would be a tag chosen at runtime, which it refuses (see `page-header.tsx`).
/** What is missing, in a few words. */
const EmptyTitle = React.forwardRef<React.ElementRef<typeof Text>, EmptyTitleProps>(
  ({ className, level, ...props }, ref) => {
    if (level === undefined) {
      return (
        <Text ref={ref} testID="empty-title" className={cn(EMPTY_TITLE, className)} {...props} />
      );
    }
    if (level === 1) {
      return (
        <Text
          ref={ref}
          testID="empty-title"
          role="heading"
          aria-level={1}
          className={cn(EMPTY_TITLE, className)}
          {...props}
        />
      );
    }
    if (level === 2) {
      return (
        <Text
          ref={ref}
          testID="empty-title"
          role="heading"
          aria-level={2}
          className={cn(EMPTY_TITLE, className)}
          {...props}
        />
      );
    }
    return (
      <Text
        ref={ref}
        testID="empty-title"
        role="heading"
        aria-level={3}
        className={cn(EMPTY_TITLE, className)}
        {...props}
      />
    );
  },
);
EmptyTitle.displayName = "EmptyTitle";

// A link in the line is `info`, as every link is.
const DESCRIPTION_LINK = Platform.select({
  web: "[&>a]:text-info [&>a]:underline [&>a]:underline-offset-4",
  default: "",
});

/** The muted line under the title, saying what to do about it. */
const EmptyDescription = React.forwardRef<React.ElementRef<typeof Text>, TextProps>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      testID="empty-description"
      // Capped so a long line wraps into a block about as wide as the actions under it, rather
      // than running the width of a desktop page.
      className={cn("max-w-sm text-center text-sm text-foreground/60", DESCRIPTION_LINK, className)}
      {...props}
    />
  ),
);
EmptyDescription.displayName = "EmptyDescription";

/** What to do about it: a button or two, under the words. */
const EmptyContent = React.forwardRef<React.ElementRef<typeof View>, ViewProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      testID="empty-content"
      className={cn("w-full min-w-0 max-w-sm items-center gap-3", className)}
      {...props}
    />
  ),
);
EmptyContent.displayName = "EmptyContent";

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
