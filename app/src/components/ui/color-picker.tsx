import { useId, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { readableTextColor } from '@/lib/readable-text-color';
import { cn } from '@/lib/utils';

/**
 * A palette wide enough to look chosen from rather than settled for.
 *
 * These are Tailwind's 500s. They are only a default: an app whose colours mean
 * something — a calendar's activity types, a tag taxonomy — passes its own list,
 * and that is the common case.
 */
export const COLOR_SWATCHES = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
] as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * A typed colour with its `#` put back, and nothing else changed.
 *
 * People paste `2563eb` out of a design tool and type `#2563EB` from memory, and both are
 * the colour they meant. Case is left alone on purpose: the value goes to a database, and a
 * picker that silently rewrites `#2563EB` to `#2563eb` shows up as a dirty form and an
 * audit-log entry for an edit nobody made.
 */
export function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/**
 * Whether a string is a `#rgb` or `#rrggbb` colour.
 *
 * No `#rgba`/`#rrggbbaa`: a swatch is opaque, and an alpha channel nothing here can show is a
 * colour the picker would accept and then draw wrong.
 */
export function isHexColor(value: string): boolean {
  return HEX.test(value);
}

/** `#f80` and `#FF8800` are one colour. Shorthand doubles each digit; it does not pad. */
function expand(value: string): string {
  const digits = value.replace('#', '').toLowerCase();
  return digits.length === 3
    ? digits
        .split('')
        .map((digit) => digit + digit)
        .join('')
    : digits;
}

/** Whether two strings are the same colour, however each was spelled. */
function sameColor(a: string, b: string): boolean {
  return isHexColor(a) && isHexColor(b) && expand(a) === expand(b);
}

/**
 * The props, in this registry's vocabulary and in the one cubeui's popover picker shipped with
 * on `main`, so a call site written against either compiles. The aliases are exactly that —
 * `onValueChange` is `onChange`, `swatches` is `colors` — and the popover-only labels
 * (`popoverLabel`, `customLabel`) are accepted and ignored, because this control has no popover
 * to name and no OS colour well to label.
 */
type ColorPickerProps = {
  /**
   * The colour, as `#rgb`/`#rrggbb`. `null` and `""` are both "no colour".
   *
   * The hex box only ever hands back one of those, or `""`: what is typed there is a draft until it
   * is a whole colour, gets its `#` put back if it was typed without one, and keeps its case.
   */
  value?: string | null | undefined;
  /** Called with the colour picked or typed; `""` when cleared. */
  onChange?: ((color: string) => void) | undefined;
  /** `onChange`, under the name shadcn and `main`'s picker use. Both are called when both are given. */
  onValueChange?: ((color: string) => void) | undefined;
  onBlur?: (() => void) | undefined;
  /** Swatches to offer. Defaults to `COLOR_SWATCHES`. */
  colors?: readonly string[] | undefined;
  /** `colors`, under `main`'s name. `colors` wins when both are given. */
  swatches?: readonly string[] | undefined;
  /** The hex field's placeholder. A format hint by default, for the reason given at the field. */
  placeholder?: string | undefined;
  /**
   * The hex field's accessible name, drawn only for a screen reader. Web only: it is a `<label>`
   * pointed at the field, and native has no label/control association to make.
   */
  hexLabel?: string | undefined;
  /** The swatch row's accessible name, when `aria-label` does not already give one. */
  swatchesLabel?: string | undefined;
  /** Draws a Clear button, which sets the value to `""`, while there is a value. */
  clearable?: boolean | undefined;
  /** The Clear button's text. */
  clearLabel?: string | undefined;
  /** Blocks the swatches, the hex field and Clear. */
  disabled?: boolean | undefined;
  className?: string | undefined;
  /** The swatch row's class — the nearest thing here to `main`'s popover content. */
  contentClassName?: string | undefined;
  /** Accepted for `main`'s API and ignored: there is no popover to name. */
  popoverLabel?: string | undefined;
  /** Accepted for `main`'s API and ignored: there is no OS colour well to label. */
  customLabel?: string | undefined;
  /** The hex field's id — what a field's `<Label htmlFor>` points at. */
  id?: string | undefined;
  /** The swatch row's name. */
  'aria-label'?: string | undefined;
  /** The swatch row's name, by reference. */
  'aria-labelledby'?: string | undefined;
  /** Web only, on the swatch row: native has no description relation. */
  'aria-describedby'?: string | undefined;
  /** Web only, on the swatch row. */
  'aria-invalid'?: boolean | 'true' | 'false' | undefined;
  /** Web only, on the swatch row. */
  'aria-required'?: boolean | 'true' | 'false' | undefined;
};

