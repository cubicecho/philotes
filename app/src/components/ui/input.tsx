import { useId, useImperativeHandle, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { IconClassContext } from "@/components/ui/icons-base";
import {
  INPUT_ADDON_BOX_CLASS,
  INPUT_ADDON_FIELD_CLASS,
  INPUT_ADDON_SLOT_CLASS,
  INPUT_ADDON_TEXT_CLASS,
  INPUT_CLASS,
  INPUT_LEADING_CLASS,
  INPUT_LEADING_PAD_CLASS,
  INPUT_SLOT_ICON_CLASS,
  INPUT_TRAILING_CLASS,
  INPUT_TRAILING_PAD_CLASS,
  INPUT_WRAPPER_CLASS,
  type InputAutoComplete,
  type InputHandle,
  type InputKeyPressEvent,
  type InputKeyPressHandler,
  type InputProps,
  type InputType,
  NATIVE_INPUT_MODE,
} from "@/components/ui/input-base";
import { cn, FIELD_INVALID_CLASS, isInvalid } from "@/lib/utils";

/** A one-line text box, with optional slots at its start and end. */
function Input({
  className,
  type = "text",
  inputMode,
  signed,
  value,
  defaultValue,
  onChangeText,
  onBlur,
  onSubmitEditing,
  onKeyPress,
  onEscape,
  placeholder,
  autoCapitalize,
  autoCorrect,
  autoComplete,
  maxLength,
  disabled,
  readOnly,
  autoFocus,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  leadingSlot,
  trailingSlot,
  prefixText,
  suffixText,
  wrapperClassName,
  ref,
}: InputProps) {
  const inner = useRef<TextInput>(null);
  const addons = prefixText !== undefined || suffixText !== undefined;
  // The box draws the border round the fixed text, so it is the box that shows the focus.
  const [focused, setFocused] = useState(false);
  const addonId = useId();
  // On the web the fixed text is read with the field, as the web half reads it. Device has no
  // description relation; the text is read where it is drawn, beside the field.
  const describedBy = addons
    ? [
        ariaDescribedBy,
        prefixText === undefined ? undefined : `${addonId}-prefix`,
        suffixText === undefined ? undefined : `${addonId}-suffix`,
      ]
        .filter((part) => part !== undefined)
        .join(" ")
    : ariaDescribedBy;
  useImperativeHandle<InputHandle, InputHandle>(ref, () => ({
    focus: () => inner.current?.focus(),
  }));

  const field = (
    <TextInput
      ref={inner}
      value={value}
      defaultValue={defaultValue}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      onSubmitEditing={onSubmitEditing}
      onKeyPress={(event) => {
        onKeyPress?.(event);
        // A caller's own handler that took the key keeps it, as on the web.
        if (event.isDefaultPrevented()) {
          return;
        }
        if (event.nativeEvent.key === "Escape") {
          onEscape?.();
        }
      }}
      placeholder={placeholder}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      autoComplete={autoComplete}
      maxLength={maxLength}
      editable={disabled !== true && readOnly !== true}
      autoFocus={autoFocus}
      id={id}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      // What react-native has no prop for, in the spelling react-native-web reads — the same
      // arrangement as `DateTimeInput`'s trigger.
      {...(Platform.OS === "web"
        ? {
            ...(describedBy === undefined ? {} : { "aria-describedby": describedBy }),
            ...(ariaInvalid === undefined ? {} : { "aria-invalid": ariaInvalid }),
          }
        : {})}
      // `inputMode` wins over `keyboardType` when both are set, so a signed box on iOS sets only the
      // one that has a minus key.
      {...(signed === true && Platform.OS === "ios"
        ? { keyboardType: "numbers-and-punctuation" as const }
        : { inputMode: inputMode ?? NATIVE_INPUT_MODE[type] ?? "text" })}
      secureTextEntry={type === "password"}
      // What a DOM `type="search"` is without being told, so a screen reader on device says
      // "search field" too.
      role={type === "search" ? "searchbox" : undefined}
      className={cn(
        INPUT_CLASS,
        addons
          ? [
              INPUT_ADDON_FIELD_CLASS,
              (prefixText !== undefined || leadingSlot != null) && "pl-0",
              (suffixText !== undefined || trailingSlot != null) && "pr-0",
            ]
          : [
              leadingSlot != null && INPUT_LEADING_PAD_CLASS,
              trailingSlot != null && INPUT_TRAILING_PAD_CLASS,
              isInvalid(ariaInvalid) && FIELD_INVALID_CLASS,
              disabled && "opacity-50",
            ],
        className,
      )}
    />
  );

  if (addons) {
    return (
      <Pressable
        // A press on the fixed text puts the caret in the value, as a press anywhere in a box does.
        onPress={() => inner.current?.focus()}
        disabled={disabled === true || readOnly === true}
        accessible={false}
        className={cn(
          INPUT_ADDON_BOX_CLASS,
          isInvalid(ariaInvalid) && "border-negative",
          focused && "border-active",
          disabled && "opacity-50",
          wrapperClassName,
        )}
      >
        <IconClassContext.Provider value={INPUT_SLOT_ICON_CLASS}>
          {leadingSlot != null ? (
            <View className={INPUT_ADDON_SLOT_CLASS}>{leadingSlot}</View>
          ) : null}
          {prefixText !== undefined ? (
            // `head`: a long prefix gives way from its start, so the part beside the value stays.
            // react-native-web cuts only the end, so there the line runs right to left with the
            // text isolated left to right inside it, which is what the web half's `<bdi>` does.
            <Text
              id={`${addonId}-prefix`}
              numberOfLines={1}
              ellipsizeMode="head"
              className={cn(
                INPUT_ADDON_TEXT_CLASS,
                leadingSlot == null && "pl-3",
                Platform.OS === "web" && "[direction:rtl]",
              )}
            >
              {Platform.OS === "web" ? `\u2066${prefixText}\u2069` : prefixText}
            </Text>
          ) : null}
          {field}
          {suffixText !== undefined ? (
            <Text
              id={`${addonId}-suffix`}
              numberOfLines={1}
              className={cn(
                INPUT_ADDON_TEXT_CLASS, // Short, and the half a reader needs whole: only the prefix gives way.
                "shrink-0",
                trailingSlot == null && "pr-3",
              )}
            >
              {suffixText}
            </Text>
          ) : null}
          {trailingSlot != null ? (
            <View className={INPUT_ADDON_SLOT_CLASS}>{trailingSlot}</View>
          ) : null}
        </IconClassContext.Provider>
      </Pressable>
    );
  }

  if (leadingSlot == null && trailingSlot == null) {
    return field;
  }

  return (
    <View className={cn(INPUT_WRAPPER_CLASS, wrapperClassName)}>
      {field}
      <IconClassContext.Provider value={INPUT_SLOT_ICON_CLASS}>
        {leadingSlot != null ? <View className={INPUT_LEADING_CLASS}>{leadingSlot}</View> : null}
        {trailingSlot != null ? <View className={INPUT_TRAILING_CLASS}>{trailingSlot}</View> : null}
      </IconClassContext.Provider>
    </View>
  );
}

export type {
  InputAutoComplete,
  InputHandle,
  InputKeyPressEvent,
  InputKeyPressHandler,
  InputProps,
  InputType,
};
export { Input };
