import { Slot } from "@radix-ui/react-slot";
import {
  Children,
  cloneElement,
  createContext,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { IconClassContext } from "@/components/ui/icons-base";
import { useReducedMotion } from "@/components/ui/reduced-motion";
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
import {
  type RovingKeyEvent,
  type RovingSet,
  useRovingFocus,
  useRovingItem,
} from "@/lib/roving-focus";
import { cn, FOCUS_EDGE, touchRowClass } from "@/lib/utils";

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

type TabsListState = RovingSet & {
  /** How a trigger tells its list where the selected tab is, so the list can bring it into view. */
  reveal: (tab: Span) => void;
  /** The one tab Tab lands on. */
  tabStop: string | undefined;
  /** An arrow key, Home or End on the tab `from`. */
  move: (from: string, event: RovingKeyEvent) => void;
};

const TabsListContext = createContext<TabsListState>({
  reveal: () => {},
  tabStop: undefined,
  move: () => {},
  register: () => {},
  unregister: () => {},
});

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
  const animated = useReducedMotion() === false;
  const tabs = useContext(TabsContext);
  // Automatic activation, radix's default and the web half's: the tab an arrow lands on is shown.
  const roving = useRovingFocus({
    current: tabs.value,
    onMove: tabs.setValue,
    orientation: "horizontal",
  });

  const reveal = () => {
    const tab = selected.current;
    // The triggers can be laid out before the scroller is; it calls back when it has a width.
    if (!tab || viewport.current === 0) {
      return;
    }
    const end = tab.x + tab.width;
    if (tab.x < offset.current) {
      scroller.current?.scrollTo({ x: Math.max(0, tab.x - TABS_LIST_INSET), animated });
    } else if (end > offset.current + viewport.current) {
      scroller.current?.scrollTo({ x: end - viewport.current + TABS_LIST_INSET, animated });
    }
  };

  // A `tab` outside a `tablist` is an orphan to a screen reader, and axe says so. The role is on
  // the box rather than the scroller inside it, so the scrolling is part of the tablist.
  return (
    <View
      role="tablist"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      // `self-start`: as wide as its tabs, as the web half's `inline-flex` list is, where a column
      // stretched it across. A caller who wants it across passes `self-stretch`.
      className={cn("max-w-full self-start flex-row", TABS_LIST_CLASS, className)}
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
        // `grow` so tabs that fit are centred in a list stretched wider than they are.
        contentContainerClassName="grow flex-row items-center justify-center"
      >
        <TabsListContext.Provider
          value={{
            ...roving,
            reveal: (tab) => {
              selected.current = tab;
              reveal();
            },
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
  const list = useContext(TabsListContext);
  const { reveal } = list;
  const ref = useRovingItem<View>(list, value, disabled);
  const span = useRef<Span | undefined>(undefined);
  const active = tabs.value === value;
  // Web only: a device has no Tab key, and a `tabIndex` there would do nothing for a screen reader.
  const keys =
    Platform.OS === "web"
      ? {
          tabIndex: list.tabStop === value ? (0 as const) : (-1 as const),
          onKeyDown: (event: RovingKeyEvent) => list.move(value, event),
        }
      : {};
  // A quiet tab lifts to full ink under the pointer and focused, as the web half's does; the colour
  // is on each `Text`, which only the pressable's `group` reaches. Web only: a device has no
  // pointer, and no keyboard focus to show.
  const color = active
    ? "text-foreground"
    : cn(
        "text-foreground/60",
        Platform.select({
          web: "group-hover:text-foreground group-focus-visible:text-foreground",
          default: "",
        }),
      );

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
    // 44pt on device, a finger's target, and the list grows to hold it: the scroller clips a touch
    // at its edge, so the tab has to be that tall itself rather than reach it with a `hitSlop`.
    touchRowClass(),
    // The active tab is the chosen tint, a step further under the pointer, focused and pressed;
    // another looks hovered then, as the web half's does. Neither draws a ring.
    "focus-visible:outline-none",
    active
      ? "bg-active/40 hover:bg-active/60 focus-visible:bg-active/60 active:bg-active/60"
      : "group hover:bg-hover focus-visible:bg-hover active:bg-hover",
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
            ...keys,
            ...(typeof linkSlot.type === "string" ? { onClick: select } : { onPress: select }),
          } as unknown as HTMLAttributes<HTMLElement>)}
          ref={ref as unknown as Ref<HTMLElement>}
        >
          {cloneElement(linkSlot as ReactElement, undefined, inside)}
        </Slot>
      </IconClassContext.Provider>
    );
  }

  const tab = (
    <Pressable
      ref={ref}
      role="tab"
      {...keys}
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
    <View
      role="tabpanel"
      // A tab stop under Expo web, as radix's panel is on the web, so Tab reaches the pane from its
      // tab even when nothing in it takes focus. A device has no Tab key.
      {...(Platform.OS === "web" ? { tabIndex: 0 as const } : {})}
      // Nothing in the pane looks hovered, so it shows focus as a scroll box does: its edge turns
      // `active`. A border, not the inset line, which a card filling the pane would cover.
      className={cn("mt-2 rounded-md", FOCUS_EDGE, className)}
    >
      {children}
    </View>
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
