import {
  cloneElement,
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { type LayoutChangeEvent, type LayoutRectangle, Pressable, Text, View } from "react-native";
import { OverlayPortal, useTopLayer } from "@/components/ui/overlay";
import {
  placeTooltip,
  TOOLTIP_CONTENT_CLASS,
  TOOLTIP_EDGE,
  TOOLTIP_SIDE_CLASS,
  TOOLTIP_TEXT_CLASS,
  type TooltipBox,
  type TooltipContentProps,
  type TooltipProps,
  type TooltipProviderProps,
  type TooltipSide,
  type TooltipSize,
  type TooltipTriggerProps,
  tooltipVisibleMs,
} from "@/components/ui/tooltip-base";
import { addHandlers, CardBodyContext, cn } from "@/lib/utils";

type TooltipState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  /**
   * Where the trigger was last laid out in its parent, for a bubble with no layer to go in. A ref,
   * not state: every icon button has a tooltip, and a render per button per layout is paid for a
   * bubble that is rarely opened.
   */
  frame: RefObject<LayoutRectangle | null>;
  /** The trigger's element, measured in the window when the bubble opens. */
  node: { current: unknown };
  /** Counts the releases of an open bubble's trigger, so its clock starts again from each. */
  released: number;
  release: () => void;
};

