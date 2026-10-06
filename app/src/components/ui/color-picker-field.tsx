import type { ComponentProps } from 'react';
import { ColorPicker } from '@/components/ui/color-picker';
import { type FieldProps, FieldWrapper, splitProps, useFieldContext, useFieldIds } from '@/components/ui/form';

type ColorFieldProps = FieldProps &
  Omit<
    ComponentProps<typeof ColorPicker>,
    // Both setters: the picker takes `onChange` and its alias `onValueChange`, and the field
    // supplies the value, so a caller's own would only be overwritten.
    | 'id'
    | 'value'
    | 'onValueChange'
    | 'onChange'
    | 'onBlur'
    | 'className'
    | 'aria-describedby'
    | 'aria-invalid'
    | 'aria-required'
  >;

/** The picker, reading the label's id for its swatch row. Inside the `Field`, where the id is. */
function ColorFieldControl(control: Omit<ColorFieldProps, keyof FieldProps>) {
  const field = useFieldContext<string | null>();
  const { labelId } = useFieldIds();
  return (
    <ColorPicker
      {...control}
      // The row points back at the label unless the caller named it some other way.
      aria-labelledby={
        control['aria-labelledby'] ??
        (control['aria-label'] === undefined && control.swatchesLabel === undefined ? labelId : undefined)
      }
      value={field.state.value ?? ''}
      onChange={(next: string) => {
        field.handleChange(next);
        // Choosing a swatch is the whole interaction, and a swatch press is not a blur of the hex
        // box, so nothing else would tell the field it was touched.
        field.handleBlur();
      }}
      onBlur={field.handleBlur}
    />
  );
}

export function ColorField(props: ColorFieldProps) {
  const [fieldProps, control] = splitProps(props);
  return <FieldWrapper {...fieldProps} controlSlot={<ColorFieldControl {...control} />} />;
}

export type { ColorFieldProps };
