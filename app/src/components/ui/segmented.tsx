import type { ReactNode } from "react";
import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { IconClassContext } from "@/components/ui/icons-base";
import { cn, hasSlot, type SlotNode, touchRowClass, touchTarget } from "@/lib/utils";

/**
 * A plain pill's drawn height, its label's 20px line and its `py-1.5`: 32px. Grown to a finger's
 * 44pt by a `hitSlop` on device (#470), and only the height: pills sit side by side, where a wider
 * target would take a neighbour's. A framed pill is 44pt itself and takes none.
 */
const DRAWN = { height: 32 } as const;

/**
 * The container class, for a pill the caller renders itself.
 *
 * `hover:` and `transition-colors` are no-ops on device and real on web, which
 * is the intended asymmetry: a pointer exists on one platform and not the other.
 * Focused, a pill looks as it does under the pointer, and draws no ring.
 */
export function segmentedItemClass(active: boolean, className?: string) {
  return cn(
    "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none",
    active
      ? "bg-active/40 text-foreground hover:bg-active/60 focus-visible:bg-active/60"
      : "text-foreground/60 hover:bg-hover hover:text-foreground focus-visible:bg-hover focus-visible:text-foreground",
    className,
  );
}

/**
 * The `<Text>` half of the pill. Native does not inherit colour, so a pill
 * built from a `Pressable` needs the colour on its label, not on its container.
 * A pill built from a router `<Link>` does not need this — a link renders a
 * `Text` and text-in-text does inherit.
 */
export function segmentedTextClass(active: boolean, className?: string) {
  return cn(
    "text-sm font-semibold",
    active ? "text-foreground" : ["text-foreground/60", HOVER_INK],
    className,
  );
}

/**
 * A quiet label lifted to full ink under the pointer and focused, as the web halves'
 * `hover:text-foreground` does. The colour sits on each `Text`, which a container's `hover:` cannot
 * reach, so it reads the pressable's `group` instead. Web only: a device has no pointer to hover
 * with, and no keyboard focus to show.
 */
const HOVER_INK = Platform.select({
  web: "group-hover:text-foreground group-focus-visible:text-foreground",
  default: "",
});

/** The same lift on the container, for an element child that takes its colour from there. */
const CONTAINER_HOVER_INK = Platform.select({
  web: "hover:text-foreground focus-visible:text-foreground",
  default: "",
});

/**
 * Where a pill with an `iconSlot` stops drawing its label: at every width, or under
 * one. `inline` on the web and `flex` on device are the display each platform's
 * text has when it is not hidden.
 */
const LABEL_HIDE_BELOW = {
  always: "hidden",
  sm: Platform.select({ web: "hidden sm:inline", default: "hidden sm:flex" }),
  md: Platform.select({ web: "hidden md:inline", default: "hidden md:flex" }),
  lg: Platform.select({ web: "hidden lg:inline", default: "hidden lg:flex" }),
  xl: Platform.select({ web: "hidden xl:inline", default: "hidden xl:flex" }),
} as const;

/**
 * A pill with an icon is a row. The web half's icon sizes from here, as a
 * `Button`'s does; device's from the `IconClassContext` the pill publishes.
 */
const WITH_ICON = cn(
  "flex-row items-center gap-1.5",
  Platform.select({
    web: "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    default: undefined,
  }),
);

/**
 * What a `SegmentedGroup` tells the pills inside it: which value is current, who
 * to tell when another is pressed, whether they sit in the frame, and where a
 * pill with an icon drops its label.
 */
type SegmentedGroupContextValue = {
  value: string | undefined;
  onValueChange: ((value: string) => void) | undefined;
  framed: boolean;
  labelHideBelow: keyof typeof LABEL_HIDE_BELOW | undefined;
};

const SegmentedGroupContext = React.createContext<SegmentedGroupContextValue | null>(null);

/**
 * The row's two looks. `framed` is a frame around pills as tall as an input, the
 * same box a `TabsList` draws round its tabs, so the two are one height side by
 * side; `plain` is the pills on the page with nothing round them, for a toolbar
 * or a nav bar.
 *
 * No height of its own (#537). It was the 40px box an `Input` is, which left a
 * pill 28px inside it, while a tab had grown to 40px in a frame round it (#535).
 */
const SEGMENTED_GROUP_VARIANTS = {
  framed: "rounded-md border border-foreground/50 bg-background p-1",
  plain: "",
} as const;

export type SegmentedGroupProps<TValue extends string = string> = Omit<
  React.ComponentProps<typeof View>,
  "children" | "className" | "style" | "role" | "ref"
