import { useEffect, useId, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import {
  SWITCH_THUMB_CLASS,
  SWITCH_TRACK_CLASS,
  type SwitchProps,
} from "@/components/ui/switch-base";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** A control that is on or off. */
function Switch({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  onBlur,
  accessibilityLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  hint,
  side = "top",
  className,
}: SwitchProps) {
  // Controlled when `checked` is passed and self-driving otherwise, the way radix's is.
  const [checkedState, setCheckedState] = useState(defaultChecked);
  const checked = checkedProp ?? checkedState;
  const hintId = useId();
  const hasHint = Boolean(hint);
  // As on `Button`: with a hint, a disabled switch keeps its focus and tooltip and refuses the press.
  const refuses = hasHint && Boolean(disabled);
  const describedBy = [ariaDescribedBy, hasHint ? hintId : undefined].filter(Boolean).join(" ");

  const node = useRef<View>(null);
  // react-native-web's `Pressable` writes its own `aria-disabled` over the one it is handed, so
  // the refusal goes on the element, as `Button` does it.
  useEffect(() => {
    if (Platform.OS !== "web" || refuses === false) {
      return;
    }
    const element = node.current as unknown as Element | null;
    element?.setAttribute("aria-disabled", "true");
    return () => element?.removeAttribute("aria-disabled");
  }, [refuses]);

  const track = (
    <Pressable
      ref={node}
      role="switch"
      aria-checked={checked}
      aria-label={accessibilityLabel}
      aria-labelledby={ariaLabelledBy}
      // What react-native has no prop for, in the spelling react-native-web reads — the same
      // arrangement as `Input`'s. A device reads the hint as the accessibility hint instead.
      {...(Platform.OS === "web"
        ? describedBy === ""
          ? {}
          : { "aria-describedby": describedBy }
        : { accessibilityHint: hint })}
      disabled={refuses ? false : disabled}
      {...(refuses ? { "aria-disabled": true } : {})}
      onPress={() => {
        if (refuses) {
          return;
        }
        setCheckedState(!checked);
        onCheckedChange?.(!checked);
      }}
      onBlur={onBlur}
      className={cn(
        SWITCH_TRACK_CLASS,
        checked ? "bg-active" : "bg-foreground/50",
        // `disabled:` never applies to a Pressable — apply the state directly.
        disabled && "opacity-50",
        className,
      )}
    >
      <View className={cn(SWITCH_THUMB_CLASS, checked ? "ml-4" : "ml-0")} />
    </Pressable>
  );

  if (hasHint === false) {
    return track;
  }
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>{track}</TooltipTrigger>
        <TooltipContent side={side}>{hint}</TooltipContent>
      </Tooltip>
      {/* What `aria-describedby` points at on the web; the tooltip is only drawn on hover. */}
      {Platform.OS === "web" ? (
        <Text nativeID={hintId} className="sr-only text-foreground">
          {hint}
        </Text>
      ) : null}
    </>
  );
}

export type { SwitchProps };
export { Switch };
