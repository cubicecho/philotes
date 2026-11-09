import type { ReactNode } from "react";
import { Platform, Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { IconClassContext } from "@/components/ui/icons-base";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, hasSlot, type SlotNode } from "@/lib/utils";

type StatTileProps = {
  /** What the figure is called: "Turns", "Daily average". Drawn above it, muted. */
  label: ReactNode;
  /**
   * The figure: a string or a number, drawn large in tabular numerals so a row of tiles lines up
   * as it ticks. A node works too — a `ColorDot` beside a category's name — and is placed as is.
   */
  value: ReactNode;
  /**
   * One muted line under the figure: what it is out of, or where it comes from — "over 7 days",
   * "schema v4". Read after the value, as part of the tile.
   */
  hint?: ReactNode | undefined;
  /** Before the label. A bare `<Clock />`; the tile sizes it and mutes it. */
  iconSlot?: SlotNode | undefined;
  /**
   * Whether the figure is still being fetched. On, a bar stands in for the value and the label
   * stays — the tile is as tall as it will be, so a row of them does not jump when the data lands.
   */
  loading?: boolean | undefined;
  /**
   * Makes the whole tile a button: a filter to toggle, a page to open. The tile's text is its
   * accessible name, so a count and its label are read together.
   */
  onPress?: (() => void) | undefined;
  /**
   * With `onPress`, the tile is a toggle and this is whether it is on — the filter tile over a
   * list. Left out, the tile is a plain button. Without `onPress` it is ignored.
   */
  selected?: boolean | undefined;
  /** On the tile itself, the bordered box. */
  className?: string | undefined;
  /**
   * The figure's class: the colour a count takes when it is one worth noticing, such as
   * `text-negative`. A chosen filter tile draws its figure in `foreground` whatever this says,
   * because a status colour on the chosen tint is under 3:1, so a count that matters needs an
   * `iconSlot` or a `hint` that says so as well.
   */
  valueClassName?: string | undefined;
};

/** The icon's box: sized from outside on the web, and by `IconClassContext` on device. */
const ICON_BOX = cn(
  "shrink-0",
  Platform.select({ web: "[&_svg]:size-4 [&_svg]:shrink-0", default: undefined }),
);

/**
 * A wrapper around a caller's node, not layout of its own: a block box on the web, where a compiled
 * view would otherwise be a flex column and lay a dot and a name out as two rows.
 */
const SLOT = Platform.select({ web: "block", default: undefined });

/**
 * One number on a card: a label, the figure and a hint, pressable as a filter when given `onPress`.
 */
export function StatTile({
  label,
  value,
  hint,
  iconSlot,
  loading = false,
  onPress,
  selected,
  className,
  valueClassName,
}: StatTileProps) {
  const toggle = onPress !== undefined && selected !== undefined;
  // The pressed state in each platform's spelling. react-native-web forwards `aria-*` and drops
  // `accessibilityState`; the device reads `accessibilityState` and has no `aria-pressed`.
  const pressedState =
    Platform.OS === "web" ? { "aria-pressed": selected } : { accessibilityState: { selected } };
  const pressed = toggle ? pressedState : {};

  // A selected tile is the chosen tint inside an `active` edge, a step further under the pointer
  // and focused. Its label, hint and icon turn `foreground` there: muted on the tint is under 4.5:1.
  // So does the figure, over the caller's colour: `text-negative` on the tint was 2.0–3.6:1 (#471).
  const chosen = toggle && selected === true;
  const ink = chosen ? "text-foreground" : "text-foreground/60";
  const classes = cn(
    "min-w-0 gap-1 p-4",
    chosen && "border-active bg-active/40",
    // `Card` draws a pressable tile's hover, focus and press; a chosen one takes the tint's step.
    chosen && "hover:bg-active/60 focus-visible:bg-active/60 active:bg-active/60",
    className,
  );

  const figure =
    typeof value === "string" || typeof value === "number" ? (
      <Text
        testID="stat-tile-value"
        className={cn(
          "font-semibold text-2xl text-foreground tabular-nums",
          valueClassName,
          chosen && "text-foreground",
        )}
      >
        {value}
      </Text>
    ) : (
      <View
        testID="stat-tile-value"
        className={cn(SLOT, "min-w-0", valueClassName, chosen && "text-foreground")}
      >
        {value}
      </View>
    );

  const body = (
    <>
      <View testID="stat-tile-label-row" className="min-w-0 flex-row items-center gap-2">
        {hasSlot(iconSlot) ? (
          <View testID="stat-tile-icon" aria-hidden className={cn(ICON_BOX, ink)}>
            <IconClassContext.Provider value={cn("size-4 shrink-0", ink)}>
              {iconSlot}
            </IconClassContext.Provider>
          </View>
        ) : null}
        <Text
          testID="stat-tile-label"
          // Normal weight, as PropertyRow's label: the label supports the figure under it, and
          // a grey semibold label competed with it.
          className={cn("min-w-0 flex-1 truncate text-sm", ink)}
        >
          {label}
        </Text>
      </View>
      {loading ? (
        // One line of the figure. The tile's name for it goes on a box round the bar: a `testID`
        // on `Skeleton` would replace the primitive's own.
        <View testID="stat-tile-skeleton" aria-hidden>
          <Skeleton className="h-8 w-20" />
        </View>
      ) : (
        figure
      )}
      {hint ? (
        <Text testID="stat-tile-hint" className={cn("text-xs", ink)}>
          {hint}
        </Text>
      ) : null}
    </>
  );

  // `Card` is the one that turns into a `Pressable` when it is handed `onPress`, and stays a view
  // when it is handed `undefined` — so a tile nobody can press is not a button.
  return (
    <Card
      testID="stat-tile"
      onPress={onPress}
      aria-busy={loading || undefined}
      className={classes}
      {...pressed}
    >
      {body}
    </Card>
  );
}
