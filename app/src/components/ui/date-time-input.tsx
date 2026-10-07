import { format } from 'date-fns';
import { useId, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Button, buttonTextVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, X } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type DateTimeInputSharedProps = {
  /**
   * `"datetime"` (default) draws the time field beside the date. `"date"` drops
   * it: a picked day is committed at local midnight, which is what a due date or
   * a birthday is.
   */
  mode?: 'datetime' | 'date' | undefined;
  /** What the trigger reads while the value is `null`. Only reachable with `clearable`. */
  placeholder?: string | undefined;
  className?: string | undefined;
  /**
   * The trigger's id — what a `FieldLabel htmlFor` points at on the web. React Native takes `id`
   * as its `nativeID`, so on device it is a target for `aria-labelledby` rather than a label's.
   * A `<label for>` names the trigger by the label alone — the date is not in the name — so pass
   * `aria-labelledby` when the field has a label with an id.
   */
  id?: string | undefined;
  /**
   * The field's name. The trigger is named by it and the date after it — `"Due"` makes it
   * `"Due, September 15th, 2026"`, or `"Due, Pick a date"` while empty. In `"datetime"` mode
   * the time box is named after it too — `"Due, time"` — so two of these in one form are not
   * both "Time".
   */
  'aria-label'?: string | undefined;
  /**
   * The field's name by reference — the id of the `Label` above it. The trigger takes it followed
   * by a reference to its own date text, so it is named "Due September 15th, 2026". The time box
   * takes it followed by its own id, and its own `aria-label` of "time" is what that second
   * reference reads, so it is named "Due time".
   */
  'aria-labelledby'?: string | undefined;
  /** Web only, on the trigger: native has no description relation. A bound field's hint and error. */
  'aria-describedby'?: string | undefined;
  /** Web only, on the trigger. */
  'aria-invalid'?: boolean | 'true' | 'false' | undefined;
  /** Web only, on the trigger. */
  'aria-required'?: boolean | 'true' | 'false' | undefined;
};

/**
 * Discriminated on `clearable`, so `null` is only in the types of a caller that
 * asked for it: a `Date` and a `(next: Date) => void` still fit the default, and
 * a caller holding `Date | null` has to say `clearable` — which is also what
 * draws the Clear row that can hand it a `null`.
 */
export type DateTimeInputProps = DateTimeInputSharedProps &
  (
    | {
        clearable?: false | undefined;
        value: Date;
        onChange: (next: Date) => void;
      }
    | {
        /** The value may be empty: the trigger shows `placeholder`, and a Clear row commits `null`. */
        clearable: true;
        value: Date | null;
        onChange: (next: Date | null) => void;
      }
  );

export function DateTimeInput(props: DateTimeInputProps) {
  const {
    mode = 'datetime',
    placeholder = 'Pick a date',
    className,
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    'aria-required': ariaRequired,
  } = props;
  const value = props.value;
  const withTime = mode === 'datetime';
  const [open, setOpen] = useState(false);
  const timeId = useId();
  const valueId = useId();
  const valueText = value ? format(value, 'PPP') : placeholder;

  function commit(next: Date) {
    // Both branches take a `Date`; the union of their `onChange`s does not say so.
    (props.onChange as (next: Date) => void)(next);
  }

  function handleDateSelect(picked: Date | undefined) {
    if (!picked) return;
    const next = new Date(picked);
    if (withTime && value) {
      // The calendar only knows a day, so the time is carried over rather than
      // reset to midnight — picking a new date must not silently move the time.
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    } else {
      // A date-only value, or the first pick into an empty one, is the day at
      // local midnight — whatever clock the calendar handed back.
      next.setHours(0, 0, 0, 0);
    }
    commit(next);
    setOpen(false);
  }

  function handleTimeChange(text: string) {
    // A time with no date is not a value this control can hold, so it waits.
    if (!value) return;
    const parts = text.split(':').map(Number);
    const hh = parts[0];
    const mm = parts[1];
    if (hh === undefined || mm === undefined) return;
    if (Number.isNaN(hh) || Number.isNaN(mm)) return;
    const next = new Date(value);
    next.setHours(hh, mm, 0, 0);
    commit(next);
  }

  function handleClear() {
    if (props.clearable) props.onChange(null);
    setOpen(false);
  }

  return (
    <View className={cn('flex-row items-center gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={id}
            // A name on a button replaces its contents, so a bare "Due" would drop the date —
            // the part of the field that changes. Both are in the name instead: an `aria-label`
            // is composed with the value text, which iOS reads too, and a reference is followed
            // by one to the value text below. `htmlFor` alone cannot do this — see the skill.
            aria-label={ariaLabel ? `${ariaLabel}, ${valueText}` : undefined}
            aria-labelledby={ariaLabelledBy ? `${ariaLabelledBy} ${valueId}` : undefined}
            // What react-native has no prop for, in the spelling the web reads — the same
            // arrangement as `ColorPicker`'s swatch row. A bound field's hint and error reach
            // the trigger this way.
            {...(Platform.OS === 'web'
              ? {
                  ...(ariaDescribedBy === undefined ? {} : { 'aria-describedby': ariaDescribedBy }),
                  ...(ariaInvalid === undefined ? {} : { 'aria-invalid': ariaInvalid }),
                  ...(ariaRequired === undefined ? {} : { 'aria-required': ariaRequired }),
                }
              : {})}
            className="flex-1 justify-start text-left font-normal"
            iconSlot={<CalendarIcon className="mr-2 h-4 w-4" />}
            content={
              // Its own `Text` in both states, for the id a reference points at; and because
              // native has no colour inheritance, the placeholder's muted class has to be on
              // the words themselves.
              <Text
                nativeID={valueId}
                className={value ? buttonTextVariants({ variant: 'outline' }) : 'text-sm text-foreground/60'}
              >
                {valueText}
              </Text>
            }
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar selected={value ?? undefined} onSelect={handleDateSelect} defaultMonth={value ?? undefined} />
          {/* In the popover, not an X inside the trigger: the trigger is a button,
              and a button inside a button is invalid HTML that no keyboard reaches.
              `DatePicker` puts its Clear in the same place. */}
          {props.clearable && value ? (
            <View className="flex-row justify-end border-t border-foreground/10 p-1">
              <Button
                variant="outline"
                size="sm"
                onPress={handleClear}
                iconSlot={<X className="h-4 w-4" />}
                content="Clear"
              />
            </View>
          ) : null}
        </PopoverContent>
      </Popover>
      {withTime ? (
        <Input
          type="time"
          // Named after the field, so a form with a start and an end is not two boxes called
          // "Time". A reference names the box by pointing at the caller's label and then at the
          // box itself, whose own `aria-label` is what that second reference reads — so there is
          // no hidden text node to render. With no name given, it is "Time", as it always was.
          id={ariaLabelledBy ? timeId : undefined}
          aria-label={ariaLabelledBy ? 'time' : ariaLabel ? `${ariaLabel}, time` : 'Time'}
          aria-labelledby={ariaLabelledBy ? `${ariaLabelledBy} ${timeId}` : undefined}
          value={value ? format(value, 'HH:mm') : ''}
          onChangeText={handleTimeChange}
          disabled={!value}
          className="w-[120px]"
        />
      ) : null}
    </View>
  );
}
