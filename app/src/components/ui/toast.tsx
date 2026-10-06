import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ViewStyle } from 'react-native';
import { Platform, Pressable, Text, View } from 'react-native';

export type ToastTone = 'error' | 'warning' | 'positive' | 'info';

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

const TONE_CLASS: Record<ToastTone, string> = {
  error: 'bg-negative',
  warning: 'bg-warning',
  positive: 'bg-positive',
  info: 'bg-info',
};

const TONE_TEXT_CLASS: Record<ToastTone, string> = {
  error: 'text-negative-foreground',
  warning: 'text-warning-foreground',
  positive: 'text-positive-foreground',
  info: 'text-info-foreground',
};

/**
 * `position: "fixed"` keeps the stack pinned to the viewport on web no matter
 * which scroll container the mutation was fired from. It is a real CSS value
 * that react-native-web passes through, but not one react-native's `ViewStyle`
 * admits, hence the cast. Native gets `absolute`, which resolves against the
 * router's full-screen container.
 */
const VIEWPORT_STYLE = Platform.select({
  web: { position: 'fixed', right: 16, bottom: 16, zIndex: 50 },
  default: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 32,
    zIndex: 50,
  },
}) as unknown as ViewStyle;

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
    (message, tone = 'error') => {
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
      for (const timer of pending.values()) clearTimeout(timer);
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
          {toasts.map((toast) => (
            <View
              key={toast.id}
              accessibilityRole="alert"
              className={`max-w-sm flex-row items-start gap-3 rounded-lg px-4 py-3 shadow-lg ${TONE_CLASS[toast.tone]}`}
            >
              <Text className={`flex-1 text-sm ${TONE_TEXT_CLASS[toast.tone]}`}>{toast.message}</Text>
              <Pressable
                onPress={() => dismiss(toast.id)}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                className="shrink-0"
              >
                <Text className={`text-sm font-medium ${TONE_TEXT_CLASS[toast.tone]}`}>×</Text>
              </Pressable>
            </View>
          ))}
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
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return show;
}
