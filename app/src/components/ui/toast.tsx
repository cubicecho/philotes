import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ViewStyle } from "react-native";
import { Platform, Pressable, Text, View } from "react-native";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "@/components/ui/icons";
import { IconClassContext } from "@/components/ui/icons-base";
import { OverlayHost, OverlayPortal, useTopLayer } from "@/components/ui/overlay";
import { announceToast } from "@/components/ui/toast-announce";
import { type BottomBarUntil, useBottomBar } from "@/lib/bottom-bar";
import { cn, hasSlot, type SlotNode, touchTarget } from "@/lib/utils";

/** The dismiss ✕'s drawn box, a 16px glyph in `p-1`, grown to a finger's 44pt on device (#470). */
const DISMISS_DRAWN = { width: 24, height: 24 } as const;

/**
 * What kind of message a toast is, which picks its colour, how long it stays and how it is
 * announced. The colour tokens' words: `negative` for a failure, `warning`, `positive` and `info`.
 * `error` is `negative`'s old name, kept working and deprecated.
 */
export type ToastTone = Tone | "error";

/** The tones, without the deprecated name. */
type Tone = "negative" | "warning" | "positive" | "info";

/** `error` was the one tone not named for its token. */
const TONE: Record<ToastTone, Tone> = {
  negative: "negative",
  error: "negative",
  warning: "warning",
  positive: "positive",
  info: "info",
};

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
  tone: Tone;
  actionSlot: ToastActionSlot | undefined;
};

/** Show a message. Defaults to `negative`, which is what nearly every caller wants. */
type ShowToast = (message: string, tone?: ToastTone, options?: ToastOptions) => void;

const ToastContext = createContext<ShowToast | null>(null);

/**
 * Five seconds at the least, so a message can be read by someone who looked away. Failures and
 * warnings stay longer: the user has to read a reason.
 */
const DURATION_MS: Record<Tone, number> = {
  negative: 6000,
  warning: 6000,
  positive: 5000,
  info: 5000,
};

/**
 * The least time a toast with an `actionSlot` stays up: a confirmation's five seconds is enough to
 * read "Moved." and not always enough to move the pointer to "Go to Media".
 */
const ACTION_MIN_DURATION_MS = 10000;

/**
 * A failure interrupts a screen reader; everything else waits for a pause (WCAG 4.1.3). A
 * warning is not a failure: nothing has stopped the user's work.
 */
const ROLE: Record<Tone, "alert" | "status"> = {
  negative: "alert",
  warning: "status",
  positive: "status",
  info: "status",
};

/**
 * How many toasts are drawn at once, the newest. A longer stack covers the page and is read as
 * noise; the older ones keep their timers, and come back if the newer go first.
 */
const MAX_VISIBLE = 3;

/**
 * The tone's glyph and its ink: the only place the tone's hue reaches the toast. The box is a
 * raised surface and the words are the foreground, so a toast does not read as a filled button —
 * which a block of `bg-negative` with white text beside an ✕ was — and the tone is said by a shape
 * as well as a colour.
 */
const TONE_ICON: Record<Tone, { glyph: ReactNode; ink: string }> = {
  negative: { glyph: <CircleAlert />, ink: "text-negative" },
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
 *
 * `zIndex` 60 is one over the dialog's 50, so a toast raised while a dialog is open is drawn over
 * its scrim rather than under it. A stacking context around the provider would cap it, which is
 * why the provider goes near the root.
 */
const VIEWPORT_STYLE = Platform.select({
  // A set width, not the message's: "Saved." in a box its own size is a button-shaped pill.
  web: {
    position: "fixed",
    right: 16,
    bottom: 16,
    width: 384,
    maxWidth: "calc(100vw - 32px)",
    zIndex: 60,
  },
  default: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 32,
    zIndex: 60,
  },
}) as ViewStyle;

