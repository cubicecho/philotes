import { Pressable } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { readableTextColor } from '@/lib/readable-text-color';
import { cn } from '@/lib/utils';

interface LabelChipProps {
  label: string;
  /** Hex color of the label, e.g. "#ef4444". */
  color: string;
  /** Whether the toggle is on (a filter in use). Only meaningful with `onPress`. */
  selected?: boolean;
  /** Makes the whole chip a toggle button. */
  onPress?: () => void;
  /** Draws the badge's own ✕, named "Remove <label>". */
  onRemove?: () => void;
  className?: string;
}

/**
 * A label's colour is chosen by the user, so it cannot come from a Tailwind
 * class — it is the badge's backdrop, applied inline, and the ink on top is
 * picked per colour so it reads on every hue in both themes.
 */
export function LabelChip({ label, color, selected = false, onPress, onRemove, className }: LabelChipProps) {
  const badge = (
    <Badge
      backgroundColor={color}
      textColor={readableTextColor(color)}
      className={onPress ? undefined : className}
      {...(onRemove ? { onRemove } : {})}
    >
      {label}
    </Badge>
  );
  if (!onPress) {
    return badge;
  }
  return (
    <Pressable
      role="button"
      aria-pressed={selected}
      onPress={onPress}
      className={cn(
        'self-start rounded-full border-2',
        selected ? 'border-foreground' : 'border-transparent opacity-70',
        className,
      )}
    >
      {badge}
    </Pressable>
  );
}
