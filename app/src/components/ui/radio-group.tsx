import type { ReactNode } from "react";
import * as React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { IconClassContext } from "@/components/ui/icons-base";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type RovingKeyEvent,
  type RovingSet,
  useRovingFocus,
  useRovingItem,
} from "@/lib/roving-focus";
import { cn, hasSlot, type SlotNode, touchRowClass, touchTarget } from "@/lib/utils";

/**
 * What the bare circle is drawn at, grown to a finger's 44pt by a `hitSlop` on device (#470). A
 * row is stacked against the next and a segment sits beside one, so each is made 44pt tall itself
 * instead, and a card is bigger already.
 */
const DRAWN = { width: 16, height: 16 } as const;

type Focusable = React.ElementRef<typeof Pressable>;

type RadioGroupVariant = "row" | "card" | "segmented";

type RadioGroupContextValue = RovingSet & {
  value: string | undefined;
  tabStop: string | undefined;
  disabled: boolean;
  invalid: boolean;
  variant: RadioGroupVariant;
  select: (value: string) => void;
  move: (from: string, event: RovingKeyEvent) => void;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

function useRadioGroup() {
  const context = React.useContext(RadioGroupContext);
  if (!context) {
    throw new Error("RadioGroupItem must be used within <RadioGroup>");
  }
  return context;
}

type RadioGroupProps = {
  /** The checked option's value. Pass it with `onValueChange` for a controlled group. */
  value?: string | undefined;
  /** The option checked on first render, for an uncontrolled group. */
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  disabled?: boolean | undefined;
  /**
   * `row` (the default): a circle, a label and an optional description per option, stacked.
   * `card`: a bordered tile per option, icon over label, sharing a row.
   * `segmented`: one framed, input-height row of equal segments. Each segment shows its
   * `iconSlot`, its `label`, or both; an icon-only segment is named by its `aria-label`. It is as
   * wide as a column it is stacked in, and as wide as its segments in a row of other things — a
   * header bar — where `className="flex-1"` makes it take what the row has left.
   */
  variant?: RadioGroupVariant | undefined;
  /**
   * How the options are laid out. Defaults to `vertical` for `row` and `horizontal` for `card`.
   * `segmented` is always one row and ignores it.
   */
  orientation?: "vertical" | "horizontal" | undefined;
  /** Whether the arrow keys wrap from the last option to the first. On by default. */
  loop?: boolean | undefined;
  id?: string | undefined;
  className?: string | undefined;
  children?: ReactNode;
  /** A group has no visible name of its own: name it with one of these two. */
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean | undefined;
  "aria-required"?: boolean | undefined;
};

/** A set of options of which one is chosen, with one tab stop and arrow keys. */
function RadioGroup({
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled = false,
  variant = "row",
  orientation,
  loop = true,
  id,
  className,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
}: RadioGroupProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const value = valueProp !== undefined ? valueProp : uncontrolled;

  const select = (next: string) => {
    if (valueProp === undefined) {
      setUncontrolled(next);
    }
    if (next !== value) {
      onValueChange?.(next);
    }
  };
  const { tabStop, register, unregister, move } = useRovingFocus({
    current: value,
    onMove: select,
    disabled,
    loop,
  });
  const horizontal =
    (orientation ?? (variant === "card" ? "horizontal" : "vertical")) === "horizontal";
  const stacked = horizontal ? "flex-row flex-wrap gap-3" : "gap-3";
  const layout =
    variant === "segmented"
      ? cn(
          // `self-stretch`, not `w-full`: in a row that is sized by its content, a browser
          // measures a percentage width as the content's and then resolves it against the total,
          // which pushed the group's neighbours out of the row by their own width.
          // No height of its own: a frame round segments as tall as an input, as a `TabsList` is
          // round its tabs, so the two are one height side by side (#537).
          "self-stretch flex-row gap-1 rounded-md border bg-background p-1",
          ariaInvalid === true ? "border-negative" : "border-foreground/50",
        )
      : stacked;

  return (
    <RadioGroupContext.Provider
      value={{
        value,
        tabStop,
        disabled,
        invalid: ariaInvalid === true,
        variant,
        select,
        move,
        register,
        unregister,
      }}
    >
      <View
        role="radiogroup"
        testID="radio-group"
        {...(id ? { id } : {})}
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
        {...(ariaLabelledBy ? { "aria-labelledby": ariaLabelledBy } : {})}
        {...(disabled ? { "aria-disabled": true } : {})}
        // React Native has no prop for these three; react-native-web and the DOM read them.
        {...(Platform.OS === "web"
          ? {
              "aria-describedby": ariaDescribedBy,
              "aria-invalid": ariaInvalid,
              "aria-required": ariaRequired,
            }
          : {})}
        className={cn(layout, className)}
      >
        {children}
      </View>
    </RadioGroupContext.Provider>
  );
}

type RadioGroupItemProps = {
  value: string;
  /** The option's name. Left out, the item is the bare circle, for a caller's own `<Label>`. */
  label?: ReactNode | undefined;
  /** A line under the label: what picking this one means. Not drawn by `segmented`. */
  description?: ReactNode | undefined;
  /**
   * The picture over the label in a `card` tile, or the segment's face in `segmented`. Ignored by
   * `row`. In `segmented` a bare glyph is sized and inked by the segment, on both halves: the
   * checked one's label colour, and the others' quieter one.
   */
  iconSlot?: SlotNode | undefined;
  /**
   * The one extra sentence a tile has no room for: the option's tooltip, on hover and focus on the
   * web and on a long press on device, and read after its name whether or not the tooltip is open.
   * Say anything a user needs to choose in `description`.
   *
   * An icon-only `segmented` option with no `hint` shows its `aria-label` as the tooltip, so the
   * name a screen reader hears is also what a pointer sees. It is not also the description, which
   * would read the name twice.
   */
  hint?: string | undefined;
  /** The DOM's name for `hint`, accepted so a shadcn call site ports unchanged. `hint` wins. */
  title?: string | undefined;
  disabled?: boolean | undefined;
  /** The option's own id — what a `<Label htmlFor>` points at when `label` is left out. */
  id?: string | undefined;
  className?: string | undefined;
  "aria-label"?: string | undefined;
  "aria-describedby"?: string | undefined;
};

/** One option in a `RadioGroup`. */
function RadioGroupItem({
  value,
  label,
  description,
  iconSlot,
  hint: hintProp,
  title,
  disabled: itemDisabled = false,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedByProp,
}: RadioGroupItemProps) {
  const hint = hintProp ?? title;
  const group = useRadioGroup();
  const ref = useRovingItem<Focusable>(group, value, itemDisabled);
  const uid = React.useId();
  const labelId = `${uid}-label`;
  const descriptionId = `${uid}-description`;
  const hintId = `${uid}-hint`;

  const checked = group.value === value;
  const disabled = group.disabled || itemDisabled;
  const card = group.variant === "card";
  const segmented = group.variant === "segmented";
  // The bare circle is for a caller's own `<Label>`; a segment is never one.
  const bare = label === undefined && segmented === false;
  const tooltip = hint ?? (segmented && label === undefined ? ariaLabel : undefined);
  // A segment has no room for a description and draws none, so it points at none either. The hint
  // is read last, after what the option says about itself.
  const describedBy =
    [
      description && segmented === false ? descriptionId : null,
      ariaDescribedByProp ?? null,
      hint ? hintId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  // Checked, the circle is the chosen tint, edged in `active` because the tint is not 3:1 from the
  // surface, and its dot is `foreground`, 3:1 or more on the tint and around it.
  const circle = (
    <View
      className={cn(
        "h-4 w-4 shrink-0 items-center justify-center rounded-full border",
        checked ? "border-active bg-active/40" : "border-foreground/50",
        group.invalid && "border-negative",
      )}
    >
      {checked ? <View className="h-2 w-2 rounded-full bg-foreground" /> : null}
    </View>
  );

  const segmentInk = checked ? "text-foreground" : "text-foreground/60";

  // The item's box, one shape per variant.
  const look = () => {
    if (bare) {
      return "rounded-full focus-visible:bg-hover";
    }
    if (segmented) {
      return cn(
        // A tab's height: 30px on the web, so the frame is 40px, an `Input`'s height, and 44pt on
        // device, where it is that tall itself rather than by a `hitSlop`, as a tab is.
        "min-w-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-sm px-3",
        Platform.OS === "web" ? "h-7.5" : "h-10",
        touchRowClass(),
        // The checked segment is the chosen tint, a step further under the pointer and focused.
        checked
          ? "bg-active/40 text-foreground hover:bg-active/60 focus-visible:bg-active/60"
          : "text-foreground/60 hover:bg-hover hover:text-foreground focus-visible:bg-hover focus-visible:text-foreground",
      );
    }
    if (card) {
      return cn(
        "min-w-0 flex-1 items-center gap-1.5 rounded-lg border p-3",
        // Checked is the chosen tint inside an `active` edge, a step further under the pointer and
        // focused; its description turns `foreground`, as muted text on the tint is under 4.5:1.
        checked
          ? "border-active bg-active/40 hover:bg-active/60 focus-visible:bg-active/60"
          : "border-foreground/50 bg-background hover:bg-hover focus-visible:bg-hover",
        group.invalid && "border-negative",
      );
    }
    // The fill reaches past the circle and the words, by as much as it is drawn out from them
    // (`-mx-2 -my-1.5`), so the row still lines up with what is above it. Hovered as focused. On
    // device the row is 44pt tall, and a label alone sits in the middle of it.
    return cn(
      "-mx-2 -my-1.5 flex-row items-start gap-3 rounded-sm px-2 py-1.5 hover:bg-hover focus-visible:bg-hover",
      touchRowClass(),
      Platform.OS !== "web" && description === undefined && "items-center",
    );
  };

  // What the box holds, in the same order.
  const content = () => {
    if (bare) {
      return circle;
    }
    if (segmented) {
      return (
        <>
          {hasSlot(iconSlot) ? (
            // Colour does not inherit on device, so the glyph is handed the label's ink, as a
            // `SegmentedButton`'s is; on the web it takes `currentColor` from the segment.
            <IconClassContext.Provider value={cn("size-4 shrink-0", segmentInk)}>
              <View className="items-center justify-center">{iconSlot}</View>
            </IconClassContext.Provider>
          ) : null}
          {label !== undefined ? (
            <Text id={labelId} className={cn("truncate text-sm font-semibold", segmentInk)}>
              {label}
            </Text>
          ) : null}
        </>
      );
    }
    if (card) {
      return (
        <>
          {hasSlot(iconSlot) ? (
            <View className="items-center justify-center">{iconSlot}</View>
          ) : null}
          {/* The radio's own dot beside the label: a 1px edge in another colour was the only
              thing that said which card was chosen, and colour is not to be the only signal. */}
          <View className="min-w-0 flex-row items-center justify-center gap-2">
            {circle}
            <Text id={labelId} className="text-center text-foreground text-sm font-semibold">
              {label}
            </Text>
          </View>
          {description ? (
            <Text
              id={descriptionId}
              className={cn(
                "text-center text-xs",
                checked ? "text-foreground" : "text-foreground/60",
              )}
            >
              {description}
            </Text>
          ) : null}
        </>
      );
    }
    return (
      <>
        <View className="mt-0.5">{circle}</View>
        <View className="min-w-0 flex-1 gap-1">
          <Text id={labelId} className="text-foreground text-sm">
            {label}
          </Text>
          {description ? (
            <Text id={descriptionId} className="text-foreground/60 text-sm">
              {description}
            </Text>
          ) : null}
        </View>
      </>
    );
  };

  const option = (
    <Pressable
      ref={ref}
      testID="radio-group-item"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onPress={() => group.select(value)}
      {...(id ? { id } : {})}
      {...(label ? { "aria-labelledby": labelId } : {})}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
      accessibilityHint={hint}
      {...(Platform.OS === "web"
        ? {
            tabIndex: group.tabStop === value ? (0 as const) : (-1 as const),
            onKeyDown: (event: RovingKeyEvent) => group.move(value, event),
            "aria-describedby": describedBy,
          }
        : {})}
      className={cn("focus-visible:outline-none", look(), disabled && "opacity-50", className)}
      {...(bare ? touchTarget(DRAWN) : {})}
    >
      {content()}
    </Pressable>
  );

  if (!tooltip) {
    return option;
  }
  // A `Tooltip`, not the web's `title` attribute, which a touch screen and a keyboard never show.
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>{option}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
      {/* What `aria-describedby` points at on the web; the tooltip is in the DOM only while it is
          up. A device reads the hint as the accessibility hint instead. */}
      {Platform.OS === "web" && hint ? (
        <Text nativeID={hintId} className="sr-only text-foreground">
          {hint}
        </Text>
      ) : null}
    </>
  );
}

export type { RadioGroupItemProps, RadioGroupProps };
export { RadioGroup, RadioGroupItem };
