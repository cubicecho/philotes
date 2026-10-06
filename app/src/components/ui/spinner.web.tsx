import { LoaderCircle } from '@/components/ui/icons';
import { type SpinnerProps, spinnerClass } from '@/components/ui/spinner-base';
import { cn } from '@/lib/utils';

export type { SpinnerProps };

export function Spinner({ label = 'Loading', className }: SpinnerProps) {
  return (
    <LoaderCircle
      data-slot="spinner"
      role="status"
      aria-label={label}
      className={cn(spinnerClass, 'animate-spin', className)}
    />
  );
}
