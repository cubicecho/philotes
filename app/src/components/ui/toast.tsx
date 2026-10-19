import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ViewStyle } from "react-native";
import { Platform, Pressable, Text, View } from "react-native";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "@/components/ui/icons";
import { IconClassContext } from "@/components/ui/icons-base";
import { cn } from "@/lib/utils";

/** What kind of message a toast is, which picks its colour and how long it stays. */
export type ToastTone = "error" | "warning" | "positive" | "info";

type Toast = { id: number; message: string; tone: ToastTone };

/** Show a message. Defaults to `error`, which is what nearly every caller wants. */
type ShowToast = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ShowToast | null>(null);

/** Errors and warnings linger — the user has to read a reason; confirmations do not. */
const DURATION_MS: Record<ToastTone, number> = {
  error: 6000,
  warning: 6000,
  positive: 3000,
  info: 3000,
};

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

/** Holds the toasts and draws them over the app. Put it once, near the root. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ShowToast>(
    (message, tone = "error") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, tone }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION_MS[tone]),
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
        <View pointerEvents="box-none" style={VIEWPORT_STYLE} className="gap-2">
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
                className="w-full flex-row items-start gap-3 rounded-lg border border-foreground/10 bg-secondary px-4 py-3 shadow-lg"
              >
                <View aria-hidden className={cn("mt-0.5 shrink-0", ink)}>
                  <IconClassContext.Provider value={cn("size-4 shrink-0", ink)}>
                    {glyph}
                  </IconClassContext.Provider>
                </View>
                <Text className="flex-1 text-sm text-foreground">{toast.message}</Text>
                <Pressable
                  onPress={() => dismiss(toast.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss"
                  // The ink is on the press target too, not only in the context: the glyph draws in
                  // `currentColor`, and a `<button>` resets that to the UA's black.
                  className="-m-1 shrink-0 rounded-md p-1 text-foreground/60"
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
