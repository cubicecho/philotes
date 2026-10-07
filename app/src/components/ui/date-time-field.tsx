import { DateTimeInput } from '@/components/ui/date-time-input';
import { type FieldProps, FieldWrapper, splitProps, useFieldContext } from '@/components/ui/form';

type DateTimeFieldProps = FieldProps & {
  /** `"datetime"` (default) draws the time box beside the date; `"date"` is a day at midnight. */
  mode?: 'datetime' | 'date' | undefined;
  /** Draws a Clear row in the popover, which writes `null`. */
  clearable?: boolean | undefined;
  /** What the trigger reads while the value is `null`. */
  placeholder?: string | undefined;
};

export function DateTimeField(props: DateTimeFieldProps) {
  const [fieldProps, { mode, clearable = false, placeholder }] = splitProps(props);
  const field = useFieldContext<Date | null>();
  const value = field.state.value ?? null;

  function commit(next: Date | null) {
    field.handleChange(next);
    // Picking a day is the whole interaction, and it happens in a popover, so nothing blurs the
    // trigger on the way — this is what marks the field touched.
    field.handleBlur();
  }

  // `DateTimeInput` only takes `null` when it is `clearable`. An empty field that did not ask for
  // Clear still has to show its placeholder, so it goes through the clearable branch while it is
  // empty — which draws no Clear row, because there is nothing to clear.
  const control =
    clearable || value === null ? (
      <DateTimeInput mode={mode} placeholder={placeholder} clearable value={value} onChange={commit} />
    ) : (
      <DateTimeInput mode={mode} placeholder={placeholder} value={value} onChange={commit} />
    );

  return <FieldWrapper asGroup {...fieldProps} controlSlot={control} />;
}

export type { DateTimeFieldProps };
