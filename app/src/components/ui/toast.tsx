import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ViewStyle } from "react-native";
import { Platform, Pressable, Text, View } from "react-native";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "@/components/ui/icons";
import { IconClassContext } from "@/components/ui/icons-base";
import { type BottomBarUntil, useBottomBar } from "@/lib/bottom-bar";
import { cn, type SlotNode } from "@/lib/utils";

/** What kind of message a toast is, which picks its colour and how long it stays. */
export type ToastTone = "error" | "warning" | "positive" | "info";

/**
 * What a toast carries besides its words: elements to act on the message with. A function is handed
 * the toast's `dismiss`, for content that should close it — a link that navigates away.
 */
export type ToastActionSlot = SlotNode | ((dismiss: () => void) => SlotNode);

/** What else a toast can carry. */
export type ToastOptions = {
  /**
   * Elements under the message: a link-styled `Button`, an Undo, anything. Pressing them does not
   * dismiss the toast; a function `(dismiss) => …` gets the toast's `dismiss` to do that.
   */
  actionSlot?: ToastActionSlot | undefined;
};

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  actionSlot: ToastActionSlot | undefined;
};

/** Show a message. Defaults to `error`, which is what nearly every caller wants. */
type ShowToast = (message: string, tone?: ToastTone, options?: ToastOptions) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** Errors and warnings linger — the user has to read a reason; confirmations do not. */
const DURATION_MS: Record<ToastTone, number> = {
  error: 6000,
  warning: 6000,
  positive: 3000,
  info: 3000,
};

/**
 * The least time a toast with an `actionSlot` stays up: a confirmation's three seconds is enough to
 * read "Moved." and not enough to move the pointer to "Go to Media".
 */
const ACTION_MIN_DURATION_MS = 10000;

/**
 * The tone's glyph and its ink: the only place the tone's hue reaches the toast. The box is a
 * raised surface and the words are the foreground, so a toast does not read as a filled button —
 * which a block of `bg-negative` with white text beside an ✕ was — and the tone is said by a shape
 * as well as a colour.
 */
const TONE_ICON: Record<ToastTone, { glyph: ReactNode; ink: string }> = {
  error: { glyph: <CircleAlert />, ink: "text-negative" },
  warning: { glyph: <TriangleAlert />, ink: "text-warning" },
  positive: { glyph: <CircleCheck />, ink: "text-positive" },
  info: { glyph: <Info />, ink: "text-info" },
};

/**
 * `position: "fixed"` keeps the stack pinned to the viewport on web no matter
 * which scroll container the mutation was fired from. It is a real CSS value
 * that react-native-web passes through, but not one react-native's `ViewStyle`
 * admits, hence the cast. Native gets `absolute`, which resolves against the
 * router's full-screen container.
 */
const VIEWPORT_STYLE = Platform.select({
  // A set width, not the message's: "Saved." in a box its own size is a button-shaped pill.
  web: {
    position: "fixed",
    right: 16,
    bottom: 16,
    width: 384,
    maxWidth: "calc(100vw - 32px)",
    zIndex: 50,
  },
  default: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 32,
    zIndex: 50,
  },
}) as ViewStyle;

/**
 * How far the stack rises off the bottom while a layout draws a bar there — `SidebarLayout`'s
 * `barPosition="bottom"` on a phone — so a toast is never laid over the places. The bar's own
 * `min-h-14`, under the bar's own breakpoint; a margin, which a fixed or absolute box keeps from
 * the edge it is pinned to. Literal classes, per rule 3.
 */
const LIFT: Record<BottomBarUntil, string> = {
  always: "mb-14",
  sm: "mb-14 sm:mb-0",
  md: "mb-14 md:mb-0",
  lg: "mb-14 lg:mb-0",
  xl: "mb-14 xl:mb-0",
};

/** Holds the toasts and draws them over the app. Put it once, near the root. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const bottomBar = useBottomBar();

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ShowToast>(
    (message, tone = "error", options = {}) => {
      const id = nextId.current++;
      const { actionSlot } = options;
      const hasAction = actionSlot !== undefined && actionSlot !== null && actionSlot !== false;
      const duration = hasAction
        ? Math.max(DURATION_MS[tone], ACTION_MIN_DURATION_MS)
        : DURATION_MS[tone];
      setToasts((prev) => [
        ...prev,
        { id, message, tone, actionSlot: hasAction ? actionSlot : undefined },
      ]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  // A toast outlives the component that raised it, so the timer has to be
  // cleaned up here rather than at the call site.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toasts.length > 0 && (
        <View
          pointerEvents="box-none"
          style={VIEWPORT_STYLE}
          className={cn("gap-2", bottomBar && LIFT[bottomBar])}
        >
          {/*
           * The announcement and the dismiss target are two elements, not one. They were one — a
           * `Pressable` with `accessibilityRole="alert"` — and `rn2web` is what showed that to be
           * wrong: a role replaces an element's semantics rather than adding to them, so that
           * markup was an alert with a click handler nothing could reach by keyboard. The same
           * was true on device, where the role told the screen reader it was looking at a
           * message and not at something to activate.
           */}
          {toasts.map((toast) => {
            const { glyph, ink } = TONE_ICON[toast.tone];
            return (
              <View
                key={toast.id}
                accessibilityRole="alert"
                className="w-full flex-row items-start gap-3 rounded-lg border border-foreground/10 bg-secondary px-4 py-3 shadow-md"
              >
                {/* `[&_svg]:size-4` for the web, where an icon does not read the context below and
                    drew at its own 24px beside 14px text; the context sizes it on a device. */}
                <View aria-hidden className={cn("mt-0.5 shrink-0 [&_svg]:size-4", ink)}>
                  <IconClassContext.Provider value={cn("size-4 shrink-0", ink)}>
                    {glyph}
                  </IconClassContext.Provider>
                </View>
                {/* The action sits under the words rather than beside them: the toast is a set width,
                    and a link beside the message would squeeze it to a column. */}
                <View className="min-w-0 flex-1 gap-1.5">
                  <Text className="text-sm text-foreground">{toast.message}</Text>
                  {toast.actionSlot === undefined ? null : (
                    <View className="flex-row flex-wrap items-center gap-2">
                      {typeof toast.actionSlot === "function"
                        ? toast.actionSlot(() => dismiss(toast.id))
                        : toast.actionSlot}
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => dismiss(toast.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss"
                  // The ink is on the press target too, not only in the context: the glyph draws in
                  // `currentColor`, and a `<button>` resets that to the UA's black.
                  // Under the pointer, the keyboard and a finger it looks the same: hovered.
                  className="-m-1 shrink-0 rounded-md p-1 text-foreground/60 hover:bg-hover hover:text-foreground focus-visible:bg-hover focus-visible:text-foreground focus-visible:outline-none active:bg-hover [&_svg]:size-4"
                >
                  <IconClassContext.Provider value="size-4 text-foreground/60">
                    <X />
                  </IconClassContext.Provider>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </ToastContext.Provider>
  );
}

/**
 * Throws when no provider is mounted rather than silently swallowing the
 * message — a toast that never appears is the bug this module exists to fix.
 */
export function useToast(): ShowToast {
  const show = useContext(ToastContext);
  if (!show) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return show;
}
