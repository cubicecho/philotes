import type { FormElementProps } from '@/components/ui/form-element-base';
import { cn } from '@/lib/utils';

export function FormElement({ onSubmit, className, children }: FormElementProps) {
  return (
    <form
      className={cn('flex flex-col', className)}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
