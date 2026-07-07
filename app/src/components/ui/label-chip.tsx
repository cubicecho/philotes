import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LabelChipProps {
  label: string;
  /** Hex color of the label, e.g. "#ef4444". Used as a tinted background. */
  color: string;
  /** Highlighted state (e.g. active filter). */
  active?: boolean;
  onClick?: () => void;
  /** Renders a small remove affordance after the text. */
  onRemove?: () => void;
  className?: string;
}

/**
 * The one true label chip: tinted with the label's own color so user-chosen
 * colors carry meaning instead of being reduced to a 8px dot.
 */
export function LabelChip({ label, color, active = false, onClick, onRemove, className }: LabelChipProps) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
        onClick && 'cursor-pointer',
        active && 'ring-1 ring-current',
        className,
      )}
      style={{
        backgroundColor: `${color}24`,
        color,
      }}
    >
      {label}
      {onRemove &&
        (onClick ? (
          // Chip itself is a button — a nested button is invalid HTML, so the
          // X is decorative and the whole-chip click handles removal.
          <X className="-mr-0.5 h-2.5 w-2.5" aria-hidden="true" />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="-mr-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            aria-label={`Remove ${label}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        ))}
    </Tag>
  );
}
