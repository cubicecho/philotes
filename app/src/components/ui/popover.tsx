import { cloneElement, createContext, isValidElement, type ReactElement, useContext, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import type {
  PopoverAnchorProps,
  PopoverCloseProps,
  PopoverContentProps,
  PopoverProps,
  PopoverSectionProps,
  PopoverTriggerProps,
} from '@/components/ui/popover-base';
import { cn } from '@/lib/utils';

type PopoverState = { open: boolean; setOpen: (open: boolean) => void };

const PopoverContext = createContext<PopoverState>({
  open: false,
  setOpen: () => {},
});

function Popover({ open, onOpenChange, defaultOpen = false, children }: PopoverProps) {
  // Uncontrolled state kept unconditionally — hooks cannot be conditional — and
  // read only when the caller passed no `open`.
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = open ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (open === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  return <PopoverContext.Provider value={{ open: isOpen, setOpen }}>{children}</PopoverContext.Provider>;
}

function PopoverTrigger({ asChild, children }: PopoverTriggerProps) {
  const { setOpen } = useContext(PopoverContext);
  if (asChild && isValidElement(children)) {
    return cloneElement(children as ReactElement<{ onPress?: () => void }>, {
      onPress: () => setOpen(true),
    });
  }
  return (
    // The `role` is hand-written because a `<button>` has no native counterpart.
    <Pressable role="button" onPress={() => setOpen(true)}>
      {children}
    </Pressable>
  );
}

function PopoverContent({ className, children }: PopoverContentProps) {
  const { open, setOpen } = useContext(PopoverContext);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View className="flex-1 items-center justify-center bg-overlay/60 p-6">
        <Pressable className="absolute inset-0" onPress={() => setOpen(false)} role="button" aria-label="Close" />
        <View className={cn('w-72 rounded-md border border-foreground/10 bg-secondary p-4', className)}>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function PopoverClose({ asChild, className, children }: PopoverCloseProps) {
  const { setOpen } = useContext(PopoverContext);
  if (asChild && isValidElement(children)) {
    return cloneElement(children as ReactElement<{ onPress?: () => void }>, {
      onPress: () => setOpen(false),
    });
  }
  return (
    // The `role` is hand-written because a `<button>` has no native counterpart.
    <Pressable role="button" onPress={() => setOpen(false)} className={cn(className)}>
      {children}
    </Pressable>
  );
}

/** The native sheet is centred and anchors to nothing, so an anchor is just its children. */
function PopoverAnchor({ children }: PopoverAnchorProps) {
  return <>{children}</>;
}

function PopoverHeader({ className, children }: PopoverSectionProps) {
  return <View className={cn('gap-1', className)}>{children}</View>;
}

function PopoverTitle({ className, children }: PopoverSectionProps) {
  return <Text className={cn('text-sm font-medium text-foreground', className)}>{children}</Text>;
}

function PopoverDescription({ className, children }: PopoverSectionProps) {
  return <Text className={cn('text-sm text-foreground/60', className)}>{children}</Text>;
}

export {
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
