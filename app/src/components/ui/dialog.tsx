import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import {
  DIALOG_CONTENT_CLASS,
  DIALOG_DESCRIPTION_CLASS,
  DIALOG_DISMISS_CLASS,
  DIALOG_FOOTER_CLASS,
  DIALOG_HEADER_CLASS,
  DIALOG_TITLE_CLASS,
  type DialogCloseProps,
  type DialogContentProps,
  type DialogFooterProps,
  type DialogOverlayProps,
  type DialogPortalProps,
  type DialogProps,
  type DialogSectionProps,
  type DialogTriggerProps,
  focusOnOpen,
  holdOpen,
} from "@/components/ui/dialog-base";
import { X } from "@/components/ui/icons";
import { OverlayLayer } from "@/components/ui/overlay";
import { addHandlers, CardBodyContext, cn } from "@/lib/utils";

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

/**
 * The id `DialogContent` names its card by, which `DialogTitle` takes as its own. Radix wires the
 * same pair on the web; here a card named by nothing was an unnamed `dialog` to a screen reader,
 * which reads its role and no title (#510).
 */
const DialogTitleIdContext = createContext<string | undefined>(undefined);

/** The root of a dialog: it holds the open state. */
function Dialog({ open, onOpenChange, defaultOpen = false, children }: DialogProps) {
  // Uncontrolled state kept unconditionally — hooks cannot be conditional — and read only when
  // the caller passed no `open`, the same arrangement as `popover.tsx`.
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = open ?? uncontrolled;
  const setOpen = (next: boolean) => {
    if (open === undefined) {
      setUncontrolled(next);
    }
    onOpenChange?.(next);
  };
  const escapeRef = useRef<((event: Event) => void) | undefined>(undefined);

  // The trigger has to render while the dialog is shut, and everything else must not.
  // On web that falls out of radix's portal; here the children are split by type, because
  // `Modal` renders nothing at all until `visible` and a trigger inside it would never
  // appear. This is why `DialogTrigger` must be a direct child of `Dialog`.
  const parts = Children.toArray(children);
  const triggers = parts.filter((c) => isValidElement(c) && c.type === DialogTrigger);
  const rest = parts.filter((c) => (isValidElement(c) && c.type === DialogTrigger) === false);

  // Android's back button is native's Escape: the one way the dialog closes that the
  // caller did not ask for. `preventDefault` keeps it open, exactly as it does on web.
  const requestClose = () => {
    const handler = escapeRef.current;
    if (!handler) {
      return setOpen(false);
    }
    const event = new Event("keydown", { cancelable: true });
    handler(event);
    if (event.defaultPrevented === false) {
      setOpen(false);
    }
  };

  return (
    <DialogOpenContext.Provider value={setOpen}>
      {triggers}
      <DialogEscapeContext.Provider value={escapeRef}>
        <Modal visible={isOpen} transparent animationType="fade" onRequestClose={requestClose}>
          <DialogCloseContext.Provider value={() => setOpen(false)}>
            {rest}
          </DialogCloseContext.Provider>
          {/* Last, so a tooltip or a toast raised while the dialog is open is drawn over it. */}
          <OverlayLayer />
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
 * through `onOpenChange` — so the native trigger is added to the child's `onPress`, cloned.
 */
function DialogTrigger({ asChild, children }: DialogTriggerProps) {
  const open = useContext(DialogOpenContext);
  const show = () => open(true);
  if (asChild && isValidElement(children)) {
    return addHandlers(children, { onPress: show });
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
    return addHandlers(children, { onPress: close });
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
  return <View pointerEvents="none" className={cn("absolute inset-0 bg-overlay/60", className)} />;
}

/** The dialog's card. */
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
  const panel = useRef<View>(null);
  const titleId = useId();

  // Under Expo web the `Modal`'s own trap focuses the first thing it can, which is the backdrop's
  // Close, then a button: a filled one focused looks hovered and read unfilled on open. So the
  // first field takes focus, or with none the panel, as the web half's does. This runs before the
  // trap's, which then finds focus already inside. A device draws no keyboard focus.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, as the dialog opens
  useEffect(() => {
    if (Platform.OS === "web" && panel.current) {
      focusOnOpen(panel.current as unknown as HTMLElement, role === "alertdialog");
    }
  }, []);

  // The backdrop press is native's "interact outside". `preventDefault` on the
  // synthetic event is what a caller uses to keep the dialog open, matching radix.
  const interactOutside = () => {
    if (!onInteractOutside) {
      return close();
    }
    const event = new Event("pointerdown", { cancelable: true });
    onInteractOutside(event);
    if (event.defaultPrevented === false) {
      close();
    }
  };
  return (
    // `p-4`: 16px clear of the screen's edges, the web half's `max-w-[calc(100%-2rem)]`.
    <View className="flex-1 items-center justify-center bg-overlay/60 p-4">
      {/* The backdrop is a sibling laid out underneath rather than a parent of
          the card, because `Pressable` has no `stopPropagation` — nesting the
          card inside it would make every press on the card close the dialog.
          A backdrop that refuses every press is not drawn: a button there would
          be read out as Close and then not close. The `Modal` is its own
          window, so a press on the bare overlay reaches nothing behind it. */}
      {onInteractOutside === holdOpen ? null : (
        <Pressable
          className="absolute inset-0"
          onPress={interactOutside}
          role="button"
          aria-label="Close"
        />
      )}
      <View
        ref={panel}
        // `dialog` unless the caller says `alertdialog`, as radix's content is.
        role={role ?? "dialog"}
        aria-modal
        // Named by its title: `aria-labelledby` under Expo web, and Android's labelled-by on device.
        aria-labelledby={titleId}
        // Focusable from script only, so the panel can take focus on open; and no ring when it has.
        {...(Platform.OS === "web" ? { tabIndex: -1 as const } : {})}
        className={cn(
          DIALOG_CONTENT_CLASS,
          Platform.select({ web: "outline-none", default: undefined }),
          className,
        )}
      >
        <DialogTitleIdContext.Provider value={titleId}>
          <CardBodyContext.Provider value={false}>{children}</CardBodyContext.Provider>
        </DialogTitleIdContext.Provider>
        {showCloseButton ? (
          <Pressable
            className={DIALOG_DISMISS_CLASS}
            onPress={close}
            // 24 points with its padding; this brings the target up to the 44 a finger needs.
            hitSlop={10}
            // The `role` is hand-written because a `<button>` has no native counterpart.
            role="button"
            aria-label="Close"
          >
            {/* Ink on the icon too: colour does not inherit on a device. */}
            <X className="h-4 w-4 text-foreground/60" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// `space-y-*` and `space-x-*` are child-combinator utilities nativewind does
// not implement; `gap` is the cross-platform equivalent and behaves the same
// for these two rows.
/** The block holding the title and the description. */
function DialogHeader({ className, children }: DialogSectionProps) {
  return <View className={cn(DIALOG_HEADER_CLASS, className)}>{children}</View>;
}

/** The row of buttons at the bottom of the dialog. */
function DialogFooter({ className, showCloseButton = false, children }: DialogFooterProps) {
  return (
    <View className={cn(DIALOG_FOOTER_CLASS, className)}>
      {children}
      {showCloseButton ? (
        <DialogClose asChild>
          <Button variant="outline" content="Close" />
        </DialogClose>
      ) : null}
    </View>
  );
}

/** The dialog's title, and its accessible name. */
function DialogTitle({ className, children }: DialogSectionProps) {
  const titleId = useContext(DialogTitleIdContext);
  return (
    <Text
      {...(titleId === undefined ? {} : { nativeID: titleId })}
      // The `role` is hand-written because an `<h2>` has no native counterpart.
      role="heading"
      aria-level={2}
      className={cn(DIALOG_TITLE_CLASS, className)}
    >
      {children}
    </Text>
  );
}

/** The sentence under the title, read as the dialog's description. */
function DialogDescription({ className, children }: DialogSectionProps) {
  return <Text className={cn(DIALOG_DESCRIPTION_CLASS, className)}>{children}</Text>;
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
