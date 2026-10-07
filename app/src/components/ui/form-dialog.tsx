import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, type SlotNode } from '@/lib/utils';

type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function FormDialog({ open, onOpenChange, title, description, className, children }: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-[480px]', className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

type FormDialogFooterProps = {
  onCancel: () => void;
  cancelLabel?: string;
  /** Left-aligned action — a Delete or a Mark complete. Drawn only when set. */
  secondarySlot?: SlotNode;
  /**
   * A rejected mutation's message, shown above the buttons. Field validation
   * stays inline beneath its field — this is for what only the server knows,
   * such as a delete the database refuses on a foreign key.
   */
  error?: string | null;
  /** The submit control — typically `<form.SubmitButton />`. */
  children: ReactNode;
};

export function FormDialogFooter({
  onCancel,
  cancelLabel = 'Cancel',
  secondarySlot,
  error,
  children,
}: FormDialogFooterProps) {
  return (
    <>
      {error ? (
        <Text role="alert" className="text-sm text-negative">
          {error}
        </Text>
      ) : null}
      <DialogFooter className={cn('items-center', secondarySlot && 'sm:justify-between')}>
        {secondarySlot ? <View>{secondarySlot}</View> : null}
        <View className="flex-row gap-2">
          <Button variant="outline" onPress={onCancel} content={cancelLabel} />
          {children}
        </View>
      </DialogFooter>
    </>
  );
}
