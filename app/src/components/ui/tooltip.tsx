import {
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  useContext,
  useEffect,
  useState,
} from "react";
import { Pressable, Text, View } from "react-native";
import {
  TOOLTIP_CONTENT_CLASS,
  TOOLTIP_SIDE_CLASS,
  TOOLTIP_TEXT_CLASS,
  type TooltipContentProps,
  type TooltipProps,
  type TooltipProviderProps,
  type TooltipTriggerProps,
} from "@/components/ui/tooltip-base";
import { cn } from "@/lib/utils";

type TooltipState = { open: boolean; setOpen: (open: boolean) => void };

const TooltipContext = createContext<TooltipState>({
  open: false,
  setOpen: () => {},
});

/**
 * Nothing to provide on native; kept so call sites need not branch.
 *
 * `delayDuration` and `skipDelayDuration` are accepted and ignored. They describe
 * hover timing, and there is no hover here — the delay a touch user experiences is
 * the long press itself, which the platform already times.
 */
function TooltipProvider({ children }: TooltipProviderProps) {
  return children;
}

/** The root of a tooltip: it holds the open state. */
function Tooltip({ children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <View className="relative">{children}</View>
    </TooltipContext.Provider>
  );
}

/** The element the tooltip describes: hovered or focused on the web, long-pressed on device. */
function TooltipTrigger({ asChild, className, children }: TooltipTriggerProps) {
  const { setOpen } = useContext(TooltipContext);
  const show = () => setOpen(true);
  if (asChild && isValidElement(children)) {
    // The child's own long press still runs: the tooltip is added to it, not swapped in for it.
    const child = children as ReactElement<{ onLongPress?: (() => void) | undefined }>;
    return cloneElement(child, {
      onLongPress: () => {
        child.props.onLongPress?.();
        show();
      },
    });
  }
  return (
    <Pressable onLongPress={show} className={cn(className)}>
      {children}
    </Pressable>
  );
}

/** How long the bubble stays up before dismissing itself. */
const VISIBLE_MS = 2500;

/** The tooltip's bubble and its text. */
function TooltipContent({ side = "top", className, children }: TooltipContentProps) {
  const { open, setOpen } = useContext(TooltipContext);

  useEffect(() => {
    if (open === false) {
      return;
    }
    const timer = setTimeout(() => setOpen(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [open, setOpen]);

  if (open === false) {
    return null;
  }
  return (
    <View
      role="tooltip"
      className={cn("absolute z-50", TOOLTIP_SIDE_CLASS[side], TOOLTIP_CONTENT_CLASS, className)}
      pointerEvents="none"
    >
      <Text className={TOOLTIP_TEXT_CLASS}>{children}</Text>
    </View>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
