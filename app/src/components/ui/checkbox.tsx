import { useState } from "react";
import { Pressable } from "react-native";
import { CHECKBOX_CLASS, type CheckboxProps } from "@/components/ui/checkbox-base";
import { Check } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** A box that is checked or not. */
function Checkbox({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  onBlur,
  accessibilityLabel,
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
      disabled={disabled}
      onPress={() => {
        setCheckedState(!checked);
        onCheckedChange?.(!checked);
      }}
      onBlur={onBlur}
      className={cn(
        CHECKBOX_CLASS,
        // Checked is the chosen tint, edged in `active` because the tint is not 3:1 from the
        // surface; the check is `foreground`, 3:1 or more on the tint and around it.
        checked
          ? "border-active bg-active/40 hover:bg-active/60"
          : "border-foreground/50 bg-background",
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
