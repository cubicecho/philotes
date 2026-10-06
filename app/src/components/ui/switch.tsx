import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SWITCH_THUMB_CLASS, SWITCH_TRACK_CLASS, type SwitchProps } from '@/components/ui/switch-base';
import { cn } from '@/lib/utils';

function Switch({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  onBlur,
  accessibilityLabel,
  'aria-labelledby': ariaLabelledBy,
  className,
}: SwitchProps) {
  // Controlled when `checked` is passed and self-driving otherwise, the way radix's is.
  const [checkedState, setCheckedState] = useState(defaultChecked);
  const checked = checkedProp ?? checkedState;
  return (
    <Pressable
      role="switch"
      aria-checked={checked}
      aria-label={accessibilityLabel}
      aria-labelledby={ariaLabelledBy}
      disabled={disabled}
      onPress={() => {
        setCheckedState(!checked);
        onCheckedChange?.(!checked);
      }}
      onBlur={onBlur}
      className={cn(
        SWITCH_TRACK_CLASS,
        checked ? 'bg-active' : 'bg-foreground/15',
        // `disabled:` never applies to a Pressable — apply the state directly.
        disabled && 'opacity-50',
        className,
      )}
    >
      <View className={cn(SWITCH_THUMB_CLASS, checked ? 'ml-4' : 'ml-0')} />
    </Pressable>
  );
}

export type { SwitchProps };
export { Switch };
