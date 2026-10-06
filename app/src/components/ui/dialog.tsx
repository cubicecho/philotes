import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  useContext,
  useRef,
  useState,
} from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import type {
  DialogCloseProps,
  DialogContentProps,
  DialogFooterProps,
  DialogOverlayProps,
  DialogPortalProps,
  DialogProps,
  DialogSectionProps,
  DialogTriggerProps,
} from '@/components/ui/dialog-base';
import { X } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/** The open side of the same problem, read by `DialogTrigger`. */
const DialogOpenContext = createContext<(open: boolean) => void>(() => {});

/**
 * `onEscapeKeyDown` belongs to `DialogContent` — that is where radix puts it — but the
 * thing that fires it here is the hardware back button, which `Modal` reports to
 * `Dialog`. The handler is published upward through a ref rather than downward, because
 * the component that has it is below the component that hears the event.
 */
const DialogEscapeContext = createContext<{ current: ((event: Event) => void) | undefined }>({
  current: undefined,
});

/**
 * Radix wires its `Close` up through the `Root` it is nested in. There is no
 * equivalent on native, so `Dialog` publishes the closer and `DialogContent`
 * — which owns both the backdrop and the X — reads it.
 */
const DialogCloseContext = createContext<() => void>(() => {});

function Dialog({ open, onOpenChange, defaultOpen = false, children }: DialogProps) {
  // Uncontrolled state kept unconditionally — hooks cannot be conditional — and read only when
  // the caller passed no `open`, the same arrangement as `popover.tsx`.
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = open ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (open === undefined) setUncontrolled(next);
    onOpenChange?.(next);
  };
  const escapeRef = useRef<((event: Event) => void) | undefined>(undefined);

  // The trigger has to render while the dialog is shut, and everything else must not.
  // On web that falls out of radix's portal; here the children are split by type, because
  // `Modal` renders nothing at all until `visible` and a trigger inside it would never
  // appear. This is why `DialogTrigger` must be a direct child of `Dialog`.
  const parts = Children.toArray(children);
  const triggers = parts.filter((c) => isValidElement(c) && c.type === DialogTrigger);
  const rest = parts.filter((c) => !(isValidElement(c) && c.type === DialogTrigger));

  // Android's back button is native's Escape: the one way the dialog closes that the
  // caller did not ask for. `preventDefault` keeps it open, exactly as it does on web.
  const requestClose = () => {
    const handler = escapeRef.current;
    if (!handler) return setOpen(false);
    const event = new Event('keydown', { cancelable: true });
    handler(event);
    if (!event.defaultPrevented) setOpen(false);
  };

  return (
    <DialogOpenContext.Provider value={setOpen}>
      {triggers}
      <DialogEscapeContext.Provider value={escapeRef}>
        <Modal visible={isOpen} transparent animationType="fade" onRequestClose={requestClose}>
          <DialogCloseContext.Provider value={() => setOpen(false)}>{rest}</DialogCloseContext.Provider>
        </Modal>
      </DialogEscapeContext.Provider>
    </DialogOpenContext.Provider>
  );
}

/**
 * A trigger, so a dialog can own its own open state at the call site.
 *
 * On web this is radix's, which also wires `aria-haspopup` and returns focus. Here
 * it is the press that flips `Dialog`'s open flag — its own state, or the caller's
 * through `onOpenChange` — so the native trigger is the child's `onPress`, cloned.
 */
function DialogTrigger({ asChild, children }: DialogTriggerProps) {
  const open = useContext(DialogOpenContext);
  const show = () => open(true);
  if (asChild && isValidElement(children)) {
    return cloneElement(children as ReactElement<{ onPress?: () => void }>, { onPress: show });
  }
  return (
    <Pressable onPress={show} role="button">
      {children}
    </Pressable>
  );
}

/**
 * Shuts the dialog it is inside — radix's `Close`, for a Cancel button of the caller's own.
 * `asChild` hands the press to the child, for the reason `DialogTrigger` gives.
 */
function DialogClose({ asChild, className, children }: DialogCloseProps) {
  const close = useContext(DialogCloseContext);
  if (asChild && isValidElement(children)) {
    return cloneElement(children as ReactElement<{ onPress?: () => void }>, { onPress: close });
  }
  return (
    // The `role` is hand-written because a `<button>` has no native counterpart.
    <Pressable onPress={close} role="button" className={cn(className)}>
      {children}
    </Pressable>
  );
}

/** The `Modal` is already the portal on native; this is here so a shadcn composition renders. */
function DialogPortal({ children }: DialogPortalProps) {
  return <>{children}</>;
}

/**
 * The dimmed layer, for a caller assembling its own pane. `DialogContent` draws its own, so this
 * is only for content that is not one; it does not close on press — the backdrop `DialogContent`
 * draws is the one that does.
 */
function DialogOverlay({ className }: DialogOverlayProps) {
  return <View pointerEvents="none" className={cn('absolute inset-0 bg-overlay/60', className)} />;
}

function DialogContent({
  className,
  showCloseButton = true,
  onEscapeKeyDown,
  onInteractOutside,
  role,
  children,
}: DialogContentProps) {
  const close = useContext(DialogCloseContext);
  const escapeRef = useContext(DialogEscapeContext);
  escapeRef.current = onEscapeKeyDown;

  // The backdrop press is native's "interact outside". `preventDefault` on the
  // synthetic event is what a caller uses to keep the dialog open, matching radix.
  const interactOutside = () => {
    if (!onInteractOutside) return close();
    const event = new Event('pointerdown', { cancelable: true });
    onInteractOutside(event);
    if (!event.defaultPrevented) close();
  };
  return (
    <View className="flex-1 items-center justify-center bg-overlay/60 p-6">
      {/* The backdrop is a sibling laid out underneath rather than a parent of
          the card, because `Pressable` has no `stopPropagation` — nesting the
          card inside it would make every press on the card close the dialog. */}
      <Pressable className="absolute inset-0" onPress={interactOutside} role="button" aria-label="Close" />
      <View
        {...(role === undefined ? {} : { role })}
        className={cn('w-full max-w-lg gap-4 rounded-lg border border-foreground/10 bg-background p-6', className)}
      >
        {children}
        {showCloseButton ? (
          <Pressable
            className="absolute right-4 top-4 opacity-70"
            onPress={close}
            // The `role` is hand-written because a `<button>` has no native counterpart.
            role="button"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// `space-y-*` and `space-x-*` are child-combinator utilities nativewind does
// not implement; `gap` is the cross-platform equivalent and behaves the same
// for these two rows.
function DialogHeader({ className, children }: DialogSectionProps) {
  return <View className={cn('gap-1.5', className)}>{children}</View>;
}

function DialogFooter({ className, showCloseButton = false, children }: DialogFooterProps) {
  return (
    <View className={cn('flex-row justify-end gap-2', className)}>
      {children}
      {showCloseButton ? (
        <DialogClose asChild>
          <Button variant="outline" content="Close" />
        </DialogClose>
      ) : null}
    </View>
  );
}

function DialogTitle({ className, children }: DialogSectionProps) {
  return (
    <Text
      // The `role` is hand-written because an `<h2>` has no native counterpart.
      role="heading"
      aria-level={2}
      className={cn('text-lg font-semibold leading-none tracking-tight text-foreground', className)}
    >
      {children}
    </Text>
  );
}

function DialogDescription({ className, children }: DialogSectionProps) {
  return <Text className={cn('text-sm text-foreground/60', className)}>{children}</Text>;
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
