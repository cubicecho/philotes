import type { ReactNode } from 'react';
import * as React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { cn, type SlotNode } from '@/lib/utils';

type Focusable = React.ElementRef<typeof Pressable>;

/** The web's key event, narrowed to the two members used — the same shape on both halves. */
type KeyEvent = { key: string; preventDefault: () => void };

type RadioGroupVariant = 'row' | 'card' | 'segmented';

type RadioGroupContextValue = {
  value: string | undefined;
  tabStop: string | undefined;
  disabled: boolean;
  invalid: boolean;
  variant: RadioGroupVariant;
  select: (value: string) => void;
  move: (from: string, event: KeyEvent) => void;
  register: (value: string, ref: React.RefObject<Focusable | null>, disabled: boolean) => void;
  unregister: (value: string) => void;
};

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

function useRadioGroup() {
  const context = React.useContext(RadioGroupContext);
  if (!context) throw new Error('RadioGroupItem must be used within <RadioGroup>');
  return context;
}

/** DOM order, where there is a DOM. On device there is no keyboard to need it. */
function byDocumentPosition(a: Focusable | null, b: Focusable | null) {
  const node = a as unknown as { compareDocumentPosition?: (other: unknown) => number } | null;
  if (!node?.compareDocumentPosition || !b) return 0;
  // `Node.DOCUMENT_POSITION_FOLLOWING`, spelled out: `Node` is not a global on device.
  return node.compareDocumentPosition(b) & 4 ? -1 : 1;
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
   * `segmented`: one framed, input-height row of equal segments, full width. Each segment shows
   * its `iconSlot`, its `label`, or both; an icon-only segment is named by its `aria-label`.
   */
  variant?: RadioGroupVariant | undefined;
  /**
   * How the options are laid out. Defaults to `vertical` for `row` and `horizontal` for `card`.
   * `segmented` is always one row and ignores it.
   */
  orientation?: 'vertical' | 'horizontal' | undefined;
  /** Whether the arrow keys wrap from the last option to the first. On by default. */
  loop?: boolean | undefined;
  id?: string | undefined;
  className?: string | undefined;
  children?: ReactNode;
  /** A group has no visible name of its own: name it with one of these two. */
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: boolean | undefined;
  'aria-required'?: boolean | undefined;
};

