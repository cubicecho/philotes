import { createContext, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { AppBar, type AppBarNav } from "@/components/app-bar";
import { useOverflows } from "@/components/ui/overflows";
import { useReportBottomBar } from "@/lib/bottom-bar";
import { cn, hasSlot, INSET_FOCUS_EDGE, type SlotNode } from "@/lib/utils";

/**
 * How much of the split one pane claims. The other takes the rest.
 *
 * Fixed rungs (`sm`/`md`/`lg`) are for an inspector — a thing whose useful width is set by its
 * contents, not by the window. Proportional rungs are for a second working surface that should
 * grow with the screen. `auto` is the icon strip: as wide as what is in it.
 *
 * The scale is named rungs rather than a free number because the widths it replaces were spelled
 * every way to hand — `60%`, `320px`, `2fr`, `22rem`, `3fr/2fr`, `1fr/4fr`, `minmax(16rem,20rem)`,
 * `min-content`, `w-56`, `w-72 lg:w-80`, `w-14 lg:w-56` — with no way to read which differences
 * were decisions and which were the nearest number at the time. A width that falls between two
 * rungs is a call site choosing the nearer one, not a case for a ninth rung.
 */
export type SplitWidth =
  | "auto"
  | "sm"
  | "md"
  | "lg"
  | "fifth"
  | "two-fifths"
  | "half"
  | "two-thirds";

/**
 * The width below which the second pane stacks under the first instead of sitting beside it: a
 * column below it, a row from it up.
 *
 * Literal classes rather than a composed one, per rule 3: Tailwind's scanner reads source text, so
 * `` `${bp}:flex-row` `` names a class that is never generated. That is also why the two tables
 * below repeat themselves once per breakpoint.
 */
const STACK_BELOW = {
  never: "flex-row",
  md: "flex-col md:flex-row",
  lg: "flex-col lg:flex-row",
  xl: "flex-col xl:flex-row",
} as const;

/**
 * What the pane that carries the width wears once the two sit side by side.
 *
 * The fixed rungs are a width that may shrink (`minmax(0,20rem)` was the grid's word for it) with
 * a floor where the grid had one (`minmax(16rem,22rem)`); the proportional rungs are a flex
 * factor, with the other pane's in {@link REST}. `auto` neither grows nor shrinks, which is as
 * wide as what is in it.
 *
 * Below the breakpoint none of this applies and both panes are full-width rows.
 */
const SIZED: Record<keyof typeof STACK_BELOW, Record<SplitWidth, string>> = {
  never: {
    auto: "grow-0",
    sm: "w-80 grow-0 shrink",
    md: "w-88 min-w-64 grow-0 shrink",
    lg: "w-112 min-w-72 grow-0 shrink",
    fifth: "flex-1",
    "two-fifths": "flex-[2]",
    half: "flex-1",
    "two-thirds": "flex-[2]",
  },
  md: {
    auto: "md:grow-0",
    sm: "md:w-80 md:grow-0 md:shrink",
    md: "md:w-88 md:min-w-64 md:grow-0 md:shrink",
    lg: "md:w-112 md:min-w-72 md:grow-0 md:shrink",
    fifth: "md:flex-1",
    "two-fifths": "md:flex-[2]",
    half: "md:flex-1",
    "two-thirds": "md:flex-[2]",
  },
  lg: {
    auto: "lg:grow-0",
    sm: "lg:w-80 lg:grow-0 lg:shrink",
    md: "lg:w-88 lg:min-w-64 lg:grow-0 lg:shrink",
    lg: "lg:w-112 lg:min-w-72 lg:grow-0 lg:shrink",
    fifth: "lg:flex-1",
    "two-fifths": "lg:flex-[2]",
    half: "lg:flex-1",
    "two-thirds": "lg:flex-[2]",
  },
  xl: {
    auto: "xl:grow-0",
    sm: "xl:w-80 xl:grow-0 xl:shrink",
    md: "xl:w-88 xl:min-w-64 xl:grow-0 xl:shrink",
    lg: "xl:w-112 xl:min-w-72 xl:grow-0 xl:shrink",
    fifth: "xl:flex-1",
    "two-fifths": "xl:flex-[2]",
    half: "xl:flex-1",
    "two-thirds": "xl:flex-[2]",
  },
};

/**
 * What the other pane wears side by side: the rest. `flex-1` is a zero basis, so it takes what is
 * left rather than what its content asks for — the `minmax(0,1fr)` the grid spelled out.
 */
const REST: Record<keyof typeof STACK_BELOW, Record<"fifth" | "two-fifths" | "other", string>> = {
  never: { fifth: "flex-[4]", "two-fifths": "flex-[3]", other: "flex-1" },
  md: { fifth: "md:flex-[4]", "two-fifths": "md:flex-[3]", other: "md:flex-1" },
  lg: { fifth: "lg:flex-[4]", "two-fifths": "lg:flex-[3]", other: "lg:flex-1" },
  xl: { fifth: "xl:flex-[4]", "two-fifths": "xl:flex-[3]", other: "xl:flex-1" },
};

/**
 * Every pane's floor. `min-w-0` is rule 4: a flex item's minimum is its content, so one wide
 * table in one pane would otherwise widen it and shove the other off the screen. `grow` is what
 * lets the panes share a height the layout was given, stacked or alone, the way grid rows did.
 */
const PANE = "min-h-0 min-w-0 grow";

/**
 * The rule turns where the panes do: a hairline column between two panes side by side, a hairline
 * row between the same two stacked. Keyed by the same breakpoint as {@link STACK_BELOW} so the two
 * can never disagree about where the layout flips.
 */
const DIVIDER_AT: Record<keyof typeof STACK_BELOW, string> = {
  never: "w-px",
  md: "h-px w-full md:h-auto md:w-px",
  lg: "h-px w-full lg:h-auto lg:w-px",
  xl: "h-px w-full xl:h-auto xl:w-px",
};

/**
 * The panes' row inside the scroller a stacking split is drawn in. Stacked, it is as tall as the
 * two panes one after the other and the scroller moves it — two scrolling `HeaderContentFooter`s are
 * two screens of chrome, and a column that only grows is a phone screen nothing reaches the bottom
 * of. From the breakpoint up it is exactly the scroller's height, so the panes side by side share
 * the height the split was given and each scrolls inside itself, as before. `grow` fills a
 * scroller taller than the stack.
 *
 * `h-full` rather than a shrink: a scroller hands its content as much height as it asks for, on
 * device as on the web, so only a height said outright bounds it.
 */
const FILL_FROM = {
  md: "grow md:h-full",
  lg: "grow lg:h-full",
  xl: "grow xl:h-full",
} as const;

/** What sits between the panes. A rule is drawn flush; space is drawn with nothing in it. */
const DIVIDERS = { space: "gap-4", line: "gap-0", none: "gap-0" } as const;

/**
 * Which pane carries the width, and how much it claims. The other takes the rest.
 *
 * Two props rather than one, because a split has no main pane to measure from: naming the width
 * on the pane it applies to is the only spelling that stays true when the panes are equals. The
 * union is what stops both being set — the pair would then have to disagree about the leftover,
 * and one of them would have to silently lose.
 *
 * Neither set is an even split, which is the honest default for two surfaces with no ranking.
 */
type SplitWidths =
  | {
      /**
       * How much of the row the first pane claims, from the `SplitWidth` scale; the second takes
       * the rest. Pass this or `secondWidth`, not both. With neither, the panes split evenly.
       */
      firstWidth?: SplitWidth;
      secondWidth?: never;
    }
  | {
      firstWidth?: never;
      /**
       * How much of the row the second pane claims, from the `SplitWidth` scale; the first takes
       * the rest. Pass this or `firstWidth`, not both.
       */
      secondWidth?: SplitWidth;
    };

type SplitLayoutProps = {
  /** The leading pane. Alone, it is the whole width, so a caller never special-cases un-split. */
  firstSlot: SlotNode;
  /**
   * The trailing pane.
   *
   * Absent, the layout is one full-width column and neither a second cell nor a divider is
   * drawn. That absence is also how a pane collapses — see the component note — which is why
   * there is no `collapsed` prop and no state held here.
   */
  secondSlot?: SlotNode | undefined;
  /**
   * Below this width the two stack rather than sit side by side. `never` keeps them side by side
   * at every width — an icon strip, a kiosk, a pane already inside a media query the caller owns.
   *
   * Stacking, not hiding, is the narrow-width answer: a phone has no room for two panes, but it
   * has room for one after the other. A screen where the second pane is genuinely meaningless on
   * a phone wants a separate route for it, not a pane that is present and off-screen.
   */
  stackBelow?: keyof typeof STACK_BELOW | undefined;
  /**
   * What separates the panes: `space` is a gap, `line` is flush with a hairline rule between them,
   * and `none` is flush with nothing drawn. One prop rather than a gap and a border, because a rule
   * with a gap on both sides floats in the middle of nothing. The rule stays between the panes when
   * they stack, which a `border-r` on one pane does not.
   */
  divider?: keyof typeof DIVIDERS | undefined;
  /** On the row (or the column, once the panes stack) that holds both panes. */
  className?: string | undefined;
  /**
   * On the first pane's cell. Its width comes from `firstWidth` or `secondWidth`; this is for
   * anything else, such as a pane's own padding.
   */
  firstClassName?: string | undefined;
  /** On the second pane's cell, as `firstClassName` is on the first. */
  secondClassName?: string | undefined;
} & SplitWidths;

/**
 * Two surfaces side by side, as equals. The slots are numbered because a role pair is wrong for an
 * even split and a side pair is wrong once the panes stack or the page is RTL.
 *
 * Both panes carry `min-h-0`/`min-w-0`, so a wide child scrolls inside its pane instead of pushing
 * the other one off the screen. The divider is a rule and not a control, because nothing drags: a
 * draggable split is shadcn's `resizable`. A collapsed pane is an absent one
 * (`secondSlot={open ? nav : undefined}`), each pane owns its own loading state, and a split that
 * is vertical at every width is `HeaderContentFooter`.
 */
export function SplitLayout({
  firstSlot,
  secondSlot,
  firstWidth,
  secondWidth,
  stackBelow = "lg",
  divider = "space",
  className,
  firstClassName,
  secondClassName,
}: SplitLayoutProps) {
  // One pane carries the width and the other takes the rest. Neither given, `half` is two even
  // panes, which is the same classes on both.
  const width = secondWidth ?? firstWidth ?? "half";
  const sized = SIZED[stackBelow][width];
  const rest = REST[stackBelow][width === "fifth" || width === "two-fifths" ? width : "other"];

  // Rule 5 — an absent slot draws nothing. Not an empty cell, and not a gap still spent: with one
  // pane there is one column and it has the whole width. Its box is exactly the split's, as is a
  // row that never stacks, so neither has anything for the scroller to move.
  const hasSecond = hasSlot(secondSlot);
  const stacks = hasSecond && stackBelow !== "never";
  const [measured, overflows] = useOverflows();
  const row = hasSecond
    ? cn(STACK_BELOW[stackBelow], DIVIDERS[divider], stacks ? FILL_FROM[stackBelow] : "h-full")
    : "h-full flex-col";

  // Every split is drawn in a scroller, on both platforms, so that a stack taller than the split
  // can be scrolled to its end — see FILL_FROM. It is the same tree whether one pane is passed or
  // two, so a pane that comes and goes leaves the other mounted: an editor's textarea keeps its
  // undo history when its preview pane is shut.
  return (
    <ScrollView
      testID="split-layout"
      ref={(node) => {
        measured.current = node;
      }}
      // A stack taller than the split scrolls, and a scroller a keyboard cannot reach is one only a
      // mouse wheel moves (axe `scrollable-region-focusable`). So it is a tab stop while it
      // overflows; side by side it never does, and each pane's body takes its own.
      tabIndex={overflows ? 0 : undefined}
      className={cn("min-h-0 min-w-0", INSET_FOCUS_EDGE, className)}
      contentContainerClassName={cn("min-w-0", row)}
    >
      <View
        testID="split-layout-first"
        className={cn(PANE, hasSecond ? (secondWidth ? rest : sized) : undefined, firstClassName)}
      >
        {firstSlot}
      </View>
      {hasSecond && divider === "line" ? (
        // The rule is an element of its own rather than a border on a pane, so that when the
        // panes stack it becomes a row between them instead of a line down one side of the screen.
        <View
          testID="split-layout-divider"
          aria-hidden
          className={cn("shrink-0 self-stretch bg-foreground/10", DIVIDER_AT[stackBelow])}
        />
      ) : null}
      {hasSecond ? (
        <View
          testID="split-layout-second"
          className={cn(PANE, secondWidth ? sized : rest, secondClassName)}
        >
          {secondSlot}
        </View>
      ) : null}
    </ScrollView>
  );
}

/**
 * The sidebar pane under {@link SidebarLayout}'s `sidebarHideBelow`: not drawn under the
 * breakpoint, drawn from it up. The same breakpoints, and the same media query in the stylesheet,
 * as `Sidebar`'s `hideBelow`, so the first paint is already right on both halves.
 *
 * A pane is a flex column, so it comes back as `flex`. Literal classes per rule 3.
 */
const SIDEBAR_HIDE_BELOW = {
  sm: "hidden sm:flex",
  md: "hidden md:flex",
  lg: "hidden lg:flex",
  xl: "hidden xl:flex",
} as const;

/**
 * The bar's half of the same switch: drawn under the breakpoint, gone from it up. Keyed by the
 * same names as {@link SIDEBAR_HIDE_BELOW} so the two can never disagree about where the sidebar
 * hands over to the bar.
 */
const HEADER_HIDE_FROM = {
  sm: "sm:hidden",
  md: "md:hidden",
  lg: "lg:hidden",
  xl: "xl:hidden",
} as const;

/** The column the content pane becomes once a bar sits over it. */
const COLUMN = "min-h-0 min-w-0 flex-1";

/** Under the bar: the caller's node, in the box a pane would have given it (see PANE). */
const BELOW_HEADER = "min-h-0 min-w-0 flex-1";

/**
 * The bottom bar's padding under its places: its own 8px on top of the bottom safe-area inset, so
 * its fill runs under a phone's home indicator, as a tab bar's does, and the places sit above it.
 *
 * `env()` rather than `useSafeAreaInsets`, so the shell adds no dependency, and because that hook
 * reads zero on the web under Expo Router. On device react-native-css fills `env()` from the
 * `SafeAreaProvider` at the app's root, which expo-router supplies. On the web it is the inset of
 * a home-screen app with `viewport-fit=cover`, and 0 anywhere else.
 */
const BOTTOM_BAR_INSET = "pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]";

/** The bar's navigation is a landmark, and a landmark with no name is one of several `nav`s. */
type SidebarLayoutNav =
  | {
      /**
       * The bar's navigation: the app's places, usually as icon links. Drawn inside a `<nav>` —
       * `role="navigation"` on device — named by `navLabel`, which is the landmark every
       * hand-written bar either forgot or spelled differently.
       */
      navSlot: SlotNode;
      /** What the bar's navigation landmark is called — "Main". Required with `navSlot`. */
      navLabel: string;
    }
  | { navSlot?: undefined; navLabel?: never };

/**
 * Either the sidebar is drawn at every width, and the layout places two panes the way it always
 * has, or it is hidden under `sidebarHideBelow` and a bar stands in for it there.
 */
type SidebarLayoutNarrow =
  | {
      sidebarHideBelow?: undefined;
      /** Below this width the two stack rather than sit side by side. See {@link SplitLayout}. */
      stackBelow?: keyof typeof STACK_BELOW | undefined;
      /**
       * What separates the panes: `space` is a gap, `line` is flush with a hairline rule between
       * them, and `none` is flush with nothing drawn, as on `SplitLayout`. With `sidebarHideBelow`,
       * `line` is out.
       */
      divider?: keyof typeof DIVIDERS | undefined;
      brandSlot?: never;
      navSlot?: never;
      navLabel?: never;
      status?: never;
      actionSlot?: never;
      barPosition?: never;
    }
  | ({
      /**
       * Under this width the sidebar pane is not drawn and an `AppBar` — `brandSlot`, `navSlot`,
       * `status`, `actionSlot` — is drawn over `contentSlot` in its place; from it up, the other
       * way round. For an app's navigation rail, which has no room on a phone and does not stack.
       *
       * Hidden is `display: none`, so the rail leaves the accessibility tree rather than staying a
       * landmark with nothing visible in it, and the bar is a banner only where it is on screen.
       * Given this, leave `Sidebar`'s own `hideBelow` off: the layout owns the breakpoint, so the
       * rail and the bar cannot be told two different ones.
       */
      sidebarHideBelow: keyof typeof SIDEBAR_HIDE_BELOW;
      /** A rail that hides does not stack — under the breakpoint there is nothing to stack. */
      stackBelow?: never;
      /**
       * `line` is out: the rule is drawn between the panes, and with the sidebar gone it would be
       * a line down the edge of the screen. A `Sidebar` draws its own border; pass `none`.
       */
      divider?: "space" | "none" | undefined;
      /** The bar's start: the app's mark and name, as the rail's header shows them. */
      brandSlot?: SlotNode | undefined;
      /**
       * One line saying what state the app is in — "3/5 servers running" — between the `navSlot`
       * and the `actionSlot`. It gets the width the rest of the bar leaves, so on a narrow bar it
       * is the first thing to give way: a string wraps onto a second line, and more, down to its
       * longest word, and is never cut short. Past that the places scroll. A node is clipped to
       * the width left over, down to nothing, and truncates itself.
       */
      status?: ReactNode | undefined;
      /** The bar's far end: the theme switch, sign out — the rail's footer, in one row. */
      actionSlot?: SlotNode | undefined;
      /**
       * Where the `navSlot` is drawn under the breakpoint. `top`, the default, is in the bar with
       * the rest. `bottom` is a bar of its own under the page, the places spread across it, which
       * is where a phone's thumb is and where Android and iOS apps put them. The brand, the
       * `status` and the `actionSlot` stay in the bar at the top.
       *
       * The bottom bar takes the bottom safe-area inset itself: it pads its places above the home
       * indicator and its fill runs under it to the screen's edge, as a tab bar's does. So the
       * app's `SafeAreaView` leaves the bottom edge out (`edges={["top", "left", "right"]}`), or
       * the inset is counted twice. The top inset is still the app's.
       */
      barPosition?: "top" | "bottom" | undefined;
    } & SidebarLayoutNav);

type SidebarLayoutProps = {
  /**
   * The main surface — the one the screen is about. Alone, it is the whole width, so a caller
   * never has to special-case the un-split state.
   */
  contentSlot: SlotNode;
  /**
   * The second surface: a navigation column, an inspector, a note list, an order panel.
   *
   * Absent, the pane is one full-width column and neither a sidebar cell nor a divider is drawn.
   */
  sidebarSlot?: SlotNode | undefined;
  /** Which side the sidebar sits on. Stacked, it keeps this reading order rather than jumping. */
  sidebarPosition?: "start" | "end" | undefined;
  /**
   * The sidebar's width, from the {@link SplitWidth} scale. Naming the width is what stops eight
   * call sites each inventing one.
   */
  sidebarWidth?: SplitWidth | undefined;
  /** On the split that holds the content and the sidebar, as `SplitLayout`'s `className`. */
  className?: string | undefined;
  /** On the content's pane. */
  contentClassName?: string | undefined;
  /** On the sidebar's pane. Its width comes from `sidebarWidth`. */
  sidebarClassName?: string | undefined;
  /** On the `AppBar`, when `sidebarHideBelow` draws one. */
  headerClassName?: string | undefined;
  /** On the bar along the bottom, when `barPosition="bottom"` draws one. */
  bottomBarClassName?: string | undefined;
} & SidebarLayoutNarrow;

/**
 * Which edge {@link SidebarLayout} put its sidebar on, for a `Sidebar` inside it: the sidebar draws
 * its border on the edge facing the content, and without this it guessed `start` while the layout's
 * default is `end`, so the rule landed on the frame's outer edge and nothing parted it from the page.
 * `undefined` outside a `SidebarLayout`.
 */
export const SidebarPositionContext = createContext<"start" | "end" | undefined>(undefined);

/**
 * Which edge of the screen the bar an `AppBarItem` sits in runs along, so its tooltip opens away
 * from that edge. `top` outside `SidebarLayout`'s bottom bar. The web's tooltip turns away from an
 * edge it would cross; a device's is drawn on the side it is told, and off the screen below a
 * bottom bar.
 */
export const AppBarEdgeContext = createContext<"top" | "bottom">("top");

/**
 * {@link SplitLayout} with the roles put back: a main surface, and a sidebar beside it. A preset
 * rather than a second implementation; for two comparable panes use `SplitLayout` and its numbered
 * slots.
 *
 * `sidebarHideBelow` is the app shell's narrow width: under it the rail is hidden and an `AppBar`
 * holding the brand, the `navSlot`, the `status` and the `actionSlot` is drawn over the page, both
 * from the one breakpoint. Which of the two is drawn is a media query, not state.
 *
 * `barPosition="bottom"` moves the `navSlot` out of that bar into one along the bottom of the
 * page, still the one navigation landmark named by `navLabel`.
 */
export function SidebarLayout({
  contentSlot,
  sidebarSlot,
  sidebarPosition = "end",
  sidebarWidth = "sm",
  sidebarHideBelow,
  stackBelow = "lg",
  divider = "space",
  brandSlot,
  navSlot,
  navLabel,
  status,
  actionSlot,
  barPosition = "top",
  className,
  contentClassName,
  sidebarClassName,
  headerClassName,
  bottomBarClassName,
}: SidebarLayoutProps) {
  const navAtBottom = barPosition === "bottom";
  const hasNav = hasSlot(navSlot);
  const topNavSlot = navAtBottom ? undefined : navSlot;
  const hasTopBar =
    hasSlot(brandSlot) || hasSlot(topNavSlot) || hasSlot(status) || hasSlot(actionSlot);
  // Told to the toasts, so one raised on a phone sits above the places rather than over them.
  useReportBottomBar(navAtBottom && hasNav && sidebarHideBelow ? sidebarHideBelow : undefined);
  // Rule 5 — the bar, and the column it sits in, are drawn only when there is something in the
  // bar. Without one the content pane holds the caller's node exactly as it always has.
  // Built in an `if`, not a ternary: a ternary of two object literals is widened into one shape
  // with both keys optional, which `AppBar`'s either-or nav props reject under
  // `exactOptionalPropertyTypes`.
  let barNav: AppBarNav = {};
  if (hasSlot(topNavSlot) && navLabel !== undefined) {
    barNav = { navSlot: topNavSlot, navLabel };
  }
  const main =
    sidebarHideBelow && (hasTopBar || hasNav) ? (
      <View testID="sidebar-layout-main" className={COLUMN}>
        {/* Rule 5 again: with the places along the bottom and nothing else given, there is no
            bar at the top to draw. */}
        {hasTopBar ? (
          <AppBar
            brandSlot={brandSlot}
            {...barNav}
            status={status}
            actionSlot={actionSlot}
            className={cn(HEADER_HIDE_FROM[sidebarHideBelow], headerClassName)}
          />
        ) : null}
        <View testID="sidebar-layout-content" className={BELOW_HEADER}>
          {contentSlot}
        </View>
        {navAtBottom && hasNav ? (
          // The landmark is the bar itself: there is nothing else in it to tell apart from the
          // places. `justify-around` spreads them over the width, each with the same room.
          <View
            role="navigation"
            aria-label={navLabel}
            testID="sidebar-layout-bottom-bar"
            className={cn(
              "min-h-14 shrink-0 flex-row items-center justify-around gap-2 border-foreground/10 border-t bg-background px-4 pt-2",
              BOTTOM_BAR_INSET,
              HEADER_HIDE_FROM[sidebarHideBelow],
              bottomBarClassName,
            )}
          >
            <AppBarEdgeContext.Provider value="bottom">{navSlot}</AppBarEdgeContext.Provider>
          </View>
        ) : null}
      </View>
    ) : (
      contentSlot
    );

  // No sidebar is one pane, and `firstSlot` is the one that is there — passing an absent
  // `firstSlot` with a present `secondSlot` would be a hole in the middle of the row.
  if (hasSlot(sidebarSlot) === false) {
    return <SplitLayout firstSlot={main} firstClassName={contentClassName} className={className} />;
  }

  const atStart = sidebarPosition === "start";
  const railClassName = sidebarHideBelow
    ? cn(SIDEBAR_HIDE_BELOW[sidebarHideBelow], sidebarClassName)
    : sidebarClassName;

  return (
    <SidebarPositionContext.Provider value={sidebarPosition}>
      <SplitLayout
        firstSlot={atStart ? sidebarSlot : main}
        secondSlot={atStart ? main : sidebarSlot}
        firstClassName={atStart ? railClassName : contentClassName}
        secondClassName={atStart ? contentClassName : railClassName}
        {...(atStart ? { firstWidth: sidebarWidth } : { secondWidth: sidebarWidth })}
        stackBelow={sidebarHideBelow ? "never" : stackBelow}
        divider={divider}
        className={className}
      />
    </SidebarPositionContext.Provider>
  );
}
