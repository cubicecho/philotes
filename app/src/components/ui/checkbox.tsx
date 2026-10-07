import { useState } from 'react';
import { Pressable } from 'react-native';
import { CHECKBOX_CLASS, type CheckboxProps } from '@/components/ui/checkbox-base';
import { Check } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

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
        checked ? 'border-active bg-active' : 'border-foreground/15 bg-background',
        disabled && 'opacity-50',
        className,
      )}
    >
      {checked && <Check className="h-3 w-3 text-active-foreground" />}
    </Pressable>
  );
}

export type { CheckboxProps };
export { Checkbox };
