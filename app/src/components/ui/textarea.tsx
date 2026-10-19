import { useImperativeHandle, useLayoutEffect, useRef } from "react";
import { Platform, TextInput } from "react-native";
import {
  fitRows,
  type GrowingBox,
  isSubmitKey,
  rowsHeight,
  TEXTAREA_CLASS,
  type TextareaHandle,
  type TextareaKeyPressEvent,
  type TextareaKeyPressHandler,
  type TextareaProps,
  type TextareaSelection,
} from "@/components/ui/textarea-base";
import { cn, FIELD_INVALID_CLASS, isInvalid } from "@/lib/utils";

/** A multi-line text box. */
function Textarea({
  value,
  defaultValue,
  onChangeText,
  onBlur,
  onSubmitEditing,
  selection,
  onSelectionChange,
  onKeyPress,
  onEscape,
  placeholder,
  rows,
  maxRows,
  maxLength,
  disabled,
  autoFocus,
  className,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ref,
}: TextareaProps) {
  const inner = useRef<TextInput>(null);
  useImperativeHandle<TextareaHandle, TextareaHandle>(ref, () => ({
    focus: () => inner.current?.focus(),
  }));

  const grows = maxRows !== undefined;
  const minRows = rows ?? 1;
  // A device's multiline input grows with its text by itself, and only needs the two ends. Under
  // react-native-web the input is a `<textarea>`, which does not, so it is measured.
  const refit = () => {
    if (grows === false || Platform.OS !== "web" || !inner.current) {
      return;
    }
    fitRows(inner.current as unknown as GrowingBox, minRows, maxRows);
  };
  // After every render and not only a changed `value`: the text can also arrive as a new
  // `defaultValue`, and the box can change width under it.
  useLayoutEffect(refit);

  return (
    <TextInput
      ref={inner}
      multiline
      textAlignVertical="top"
      // Held at `""` unless the caller asked for uncontrolled by passing a `defaultValue`: a bound
      // field's value starts `undefined` more often than not.
      {...(defaultValue === undefined ? { value: value ?? "" } : { value, defaultValue })}
      onChangeText={(text) => {
        onChangeText?.(text);
        // An uncontrolled box does not render again on a keystroke.
        refit();
      }}
      onBlur={onBlur}
      {...(selection !== undefined ? { selection } : {})}
      {...(onSelectionChange
        ? { onSelectionChange: (event) => onSelectionChange(event.nativeEvent.selection) }
        : {})}
      {...(autoFocus !== undefined ? { autoFocus } : {})}
      onKeyPress={(event) => {
        onKeyPress?.(event);
        // A caller's own handler that took the key keeps it, as on the web.
        if (event.isDefaultPrevented()) {
          return;
        }
        if (event.nativeEvent.key === "Escape") {
          onEscape?.();
        }
        // Only where the key reports its Shift. A device's return key does not, and taking it
        // would leave a message with no way to hold a second line.
        if (Platform.OS === "web" && onSubmitEditing && isSubmitKey(event.nativeEvent)) {
          // Held back, or the Enter that sent the message would also add a line to the next.
          event.preventDefault();
          onSubmitEditing();
        }
      }}
      placeholder={placeholder}
      // Not while it grows: Android reads `numberOfLines` as the height, not as where it starts.
      {...(rows !== undefined && grows === false ? { numberOfLines: rows } : {})}
      {...(maxLength !== undefined ? { maxLength } : {})}
      editable={!disabled}
      id={id}
      // What react-native has no prop for, in the spelling react-native-web reads, as on `Input`.
      {...(Platform.OS === "web"
        ? {
            ...(ariaDescribedBy === undefined ? {} : { "aria-describedby": ariaDescribedBy }),
            ...(ariaInvalid === undefined ? {} : { "aria-invalid": ariaInvalid }),
          }
        : {})}
      {...(grows && Platform.OS !== "web"
        ? { style: { minHeight: rowsHeight(minRows), maxHeight: rowsHeight(maxRows) } }
        : {})}
      // `min-h-0` lets go of the class's 80px floor, which is four lines a composer starts without.
      className={cn(
        TEXTAREA_CLASS,
        grows && "min-h-0",
        isInvalid(ariaInvalid) && FIELD_INVALID_CLASS,
        disabled && "opacity-50",
        className,
      )}
    />
  );
}

export type {
  TextareaHandle,
  TextareaKeyPressEvent,
  TextareaKeyPressHandler,
  TextareaProps,
  TextareaSelection,
};
export { Textarea };
