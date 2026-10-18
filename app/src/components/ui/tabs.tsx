import { Slot } from "@radix-ui/react-slot";
import {
  Children,
  cloneElement,
  createContext,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { IconClassContext } from "@/components/ui/icons-base";
import {
  TABS_LIST_CLASS,
  TABS_LIST_INSET,
  TABS_TRIGGER_CLASS,
  TABS_TRIGGER_TEXT_CLASS,
  type TabsContentProps,
  type TabsListProps,
  type TabsProps,
  type TabsTriggerProps,
} from "@/components/ui/tabs-base";
import { cn } from "@/lib/utils";

type TabsState = { value: string; setValue: (value: string) => void };

const TabsContext = createContext<TabsState>({ value: "", setValue: () => {} });

/** The root of a set of tabs: it holds which one is active. */
function Tabs({ value: controlled, onValueChange, defaultValue, className, children }: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const value = controlled ?? uncontrolled;
  const setValue = (next: string) => {
    if (controlled === undefined) {
      setUncontrolled(next);
    }
    onValueChange?.(next);
  };
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <View className={cn(className)}>{children}</View>
    </TabsContext.Provider>
  );
}

/** Where a tab sits in the row: its near edge and its width. */
type Span = { x: number; width: number };

/** How a trigger tells its list where the selected tab is, so the list can bring it into view. */
const TabsListContext = createContext<(tab: Span) => void>(() => {});

/** The row of tab buttons. */
function TabsList({
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
  children,
}: TabsListProps) {
  const scroller = useRef<ScrollView>(null);
  // Refs, not state: none of the three is drawn, and a scroll would otherwise render the row.
  const viewport = useRef(0);
  const offset = useRef(0);
  const selected = useRef<Span | undefined>(undefined);

  const reveal = () => {
    const tab = selected.current;
    // The triggers can be laid out before the scroller is; it calls back when it has a width.
    if (!tab || viewport.current === 0) {
      return;
    }
    const end = tab.x + tab.width;
    if (tab.x < offset.current) {
      scroller.current?.scrollTo({ x: Math.max(0, tab.x - TABS_LIST_INSET) });
    } else if (end > offset.current + viewport.current) {
      scroller.current?.scrollTo({ x: end - viewport.current + TABS_LIST_INSET });
    }
  };

  // A `tab` outside a `tablist` is an orphan to a screen reader, and axe says so. The role is on
  // the box rather than the scroller inside it, so the scrolling is part of the tablist.
  return (
    <View
      role="tablist"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn("max-w-full flex-row", TABS_LIST_CLASS, className)}
    >
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.width;
          reveal();
        }}
        onScroll={(event) => {
          offset.current = event.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        className="shrink grow"
        // `grow` so tabs that fit are centred in the list, as they were before it scrolled.
        contentContainerClassName="grow flex-row items-center justify-center"
      >
        <TabsListContext.Provider
          value={(tab) => {
            selected.current = tab;
            reveal();
          }}
        >
          {children}
        </TabsListContext.Provider>
      </ScrollView>
    </View>
  );
}

/**
 * A trigger's children with each run of strings and numbers in one `<Text>`,
 * and anything else (an icon, a badge) beside it in the row. An SVG is not
 * valid inside a `<Text>` on device, and a run is kept whole so `{count} open`
 * stays one label rather than two pieces spaced apart by the row's gap.
 */
function label(children: ReactNode, className: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let run: (string | number)[] = [];
  const flush = () => {
    if (run.length === 0) {
      return;
    }
    parts.push(
      <Text key={`text-${parts.length}`} className={className}>
        {run.join("")}
      </Text>,
    );
    run = [];
  };
  for (const child of Children.toArray(children)) {
    if (typeof child === "string" || typeof child === "number") {
      run.push(child);
    } else {
      flush();
      parts.push(child);
    }
  }
  flush();
  return parts;
}

/** One tab's button, which shows the pane with the same `value`. */
function TabsTrigger({
  value,
  disabled = false,
  className,
  children,
  trailingSlot,
  linkSlot,
}: TabsTriggerProps) {
  const tabs = useContext(TabsContext);
  const reveal = useContext(TabsListContext);
  const span = useRef<Span | undefined>(undefined);
  const active = tabs.value === value;
  const color = active ? "text-active-foreground" : "text-foreground/60";

  // Chosen from somewhere other than a press — a link, the caller's own state — the tab may be
  // off the end of the row. `reveal` is the list's, new every render, and not what this follows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the tab becomes active
  useEffect(() => {
    if (active && span.current) {
      reveal(span.current);
    }
  }, [active]);

  const styling = cn(
    TABS_TRIGGER_CLASS,
    active ? "bg-active" : "hover:bg-hover",
    disabled && "opacity-50",
    className,
  );
  // Text colour does not inherit on native, so the active/inactive split lands on each `<Text>`
  // and, through the context, on each icon — the container's colour reaches neither.
  const iconClass = cn("size-4 shrink-0", color);
  const inside = (
    <>
      {label(children, cn(TABS_TRIGGER_TEXT_CLASS, color))}
      {trailingSlot}
    </>
  );

  if (linkSlot !== undefined && Platform.OS === "web") {
    // Drawn as the link, as `Button`'s `linkSlot` is: a DOM `<a>` takes the press as a click, a
    // router's link is a component and takes `onPress`.
    const select = () => {
      if (disabled === false) {
        tabs.setValue(value);
      }
    };
    return (
      <IconClassContext.Provider value={iconClass}>
        {/* `Slot` is typed for the DOM; the element that receives these is the caller's. */}
        <Slot
          {...({
            role: "tab",
            "aria-selected": active,
            "aria-disabled": disabled,
            className: cn("flex", styling),
            ...(typeof linkSlot.type === "string" ? { onClick: select } : { onPress: select }),
          } as unknown as HTMLAttributes<HTMLElement>)}
        >
          {cloneElement(linkSlot as ReactElement, undefined, inside)}
        </Slot>
      </IconClassContext.Provider>
    );
  }

  const tab = (
    <Pressable
      role="tab"
      onLayout={(event) => {
        const { x, width } = event.nativeEvent.layout;
        span.current = { x, width };
        if (active) {
          reveal(span.current);
        }
      }}
      aria-selected={active}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => tabs.setValue(value)}
      className={styling}
    >
      <IconClassContext.Provider value={iconClass}>{inside}</IconClassContext.Provider>
    </Pressable>
  );
  if (linkSlot === undefined) {
    return tab;
  }
  // On device the link wraps the tab: expo-router's takes its child with `asChild`.
  return cloneElement(linkSlot as ReactElement<{ asChild?: boolean }>, { asChild: true }, tab);
}

/** One tab's pane, rendered while its tab is active. */
function TabsContent({ value, className, children }: TabsContentProps) {
  const tabs = useContext(TabsContext);
  if (tabs.value !== value) {
    return null;
  }
  return (
    <View role="tabpanel" className={cn("mt-2", className)}>
      {children}
    </View>
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