function RadioGroup({
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled = false,
  variant = 'row',
  orientation,
  loop = true,
  id,
  className,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}: RadioGroupProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  const value = valueProp !== undefined ? valueProp : uncontrolled;

  const refs = React.useRef(new Map<string, React.RefObject<Focusable | null>>());
  // Which options exist and whether each is disabled — state rather than a ref, because the tab
  // stop is derived from it and has to re-render when an option arrives.
  const [options, setOptions] = React.useState<ReadonlyMap<string, boolean>>(new Map());

  const register = React.useCallback(
    (option: string, ref: React.RefObject<Focusable | null>, optionDisabled: boolean) => {
      refs.current.set(option, ref);
      setOptions((prev) => {
        if (prev.get(option) === optionDisabled) return prev;
        const next = new Map(prev);
        next.set(option, optionDisabled);
        return next;
      });
    },
    [],
  );
  const unregister = React.useCallback((option: string) => {
    refs.current.delete(option);
    setOptions((prev) => {
      if (!prev.has(option)) return prev;
      const next = new Map(prev);
      next.delete(option);
      return next;
    });
  }, []);

  const enabled = () =>
    disabled
      ? []
      : [...options]
          .filter(([, optionDisabled]) => !optionDisabled)
          .map(([option]) => option)
          .sort((a, b) =>
            byDocumentPosition(refs.current.get(a)?.current ?? null, refs.current.get(b)?.current ?? null),
          );

  const select = (next: string) => {
    if (valueProp === undefined) setUncontrolled(next);
    if (next !== value) onValueChange?.(next);
  };

  const move = (from: string, event: KeyEvent) => {
    const order = enabled();
    const at = order.indexOf(from);
    const last = order.length - 1;
    let to: number;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      to = at < last ? at + 1 : loop ? 0 : at;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      to = at > 0 ? at - 1 : loop ? last : at;
    } else if (event.key === 'Home') {
      to = 0;
    } else if (event.key === 'End') {
      to = last;
    } else {
      return;
    }
    // Always, even at an end with `loop={false}`: an arrow key the group owns must not also
    // scroll the page.
    event.preventDefault();
    const target = order[to];
    if (target === undefined || target === from) return;
    refs.current.get(target)?.current?.focus();
    select(target);
  };

  const order = enabled();
  const tabStop = value !== undefined && order.includes(value) ? value : order[0];
  const horizontal = (orientation ?? (variant === 'card' ? 'horizontal' : 'vertical')) === 'horizontal';
  const layout =
    variant === 'segmented'
      ? cn(
          'h-10 w-full flex-row gap-1 rounded-md border bg-background p-1',
          ariaInvalid === true ? 'border-negative' : 'border-foreground/15',
        )
      : horizontal
        ? 'flex-row flex-wrap gap-3'
        : 'gap-3';

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
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        {...(ariaLabelledBy ? { 'aria-labelledby': ariaLabelledBy } : {})}
        {...(disabled ? { 'aria-disabled': true } : {})}
        // React Native has no prop for these three; react-native-web and the DOM read them.
        {...(Platform.OS === 'web'
          ? {
              'aria-describedby': ariaDescribedBy,
              'aria-invalid': ariaInvalid,
              'aria-required': ariaRequired,
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
   * `row`. On device an icon has no `currentColor` to inherit, so in `segmented` give it the
   * checked segment's `text-active-foreground` and the others' `text-foreground/60` yourself.
   */
  iconSlot?: SlotNode | undefined;
  /**
   * A hover hint — the web's `title` — and the accessibility hint on device. For the one extra
   * sentence a tile has no room for; say anything a user needs to choose in `description`.
   *
   * An icon-only `segmented` option with no `hint` uses its `aria-label` as the web tooltip, so the
   * name a screen reader hears is also what a pointer sees on hover. Device has no hover, so there
   * it is the name alone, with no hint repeating it.
   */
  hint?: string | undefined;
  /** The DOM's name for `hint`, accepted so a shadcn call site ports unchanged. `hint` wins. */
  title?: string | undefined;
  disabled?: boolean | undefined;
  /** The option's own id — what a `<Label htmlFor>` points at when `label` is left out. */
  id?: string | undefined;
  className?: string | undefined;
  'aria-label'?: string | undefined;
  'aria-describedby'?: string | undefined;
};

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
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedByProp,
}: RadioGroupItemProps) {
  const hint = hintProp ?? title;
  const group = useRadioGroup();
  const ref = React.useRef<Focusable>(null);
  const uid = React.useId();
  const labelId = `${uid}-label`;
  const descriptionId = `${uid}-description`;

  const { register, unregister } = group;
  React.useEffect(() => {
    register(value, ref, itemDisabled);
  }, [register, value, itemDisabled]);
  React.useEffect(() => () => unregister(value), [unregister, value]);

  const checked = group.value === value;
  const disabled = group.disabled || itemDisabled;
  const card = group.variant === 'card';
  const segmented = group.variant === 'segmented';
  // The bare circle is for a caller's own `<Label>`; a segment is never one.
  const bare = label === undefined && !segmented;
  const tooltip = hint ?? (segmented && label === undefined ? ariaLabel : undefined);
  // A segment has no room for a description and draws none, so it points at none either.
  const describedBy =
    [description && !segmented ? descriptionId : null, ariaDescribedByProp ?? null].filter(Boolean).join(' ') ||
    undefined;

  const circle = (
    <View
      className={cn(
        'h-4 w-4 shrink-0 items-center justify-center rounded-full border',
        checked ? 'border-active' : 'border-foreground/15',
        group.invalid && 'border-negative',
      )}
    >
      {checked ? <View className="h-2 w-2 rounded-full bg-active" /> : null}
    </View>
  );

  return (
    <Pressable
      ref={ref}
      testID="radio-group-item"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onPress={() => group.select(value)}
      {...(id ? { id } : {})}
      {...(label ? { 'aria-labelledby': labelId } : {})}
      {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
      accessibilityHint={hint}
      {...(Platform.OS === 'web'
        ? {
            tabIndex: group.tabStop === value ? (0 as const) : (-1 as const),
            onKeyDown: (event: KeyEvent) => group.move(value, event),
            'aria-describedby': describedBy,
            title: tooltip,
          }
        : {})}
      className={cn(
        'focus-visible:outline-none',
        bare
          ? 'rounded-full focus-visible:bg-hover'
          : segmented
            ? cn(
                'min-w-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-sm px-3',
                checked
                  ? 'bg-active text-active-foreground focus-visible:bg-active/90'
                  : 'text-foreground/60 hover:bg-hover hover:text-foreground focus-visible:bg-hover focus-visible:text-foreground',
              )
            : card
              ? cn(
                  'min-w-0 flex-1 items-center gap-1.5 rounded-lg border p-3',
                  // The border alone says checked: a tinted fill takes the muted description under 4.5:1.
                  checked ? 'border-active bg-background' : 'border-foreground/15 bg-background',
                  'focus-visible:bg-hover',
                  group.invalid && 'border-negative',
                )
              : 'flex-row items-start gap-3 rounded-sm focus-visible:bg-hover',
        disabled && 'opacity-50',
        className,
      )}
    >
      {bare ? (
        circle
      ) : segmented ? (
        <>
          {iconSlot ? <View className="items-center justify-center">{iconSlot}</View> : null}
          {label !== undefined ? (
            <Text
              id={labelId}
              className={cn('truncate text-sm font-medium', checked ? 'text-active-foreground' : 'text-foreground/60')}
            >
              {label}
            </Text>
          ) : null}
        </>
      ) : card ? (
        <>
          {iconSlot ? <View className="items-center justify-center">{iconSlot}</View> : null}
          <Text id={labelId} className="text-center text-foreground text-sm font-medium">
            {label}
          </Text>
          {description ? (
            <Text id={descriptionId} className="text-center text-foreground/60 text-xs">
              {description}
            </Text>
          ) : null}
        </>
      ) : (
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
      )}
    </Pressable>
  );
}

export type { RadioGroupItemProps, RadioGroupProps };
export { RadioGroup, RadioGroupItem };
