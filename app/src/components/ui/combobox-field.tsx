import { useCallback, useMemo, useRef } from "react";
import {
  Combobox,
  type ComboboxMultipleProps,
  type ComboboxSingleProps,
} from "@/components/combobox";
import { type FieldProps, FieldWrapper, splitProps, useFieldContext } from "@/components/ui/form";
import {
  menuValueOf,
  type SelectEntry,
  type SelectNoteEntry,
  type SelectOption,
  type SelectSeparatorEntry,
  storedValueOf,
  withEmptyOption,
} from "@/lib/select-options";

/** What the field wires itself, so a call site does not. */
type Wired =
  | "id"
  | "value"
  | "onValueChange"
  | "onBlur"
  | "className"
  | "aria-describedby"
  | "aria-invalid"
  | "aria-required";

type SingleControlProps = Omit<ComboboxSingleProps, Wired> & {
  /** The trigger's class. `className` is the field's, as on every bound field. */
  triggerClassName?: string | undefined;
  /**
   * Adds a first row for "nothing", which writes `null`. The field then holds `string | null`,
   * and reads `null`, `undefined` and `""` as that row.
   */
  clearable?: boolean | undefined;
  /**
   * What the row for "nothing" says. Read only when `clearable`.
   *
   * @defaultValue `"None"`
   */
  emptyLabel?: string | undefined;
};

type MultipleControlProps = Omit<ComboboxMultipleProps, Wired> & {
  /** The trigger's class. `className` is the field's, as on every bound field. */
  triggerClassName?: string | undefined;
};

type ComboboxFieldProps = FieldProps & (SingleControlProps | MultipleControlProps);

/** One value, as one element for `FieldControl` to hand the `id` and the `aria-*` props to. */
function SingleControl({
  triggerClassName,
  options,
  clearable = false,
  emptyLabel = "None",
  ...control
}: SingleControlProps) {
  const field = useFieldContext<string | null>();
  const entries = useMemo(
    () => (clearable ? withEmptyOption(options, emptyLabel) : options),
    [options, clearable, emptyLabel],
  );
  return (
    <Combobox
      {...control}
      options={entries}
      className={triggerClassName}
      value={clearable ? menuValueOf(field.state.value) : (field.state.value ?? "")}
      onValueChange={(next) => {
        field.handleChange(clearable ? storedValueOf(next) : next);
        // A popover control has no blur that means "done with this field": focus goes into the
        // menu and comes back. Choosing is the interaction, so choosing marks it touched.
        field.handleBlur();
      }}
    />
  );
}

/**
 * A `freeText` menu's refusal, put on the field as its error while it stands and taken off after,
 * so the field turns red and says why as it does for a validator's message. Only its own message
 * is taken off: a validator's error that replaced it in the meantime stays.
 */
function useRefusalError(field: ReturnType<typeof useFieldContext<readonly string[] | null>>) {
  const shown = useRef<string | undefined>(undefined);
  return useCallback(
    (message: string | undefined) => {
      const standing = field.state.meta.errorMap.onChange;
      if (message !== undefined) {
        if (standing === message) {
          return;
        }
        shown.current = message;
        field.setMeta((prev) => ({
          ...prev,
          isTouched: true,
          errorMap: { ...prev.errorMap, onChange: message },
        }));
      } else if (shown.current !== undefined && standing === shown.current) {
        shown.current = undefined;
        field.setErrorMap({ onChange: undefined });
      }
    },
    [field],
  );
}

/** Several values, wired the same way. */
function MultipleControl({
  multiple: _multiple,
  triggerClassName,
  ...control
}: MultipleControlProps) {
  const field = useFieldContext<readonly string[] | null>();
  const onRefusalChange = useRefusalError(field);
  return (
    <Combobox
      {...control}
      {...(control.freeText === true ? { onRefusalChange } : {})}
      multiple
      className={triggerClassName}
      value={field.state.value ?? []}
      onValueChange={(next) => {
        field.handleChange(next);
        field.handleBlur();
      }}
    />
  );
}

/** A `Combobox` bound to a form field holding one of the options' values, or a list of them. */
export function ComboboxField(props: ComboboxFieldProps) {
  const [fieldProps, control] = splitProps<SingleControlProps | MultipleControlProps>(props);
  return (
    <FieldWrapper
      asGroup
      {...fieldProps}
      controlSlot={
        control.multiple === true ? (
          <MultipleControl {...control} />
        ) : (
          <SingleControl {...control} />
        )
      }
    />
  );
}

export type {
  ComboboxFieldProps,
  SelectEntry,
  SelectNoteEntry,
  SelectOption,
  SelectSeparatorEntry,
};