> & {
  /**
   * The current pill's `value`. With it, a `SegmentedButton value="week"` works
   * out whether it is current, so no pill needs `active={x === value}`.
   */
  value?: TValue | undefined;
  /**
   * Called with a pill's `value` when it is pressed. Typed as the group's
   * `value` is, so a group over a closed set hands back a member of the set
   * and the caller neither looks it up again nor asserts it.
   */
  onValueChange?: ((value: TValue) => void) | undefined;
  /** The row's element, for a caller that has to measure it. */
  ref?: React.Ref<React.ElementRef<typeof View>> | undefined;
  /**
   * `framed` (the default) draws a frame round pills as tall as an input, as a `TabsList` does;
   * `plain` draws the row alone, its pills 32px.
   */
  variant?: keyof typeof SEGMENTED_GROUP_VARIANTS | undefined;
  /**
   * Under this width a pill with an `iconSlot` draws the icon alone; `always` is a
   * row of icons at every width. Said here and not on each pill because the
   * pills in a row should agree. The label is still the pill's name, read by a
   * screen reader, and a pill with no `iconSlot` keeps its label.
   */
  labelHideBelow?: keyof typeof LABEL_HIDE_BELOW | undefined;
  /**
   * The group's name, read on entering it: "Scale view, group". Give one
   * whenever no visible heading names the choice.
   */
  "aria-label"?: string | undefined;
  /** The id of a visible heading that names the group, in place of `aria-label`. */
  "aria-labelledby"?: string | undefined;
  /** On the row the pills sit in, after the variant's classes. */
  className?: string | undefined;
  /** The `SegmentedButton` pills, one per choice. */
  children: ReactNode;
};

/**
 * The row a set of pills sits in, and the name of what they choose between.
 *
 * `role="group"` rather than `radiogroup`, because the pills are toggle buttons
 * with `aria-pressed`, not radios: a `radiogroup` promises one tab stop and arrow
 * keys, which a row of buttons does not have, and a nav bar's pills are links.
 * Without the group a screen reader hears "Week, toggle button, pressed" with
 * nothing saying what Week was chosen from.
 *
 * Holds no value of its own. `value` and `onValueChange` are the caller's, and
 * both are optional: a row of pills that each pass `active` still works inside it.
 *
 * Generic over the value, `string` unless the caller's `value` says otherwise, so
 * a group over `"week" | "month"` calls `onValueChange` with that union.
 */
function SegmentedGroup<TValue extends string = string>({
  value,
  onValueChange,
  variant = "framed",
  labelHideBelow,
  className,
  children,
  ref,
  ...props
}: SegmentedGroupProps<TValue>) {
  const framed = variant === "framed";
  const context = React.useMemo<SegmentedGroupContextValue>(
    () => ({
      value,
      // The one place `TValue` is taken on trust. A pill only compares its own
      // `value` and hands it back, so the context carries `string`; what makes
      // that string a `TValue` is that the caller wrote the pills from the set.
      onValueChange: onValueChange as ((value: string) => void) | undefined,
      framed,
      labelHideBelow,
    }),
    [value, onValueChange, framed, labelHideBelow],
  );
  return (
    <SegmentedGroupContext.Provider value={context}>
      <View
        ref={ref}
        role="group"
        className={cn(
          "flex-row items-center gap-1 self-start",
          // A flex container is block-level on the web and would stretch the
          // frame across the page; on device `self-start` already hugs it.
          Platform.select({ web: "w-fit", default: undefined }),
          SEGMENTED_GROUP_VARIANTS[variant],
          className,
        )}
        {...props}
      >
        {children}
      </View>
    </SegmentedGroupContext.Provider>
  );
}

export type SegmentedButtonProps = Omit<
  React.ComponentProps<typeof Pressable>,
  "children" | "className" | "style"
> & {
  /**
   * Whether this is the current pill. Wins over a group's `value` when both are
   * given, so a call site written before `SegmentedGroup` keeps working.
   */
  active?: boolean | undefined;
  /**
   * This pill's value inside a `SegmentedGroup`: it is current when the group's
   * `value` matches, and pressing it hands this to the group's `onValueChange`.
   */
  value?: string | undefined;
  /**
   * Before the label. Pass a bare `<Pencil />`; the pill sizes it and gives it
   * the label's colour, chosen or not, on both platforms. With the group's
   * `labelHideBelow` it is all the pill draws, and the string child is its name.
   */
  iconSlot?: SlotNode | undefined;
  // Re-declared rather than inherited: nativewind types it as `className?:
  // string`, which under `exactOptionalPropertyTypes` rejects the conditional
  // `cond ? "x" : undefined` that call sites pass.
  className?: string | undefined;
  children: ReactNode;
};