/**
 * How far the stack rises off the bottom while a layout draws a bar there — `SidebarLayout`'s
 * `barPosition="bottom"` on a phone — so a toast is never laid over the places. The bar's own
 * `min-h-14` and the bottom safe-area inset the bar pads itself by (#460), under the bar's own
 * breakpoint; a margin, which a fixed or absolute box keeps from the edge it is pinned to. Literal
 * classes, per rule 3.
 */
const LIFT: Record<BottomBarUntil, string> = {
  always: "mb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)]",
  sm: "mb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] sm:mb-0",
  md: "mb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] md:mb-0",
  lg: "mb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] lg:mb-0",
  xl: "mb-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] xl:mb-0",
};

/**
 * The key that moves focus to the newest toast on the web, radix's toast's. A dialog's focus trap
 * keeps Tab from reaching the stack, so an Undo raised while one is open could be pressed and not
 * reached (#500). Sonner's Alt+T is the Tools menu in Firefox on Windows, and F6 is the browser's
 * own, to the address bar.
 */
const FOCUS_KEY = "F8";

/**
 * The stack is a landmark on the web, named with the key that reaches it, as radix's toast names
 * its own, so a screen reader can find it and learn how. A device has no landmarks.
 */
const VIEWPORT_LANDMARK = { role: "region", "aria-label": `Notifications (${FOCUS_KEY})` } as const;

/** What can take focus in a toast: its action's buttons and links, and its ✕. */
const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** What holds the timers: a pointer over a toast, or focus inside one. */
type Holds = { hovered: boolean; focused: boolean };

const NO_HOLDS: Holds = { hovered: false, focused: false };

/** A toast's timer, which can stop and start again with what it had left. */
type Timer = { remaining: number; startedAt: number; handle: ReturnType<typeof setTimeout> | null };

