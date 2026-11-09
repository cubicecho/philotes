import { useState } from "react";
import { Platform, Pressable } from "react-native";
import { CHECKBOX_CLASS, type CheckboxProps } from "@/components/ui/checkbox-base";
import { Check } from "@/components/ui/icons";
import { cn, isInvalid, touchTarget } from "@/lib/utils";

/** `CHECKBOX_CLASS`'s `h-4 w-4`, grown to a finger's 44pt by a `hitSlop` on device (#470). */
const DRAWN = { width: 16, height: 16 } as const;

/** A box that is checked or not. */
function Checkbox({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  onBlur,
  accessibilityLabel,
  "aria-invalid": ariaInvalid,
  className,
}: CheckboxProps) {
  // Controlled when `checked` is passed and self-driving otherwise, the way radix's is.
  const [checkedState, setCheckedState] = useState(defaultChecked);
  const checked = checkedProp ?? checkedState;
  return (
    <Pressable
      role="checkbox"
      aria-checked={checked}
      aria-label={accessibilityLabel}
      // What react-native has no prop for, in the spelling react-native-web reads, as `Input` does.
      {...(Platform.OS === "web" && ariaInvalid !== undefined
        ? { "aria-invalid": ariaInvalid }
        : {})}
      disabled={disabled}
      onPress={() => {
        setCheckedState(!checked);
        onCheckedChange?.(!checked);
      }}
      onBlur={onBlur}
      {...touchTarget(DRAWN)}
      className={cn(
        CHECKBOX_CLASS,
        // Checked is the chosen tint, edged in `active` because the tint is not 3:1 from the
        // surface; the check is `foreground`, 3:1 or more on the tint and around it. Focused, a box
        // looks as it does under the pointer, for Expo web, and draws no ring.
        "focus-visible:outline-none",
        checked
          ? "border-active bg-active/40 hover:bg-active/60 focus-visible:bg-active/60"
          : "border-foreground/50 bg-background hover:bg-hover focus-visible:bg-hover",
        // After the checked edge, so a refused box is red whether it is checked or not.
        isInvalid(ariaInvalid) && "border-negative",
        disabled && "opacity-50",
        className,
      )}
    >
      {checked && <Check className="h-3 w-3 text-foreground" />}
    </Pressable>
  );
}

export type { CheckboxProps };
export { Checkbox };