/**
 * A pressable pill.
 *
 * `children` is passed through untouched unless it is a bare string, in which
 * case it is wrapped in a `<Text>` carrying the active colour — the common case,
 * and the one where forgetting the wrapper is a runtime error on native.
 *
 * `iconSlot` is the slot for the glyph beside that string, so a pill with both is
 * still a string child and nothing the caller lays out. An icon put in
 * `children` instead is passed through like any other node: on the web it
 * inherits the pill's colour, on device it takes none.
 *
 * Takes the rest of a `Pressable`'s props and forwards a ref, the same contract
 * `button.tsx` has and for the same reason: a closed prop set silently drops
 * everything a wrapper tries to hand it — a `TooltipTrigger asChild`'s ref and
 * `aria-*`, an `onLongPress`, a `testID` — with nothing erroring to say so.
 */
const SegmentedButton = React.forwardRef<React.ElementRef<typeof Pressable>, SegmentedButtonProps>(
  ({ active, value, iconSlot, className, children, onPress, ...props }, ref) => {
    const group = React.useContext(SegmentedGroupContext);
    const current = active ?? (group !== null && value !== undefined && group.value === value);
    // The pill's own ink, for the container and the icon.
    const ink = current ? "text-foreground" : "text-foreground/60";
    // Only a pill with an icon has something left to draw once its label is gone.
    const labelHideBelow = hasSlot(iconSlot) ? group?.labelHideBelow : undefined;
    return (
      <Pressable
        ref={ref}
        // Hand-written because a `Pressable` has no implicit role, and `selected`
        // is what tells a screen reader which pill of the set is the current one.
        accessibilityRole="button"
        accessibilityState={{ selected: current }}
        // The same fact again, in the only spelling the web understands.
        //
        // react-native-web does not read `accessibilityState` at all — it forwards an allowlist of
        // `aria-*` props and nothing else — so without this line the active pill is styled but
        // silent, and a screen reader user cannot tell which of the set is current. It is
        // `aria-pressed` rather than `aria-selected` because this is a `button`, and `aria-selected`
        // is only defined on `option`, `tab`, `row`, `gridcell` and `treeitem`; on a button it is
        // markup axe rejects. React Native has no `aria-pressed`, hence the platform guard.
        {...(Platform.OS === "web" ? ({ "aria-pressed": current } as const) : {})}
        // A label that is not drawn is not read either, on either platform, so
        // the pill is named by the same string. Before `props`, so a caller's own
        // `aria-label` still wins.
        {...(labelHideBelow && typeof children === "string" ? { "aria-label": children } : {})}
        onPress={(event) => {
          if (group && value !== undefined) {
            group.onValueChange?.(value);
          }
          onPress?.(event);
        }}
        className={cn(
          // Inside the frame a pill is a tab, with `rounded-sm`, the radius nested in the frame's:
          // 30px on the web, so the frame is 40px, the height of an `Input` and a default
          // `Button`; 44pt on device, that tall itself rather than by a `hitSlop`, as a tab is. A
          // framed segmented control and a tab list are then one height side by side (#537).
          group?.framed
            ? cn(
                "justify-center rounded-sm px-3",
                Platform.OS === "web" ? "h-7.5" : "h-10",
                touchRowClass(),
              )
            : "rounded-md px-3 py-1.5",
          // The current pill is the chosen tint, a step further under the pointer, focused and
          // pressed; another looks hovered then, as `RadioGroup`'s segments do. Neither draws a ring.
          "focus-visible:outline-none",
          current
            ? "bg-active/40 hover:bg-active/60 focus-visible:bg-active/60 active:bg-active/60"
            : "group hover:bg-hover focus-visible:bg-hover active:bg-hover",
          // The label colour on the container too, which native ignores and web
          // reads: an element child passes through untouched below, so on web its
          // colour can only come from inheriting it here.
          ink,
          current ? undefined : CONTAINER_HOVER_INK,
          hasSlot(iconSlot) ? WITH_ICON : undefined,
          // The label's line is what gives a plain pill its height, and an icon is
          // shorter than it: with the label hidden the pill would shrink, so it
          // is held at the height a labelled pill beside it has.
          hasSlot(iconSlot) && group?.framed !== true ? "min-h-8" : undefined,
          className,
        )}
        {...(group?.framed ? {} : touchTarget(DRAWN))}
        {...props}
      >
        {/* Colour does not inherit on device, so the icon is handed the label's. */}
        {hasSlot(iconSlot) ? (
          <IconClassContext.Provider
            value={cn("size-4 shrink-0", ink, current ? undefined : HOVER_INK)}
          >
            {iconSlot}
          </IconClassContext.Provider>
        ) : null}
        {typeof children === "string" ? (
          <Text
            className={segmentedTextClass(
              current,
              labelHideBelow ? LABEL_HIDE_BELOW[labelHideBelow] : undefined,
            )}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    );
  },
);
SegmentedButton.displayName = "SegmentedButton";

export { SegmentedButton, SegmentedGroup };