/** Holds the toasts and draws them over the app. Put it once, near the root. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, Timer>());
  const holds = useRef<Holds>(NO_HOLDS);
  const bottomBar = useBottomBar();
  const layer = useTopLayer();
  // The stack's element, and where focus was before it went into the stack: on the web, where a
  // toast that had focus and goes hands it back, rather than to the page's `<body>`.
  const viewport = useRef<unknown>(null);
  const before = useRef<unknown>(null);

  const dismiss = useCallback((id: number) => {
    if (Platform.OS === "web") {
      giveFocusBack(viewport.current as HTMLElement | null, before.current as HTMLElement | null);
    }
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      stopTimer(timer);
      timers.current.delete(id);
    }
    if (timers.current.size === 0) {
      // The pointer that was over the last toast, or the focus that was in it, went with it and
      // will not say so: a leave is never fired for an element that is gone.
      holds.current = NO_HOLDS;
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const startTimer = useCallback(
    (id: number, timer: Timer) => {
      timer.startedAt = Date.now();
      timer.handle = setTimeout(() => dismiss(id), timer.remaining);
    },
    [dismiss],
  );

  // A toast someone is reading or reaching for does not leave under them, so the clocks stop
  // while the pointer is over a toast or focus is in one, and go on with what they had left.
  const hold = useCallback(
    (reason: keyof Holds, on: boolean) => {
      const wasHeld = isHeld(holds.current);
      holds.current = { ...holds.current, [reason]: on };
      const held = isHeld(holds.current);
      if (held === wasHeld) {
        return;
      }
      for (const [id, timer] of timers.current) {
        if (held) {
          stopTimer(timer);
        } else {
          startTimer(id, timer);
        }
      }
    },
    [startTimer],
  );

  const show = useCallback<ShowToast>(
    (message, tone = "negative", options = {}) => {
      const id = nextId.current++;
      const { actionSlot } = options;
      const kind = TONE[tone];
      const hasAction = typeof actionSlot === "function" || hasSlot(actionSlot);
      const duration = hasAction
        ? Math.max(DURATION_MS[kind], ACTION_MIN_DURATION_MS)
        : DURATION_MS[kind];
      setToasts((prev) => [
        ...prev,
        { id, message, tone: kind, actionSlot: hasAction ? actionSlot : undefined },
      ]);
      announceToast(message, ROLE[kind] === "alert");
      const timer: Timer = { remaining: duration, startedAt: Date.now(), handle: null };
      timers.current.set(id, timer);
      if (isHeld(holds.current) === false) {
        startTimer(id, timer);
      }
    },
    [startTimer],
  );

  // F8 from anywhere on the page, a dialog included, goes to the newest toast's first button.
  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }
    const remember = (event: FocusEvent) => {
      const stack = viewport.current as HTMLElement | null;
      if (event.target instanceof HTMLElement && stack?.contains(event.target) === false) {
        before.current = event.target;
      }
    };
    const jump = (event: KeyboardEvent) => {
      if (event.key !== FOCUS_KEY || event.defaultPrevented) {
        return;
      }
      const stack = viewport.current as HTMLElement | null;
      const cards = stack?.querySelectorAll<HTMLElement>('[role="status"], [role="alert"]');
      const target = cards?.[cards.length - 1]?.querySelector<HTMLElement>(FOCUSABLE);
      if (!target) {
        return;
      }
      event.preventDefault();
      target.focus();
    };
    document.addEventListener("keydown", jump);
    document.addEventListener("focusin", remember, true);
    return () => {
      document.removeEventListener("keydown", jump);
      document.removeEventListener("focusin", remember, true);
    };
  }, []);

  // A toast outlives the component that raised it, so the timer has to be
  // cleaned up here rather than at the call site.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) {
        stopTimer(timer);
      }
      pending.clear();
    };
  }, []);

  /*
   * Drawn while empty too. radix's `hideOthers` marks everything outside an opening modal
   * `aria-hidden`, except what is a live region at that moment, so a stack mounted with its
   * first toast lands inside the hidden tree and is never announced (#477). It is empty and
   * `box-none`, so it covers nothing.
   */
  const stack = (
    <View
      testID="toast-viewport"
      ref={(element) => {
        viewport.current = element;
      }}
      aria-live="polite"
      {...(Platform.OS === "web" ? VIEWPORT_LANDMARK : {})}
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
      {toasts.slice(-MAX_VISIBLE).map((toast) => {
        const { glyph, ink } = TONE_ICON[toast.tone];
        return (
          // web: biome-ignore lint/a11y/noStaticElementInteractions: the role is a status or an alert, from a table Biome cannot read
          <View
            key={toast.id}
            role={ROLE[toast.tone]}
            onPointerEnter={() => hold("hovered", true)}
            onPointerLeave={() => hold("hovered", false)}
            onFocus={() => hold("focused", true)}
            onBlur={() => hold("focused", false)}
            className="w-full flex-row items-start gap-3 rounded-md border border-foreground/10 bg-secondary px-4 py-3 shadow-md"
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
              {typeof toast.actionSlot === "function" || hasSlot(toast.actionSlot) ? (
                <View className="flex-row flex-wrap items-center gap-2">
                  {typeof toast.actionSlot === "function"
                    ? toast.actionSlot(() => dismiss(toast.id))
                    : toast.actionSlot}
                </View>
              ) : null}
            </View>
            <Pressable
              onPress={() => dismiss(toast.id)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              {...touchTarget(DISMISS_DRAWN)}
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
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {layer === null ? stack : <OverlayPortal layer={layer}>{stack}</OverlayPortal>}
      <OverlayHost />
    </ToastContext.Provider>
  );
}

/**
 * When focus is in the stack, puts it back where it was before, ahead of a toast going: focus on an
 * element that is taken away falls to the page's `<body>`, out of the dialog it came from.
 */
function giveFocusBack(stack: HTMLElement | null, before: HTMLElement | null) {
  if (stack?.contains(document.activeElement) && before?.isConnected) {
    before.focus();
  }
}

function isHeld(holds: Holds): boolean {
  return holds.hovered || holds.focused;
}

/** Stops a timer and keeps what it had left, for `startTimer` to go on from. */
function stopTimer(timer: Timer) {
  if (timer.handle === null) {
    return;
  }
  clearTimeout(timer.handle);
  timer.handle = null;
  timer.remaining -= Date.now() - timer.startedAt;
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
