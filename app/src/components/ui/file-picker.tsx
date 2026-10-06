import { Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import type { FilePickerButtonProps, FilePickerProps } from '@/components/ui/file-picker-base';
import { Upload } from '@/components/ui/icons';

const UNAVAILABLE = 'Picking a file is only available on the web app.';

export function FilePicker({ label }: FilePickerProps) {
  return (
    <View className="w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-foreground/15 px-6 py-12">
      <Upload className="h-8 w-8 text-foreground/60" />
      <Text className="text-center text-sm font-medium text-foreground">{label}</Text>
      <Text className="text-center text-xs text-foreground/60">{UNAVAILABLE}</Text>
    </View>
  );
}

export function FilePickerButton({ label, iconSlot = <Upload />, variant, size, className }: FilePickerButtonProps) {
  const iconOnly = typeof size === 'string' && size.startsWith('icon');
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled
      aria-label={label}
      accessibilityHint={UNAVAILABLE}
      iconSlot={iconSlot}
      content={iconOnly ? null : label}
    />
  );
}
