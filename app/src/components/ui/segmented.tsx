import type { ReactNode } from 'react';
import * as React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { IconClassContext } from '@/components/ui/icons-base';
import { cn, type SlotNode } from '@/lib/utils';

/**
 * The container class, for a pill the caller renders itself.
 *
 * `hover:` and `transition-colors` are no-ops on device and real on web, which
 * is the intended asymmetry: a pointer exists on one platform and not the other.
 */
export function segmentedItemClass(active: boolean, className?: string) {
  return cn(
    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
    active ? 'bg-active text-active-foreground' : 'text-foreground/60 hover:bg-hover hover:text-foreground',
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
  return cn('text-sm font-medium', active ? 'text-active-foreground' : 'text-foreground/60', className);
}

/**
 * Where a pill with an `iconSlot` stops drawing its label: at every width, or under
 * one. `inline` on the web and `flex` on device are the display each platform's
 * text has when it is not hidden.
 */
const LABEL_HIDE_BELOW = {
  always: 'hidden',
  sm: Platform.select({ web: 'hidden sm:inline', default: 'hidden sm:flex' }),
  md: Platform.select({ web: 'hidden md:inline', default: 'hidden md:flex' }),
  lg: Platform.select({ web: 'hidden lg:inline', default: 'hidden lg:flex' }),
  xl: Platform.select({ web: 'hidden xl:inline', default: 'hidden xl:flex' }),
} as const;

/**
 * A pill with an icon is a row. The web half's icon sizes from here, as a
 * `Button`'s does; device's from the `IconClassContext` the pill publishes.
 */
const WITH_ICON = cn(
  'flex-row items-center gap-1.5',
  Platform.select({
    web: '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
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
 * The row's two looks. `framed` is an input-height box, so a segmented control
 * beside a select or an input lines up with it; `plain` is the pills on the
 * page with nothing round them, for a toolbar or a nav bar.
 */
const SEGMENTED_GROUP_VARIANTS = {
  framed: 'h-10 rounded-md border border-foreground/15 bg-background p-1',
  plain: '',
} as const;

export type SegmentedGroupProps = Omit<
  React.ComponentProps<typeof View>,
  'children' | 'className' | 'style' | 'role'
> & {
  /**
   * The current pill's `value`. With it, a `SegmentedButton value="week"` works
   * out whether it is current, so no pill needs `active={x === value}`.
   */
  value?: string | undefined;
  /** Called with a pill's `value` when it is pressed. */
  onValueChange?: ((value: string) => void) | undefined;
  /** `framed` (the default) draws the input-height box; `plain` draws the row alone. */
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
  'aria-label'?: string | undefined;
  /** The id of a visible heading that names the group, in place of `aria-label`. */
  'aria-labelledby'?: string | undefined;
  className?: string | undefined;
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
 */
const SegmentedGroup = React.forwardRef<React.ElementRef<typeof View>, SegmentedGroupProps>(
  ({ value, onValueChange, variant = 'framed', labelHideBelow, className, children, ...props }, ref) => {
    const framed = variant === 'framed';
    const context = React.useMemo(
      () => ({ value, onValueChange, framed, labelHideBelow }),
      [value, onValueChange, framed, labelHideBelow],
    );
    return (
      <SegmentedGroupContext.Provider value={context}>
        <View
          ref={ref}
          role="group"
          className={cn(
            'flex-row items-center gap-1 self-start',
            // A flex container is block-level on the web and would stretch the
            // frame across the page; on device `self-start` already hugs it.
            Platform.select({ web: 'w-fit', default: undefined }),
            SEGMENTED_GROUP_VARIANTS[variant],
            className,
          )}
          {...props}
        >
          {children}
        </View>
      </SegmentedGroupContext.Provider>
    );
  },
);
SegmentedGroup.displayName = 'SegmentedGroup';

export type SegmentedButtonProps = Omit<React.ComponentProps<typeof Pressable>, 'children' | 'className' | 'style'> & {
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
    const ink = current ? 'text-active-foreground' : 'text-foreground/60';
    // Only a pill with an icon has something left to draw once its label is gone.
    const labelHideBelow = iconSlot ? group?.labelHideBelow : undefined;
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
        {...(Platform.OS === 'web' ? ({ 'aria-pressed': current } as const) : {})}
        // A label that is not drawn is not read either, on either platform, so
        // the pill is named by the same string. Before `props`, so a caller's own
        // `aria-label` still wins.
        {...(labelHideBelow && typeof children === 'string' ? { 'aria-label': children } : {})}
        onPress={(event) => {
          if (group && value !== undefined) group.onValueChange?.(value);
          onPress?.(event);
        }}
        className={cn(
          // Inside the frame a pill is 4px shorter, so it fits the input-height
          // box instead of spilling past its padding.
          group?.framed ? 'rounded-md px-3 py-1' : 'rounded-md px-3 py-1.5',
          current ? 'bg-active' : 'hover:bg-hover',
          // The label colour on the container too, which native ignores and web
          // reads: an element child passes through untouched below, so on web its
          // colour can only come from inheriting it here.
          ink,
          iconSlot ? WITH_ICON : undefined,
          // The label's line is what gives a pill its height, and an icon is
          // shorter than it: with the label hidden the pill would shrink, so it
          // is held at the height a labelled pill beside it has.
          iconSlot ? (group?.framed ? 'min-h-7' : 'min-h-8') : undefined,
          className,
        )}
        {...props}
      >
        {/* Colour does not inherit on device, so the icon is handed the label's. */}
        {iconSlot ? (
          <IconClassContext.Provider value={cn('size-4 shrink-0', ink)}>{iconSlot}</IconClassContext.Provider>
        ) : null}
        {typeof children === 'string' ? (
          <Text className={segmentedTextClass(current, labelHideBelow ? LABEL_HIDE_BELOW[labelHideBelow] : undefined)}>
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    );
  },
);
SegmentedButton.displayName = 'SegmentedButton';

export { SegmentedButton, SegmentedGroup };