export function ColorPicker({
  value,
  onChange,
  onValueChange,
  onBlur,
  colors,
  swatches,
  placeholder = '#rrggbb',
  hexLabel,
  swatchesLabel,
  clearable = false,
  clearLabel = 'Clear',
  disabled = false,
  className,
  contentClassName,
  id,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  'aria-required': ariaRequired,
}: ColorPickerProps) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const current = value ?? '';
  const palette = colors ?? swatches ?? COLOR_SWATCHES;
  const groupLabel = ariaLabel ?? swatchesLabel;
  const emit = (color: string) => {
    onChange?.(color);
    onValueChange?.(color);
  };

  // The hex box's own text. It is not `value`: `#fffaa` is on its way to a colour, not one, and a
  // box bound straight to `value` either hands that to the caller — a form saves it, a swatch
  // background draws nothing — or snaps back on every keystroke that is not yet a colour.
  const [draft, setDraft] = useState(current);
  // Adopt a value that arrives from outside — a swatch, Clear, a form reset — unless it is the
  // colour already typed, in whatever spelling it was typed.
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    const typed = normalizeHex(draft);
    if (typed !== current && !sameColor(typed, current)) setDraft(current);
  }

  const onChangeText = (text: string) => {
    setDraft(text);
    const typed = normalizeHex(text);
    // Emptying the box is an answer — the same "no colour" Clear gives — and a whole colour is
    // one. Everything between is a draft, and stays in the box.
    if ((typed === '' || isHexColor(typed)) && typed !== current) emit(typed);
  };

  return (
    <View className={cn('gap-3', className)}>
      {/*
        The group the swatches are radios *of*. A `radio` with no `radiogroup` around it is an
        incomplete control to an assistive technology and an axe violation on web, and the role
        is the same word on both platforms.
      */}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={groupLabel}
        accessibilityLabelledBy={ariaLabelledBy}
        // What react-native has no prop for, in the spelling the web reads.
        {...(Platform.OS === 'web'
          ? {
              ...(ariaDescribedBy === undefined ? {} : { 'aria-describedby': ariaDescribedBy }),
              ...(ariaInvalid === undefined ? {} : { 'aria-invalid': ariaInvalid }),
              ...(ariaRequired === undefined ? {} : { 'aria-required': ariaRequired }),
              ...(disabled ? { 'aria-disabled': true } : {}),
            }
          : {})}
        className={cn('flex-row flex-wrap gap-2', disabled && 'opacity-50', contentClassName)}
      >
        {palette.map((color) => {
          const selected = sameColor(current, color);
          return (
            <Pressable
              key={color}
              onPress={() => emit(color)}
              disabled={disabled}
              // A swatch row is a radio group: one of the set is current, and
              // the label is the colour itself, which nothing else conveys.
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              // The same fact in the spelling the web understands — react-native-web forwards an
              // allowlist of `aria-*` props and ignores `accessibilityState` entirely. A radio
              // says its state with `aria-checked`, not `aria-selected`.
              {...(Platform.OS === 'web' ? ({ 'aria-checked': selected } as const) : {})}
              accessibilityLabel={color}
              className={cn(
                'h-9 w-9 items-center justify-center rounded-full border-2',
                selected ? 'border-foreground' : 'border-transparent',
              )}
              style={{ backgroundColor: color }}
            >
              {selected ? (
                // The tick has to be legible on whatever the caller passed, and
                // a caller's palette is not known here — a hardcoded white one
                // disappears on `#eab308`.
                <Text className="text-base leading-none" style={{ color: readableTextColor(color) ?? '#ffffff' }}>
                  ✓
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {/*
        The hex field's own name, for a screen reader only. It is a `<label>` pointed at the field
        because `Input` takes no `aria-label`; on native there is no label/control association to
        make, so nothing is drawn there.
      */}
      {Platform.OS === 'web' && hexLabel ? (
        <Label htmlFor={inputId} className="sr-only">
          {hexLabel}
        </Label>
      ) : null}
      <View className="flex-row items-center gap-2">
        <Input
          id={inputId}
          // A format hint rather than a colour by default: the field's job is the colour that
          // is *not* in the row above, so showing one of them would mislead.
          placeholder={placeholder}
          value={draft}
          onChangeText={onChangeText}
          onBlur={() => {
            // A draft left unfinished is not the value, so the box stops claiming it is; a colour
            // typed without its `#` gets it back, so the box reads as what was saved.
            setDraft(current);
            onBlur?.();
          }}
          // Room for a pasted `#rrggbb` with the spaces a design tool copies around it, which
          // `normalizeHex` trims.
          maxLength={9}
          disabled={disabled}
          className="flex-1 font-mono"
        />
        {clearable && current ? (
          <Button variant="outline" size="sm" disabled={disabled} onPress={() => emit('')} content={clearLabel} />
        ) : null}
      </View>
    </View>
  );
}