const TooltipContext = createContext<TooltipState>({
  open: false,
  setOpen: () => {},
  frame: { current: null },
  node: { current: null },
  released: 0,
  release: () => {},
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
  const [released, setReleased] = useState(0);
  const frame = useRef<LayoutRectangle | null>(null);
  const node = useRef<unknown>(null);
  const release = () => setReleased((count) => count + 1);
  return (
    <TooltipContext.Provider value={{ open, setOpen, frame, node, released, release }}>
      {children}
    </TooltipContext.Provider>
  );
}

/**
 * The element the tooltip describes: hovered or focused on the web, long-pressed on device.
 *
 * With `asChild` the child is handed a `ref`, `onLongPress`, `onPressOut` and `onLayout`, and puts
 * them on the element it draws, as a `Pressable` and a `Button` do. Without the `ref` the bubble is
 * drawn beside the trigger in its parent, where a `ScrollView` clips it; without `onLayout` as well
 * it is not drawn; without `onPressOut` its clock runs from the long press alone.
 */
function TooltipTrigger({ asChild, className, children }: TooltipTriggerProps) {
  const { open, setOpen, frame, node, release } = useContext(TooltipContext);
  const show = () => setOpen(true);
  const lift = () => {
    if (open) {
      release();
    }
  };
  const measure = (event: LayoutChangeEvent) => {
    frame.current = event.nativeEvent.layout;
  };
  if (asChild && isValidElement(children)) {
    // The child's own ref still gets the element; the tooltip only needs to read it too.
    const own = (children.props as { ref?: Ref<unknown> }).ref;
    const handled = addHandlers(children, {
      onLongPress: show,
      onPressOut: lift,
      onLayout: measure,
    });
    return cloneElement(handled as ReactElement<{ ref?: Ref<unknown> }>, {
      ref: (element: unknown) => {
        node.current = element;
        if (typeof own === "function") {
          own(element);
        } else if (own) {
          own.current = element;
        }
      },
    });
  }
  return (
    <Pressable
      ref={(element) => {
        node.current = element;
      }}
      onLongPress={show}
      onPressOut={lift}
      onLayout={measure}
      className={cn(className)}
    >
      {children}
    </Pressable>
  );
}

/** An element React Native can measure in the window: a host view on device and under the web. */
type Measurable = {
  measureInWindow: (done: (x: number, y: number, width: number, height: number) => void) => void;
};

function isMeasurable(element: unknown): element is Measurable {
  return (
    typeof element === "object" &&
    element !== null &&
    typeof (element as Partial<Measurable>).measureInWindow === "function"
  );
}

/** Where the trigger is in the layer, and how big the layer is. */
type Anchor = { trigger: TooltipBox; room: TooltipSize };

/** The tooltip's bubble and its text. */
function TooltipContent({ side = "top", className, children }: TooltipContentProps) {
  const { open, setOpen, frame, node, released } = useContext(TooltipContext);
  const layer = useTopLayer();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  // A fixed 2.5s took a long hint away mid-sentence (WCAG 2.2.1), so the time grows with the text.
  // The clock runs from the long press and starts again when the finger lifts. It does not wait
  // for the lift: a release that never arrives (react-native-web drops one after a hold of a few
  // seconds) would leave the bubble up for good.
  const visibleMs = tooltipVisibleMs(children);

  // `released` is what restarts the clock; the effect does not read it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs again on each release
  useEffect(() => {
    if (open === false) {
      return;
    }
    const timer = setTimeout(() => setOpen(false), visibleMs);
    return () => clearTimeout(timer);
  }, [open, setOpen, visibleMs, released]);

  // Both are measured in the window, and the trigger placed by the difference: a layer at the root
  // of an app laid out under a status bar does not start at the window's corner.
  useEffect(() => {
    const trigger = node.current;
    const box = layer?.node.current;
    if (open === false || isMeasurable(trigger) === false || isMeasurable(box) === false) {
      setAnchor(null);
      return;
    }
    let current = true;
    trigger.measureInWindow((x, y, width, height) => {
      box.measureInWindow((left, top, roomWidth, roomHeight) => {
        if (current) {
          setAnchor({
            trigger: { x: x - left, y: y - top, width, height },
            room: { width: roomWidth, height: roomHeight },
          });
        }
      });
    });
    return () => {
      current = false;
    };
  }, [open, layer, node]);

  if (open === false) {
    return null;
  }
  if (layer !== null && isMeasurable(node.current)) {
    return anchor === null ? null : (
      <OverlayPortal layer={layer}>
        <PlacedBubble anchor={anchor} side={side} className={className}>
          {children}
        </PlacedBubble>
      </OverlayPortal>
    );
  }
  return (
    <BesideTrigger frame={frame.current} side={side} className={className}>
      {children}
    </BesideTrigger>
  );
}

type BubbleProps = { side: TooltipSide; className: string | undefined; children: ReactNode };

/**
 * The bubble in a layer. It is laid out first in a row the width of the screen less its edges, so
 * it takes its own width up to `max-w-xs` rather than the trigger's, and is hidden until that is
 * known; then it is moved into place, by a transform so its width does not change with where it
 * goes.
 */
function PlacedBubble({ anchor, side, className, children }: BubbleProps & { anchor: Anchor }) {
  const [size, setSize] = useState<TooltipSize | null>(null);
  const place = size === null ? null : placeTooltip(anchor.trigger, size, anchor.room, side);
  return (
    <View
      className="absolute top-0 items-start"
      style={{ left: TOOLTIP_EDGE, right: TOOLTIP_EDGE, pointerEvents: "none" }}
    >
      <View
        role="tooltip"
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setSize({ width, height });
        }}
        className={cn(TOOLTIP_CONTENT_CLASS, className)}
        style={
          place === null
            ? { opacity: 0 }
            : { transform: [{ translateX: place.x - TOOLTIP_EDGE }, { translateY: place.y }] }
        }
      >
        <Text className={TOOLTIP_TEXT_CLASS}>{children}</Text>
      </View>
    </View>
  );
}

/**
 * The bubble with no layer: a box over the trigger, in the trigger's parent, so the side classes
 * place the bubble against the trigger. A layout's position counts the parent's border and an
 * absolute one starts inside it, so a bordered parent moves the bubble by that border.
 */
function BesideTrigger({
  frame,
  side,
  className,
  children,
}: BubbleProps & { frame: LayoutRectangle | null }) {
  if (frame === null) {
    return null;
  }
  return (
    <View
      className="absolute z-50"
      style={{
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
        pointerEvents: "none",
      }}
    >
      <View
        role="tooltip"
        className={cn("absolute", TOOLTIP_SIDE_CLASS[side], TOOLTIP_CONTENT_CLASS, className)}
      >
        <CardBodyContext.Provider value={false}>
          <Text className={TOOLTIP_TEXT_CLASS}>{children}</Text>
        </CardBodyContext.Provider>
      </View>
    </View>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
