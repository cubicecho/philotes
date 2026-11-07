import type { ReactNode } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import { cn, type SlotNode } from "@/lib/utils";

/** The places' row, the same in the scroller on both platforms. */
const NAV_ROW = "flex-row items-center gap-1";

/**
 * Room around the places inside their scroller, taken back by as much margin outside it. A
 * scroller clips on both axes, and an `AppBarItem`'s count sits over its icon's corner, past the
 * item's box: the padding keeps the badge inside what is drawn, and the margin keeps the bar's
 * height and the nav's width what the places alone would make them.
 */
const NAV_ROOM = "-mx-1.5 -my-1.5";
const NAV_ROOM_INSIDE = "px-1.5 py-1.5";

type NavProps = {
  navSlot: SlotNode;
  label: string;
  className: string | undefined;
};

/**
 * The places, and the bar's answer to a window narrower than all of them: they scroll sideways,
 * once `status` has given all its width away. The brand and the actions never shrink, so the
 * places are what gives after the status, and they give by moving rather than by wrapping the bar
 * to a second line or pushing an action off the screen.
 *
 * Written as statements, like `HeaderContentFooter`'s body, because the two arms are different
 * elements: `overflow` scrolls nothing on device.
 */
function Nav({ navSlot, label, className }: NavProps) {
  if (Platform.OS === "web") {
    return (
      <View
        role="navigation"
        aria-label={label}
        testID="app-bar-nav"
        className={cn("min-w-0 shrink", className)}
      >
        <View
          testID="app-bar-places"
          className={cn(NAV_ROW, NAV_ROOM, NAV_ROOM_INSIDE, "overflow-x-auto")}
        >
          {navSlot}
        </View>
      </View>
    );
  }

  return (
    <View
      role="navigation"
      aria-label={label}
      testID="app-bar-nav"
      className={cn("min-w-0 shrink", className)}
    >
      <ScrollView
        testID="app-bar-places"
        horizontal
        showsHorizontalScrollIndicator={false}
        className={NAV_ROOM}
        contentContainerClassName={cn(NAV_ROW, NAV_ROOM_INSIDE)}
      >
        {navSlot}
      </ScrollView>
    </View>
  );
}

/** The bar's navigation is a landmark, and a landmark with no name is one of several `nav`s. */
export type AppBarNav =
  | {
      /**
       * The app's places, usually `AppBarItem`s. Drawn inside a `<nav>` — `role="navigation"` on
       * device — named by `navLabel`, which is the landmark every hand-written bar either forgot
       * or spelled differently. Do not wrap them in one yourself.
       */
      navSlot: SlotNode;
      /** What the bar's navigation landmark is called — "Main". Required with `navSlot`. */
      navLabel: string;
    }
  | { navSlot?: undefined; navLabel?: never };

export type AppBarProps = {
  /** The bar's start: the app's mark and name, usually a link home. It keeps its width. */
  brandSlot?: SlotNode | undefined;
  /**
   * One line saying what state the app is in — "3/5 servers running" — between the `navSlot` and
   * the `actionSlot`. It gets the width the rest of the bar leaves and no more, so on a narrow bar
   * it is the first thing to give way: a string is cut short with an ellipsis, down to nothing,
   * before the brand, a place or an action loses a pixel. A node is clipped to the same box and
   * truncates itself.
   */
  status?: ReactNode | undefined;
  /** The bar's far end: the theme switch, account, sign out. It keeps its width. */
  actionSlot?: SlotNode | undefined;
  /** On the bar itself: its fill, its border, its height. */
  className?: string | undefined;
  /** On the navigation landmark: `hidden md:flex`, with a menu of the places in `actionSlot`. */
  navClassName?: string | undefined;
} & AppBarNav;

/**
 * A bar across the top of an app: brand, places, status, actions, in that order.
 *
 * **Two parts give way, in order.** The `status` line takes only the width left over, so it
 * shortens first; once it is gone the places scroll sideways. The brand and the actions keep
 * their width, so an action is never pushed off the edge of a phone.
 *
 * **It is the banner.** `role="banner"` (`<header>` on the web), with the places a navigation
 * landmark inside it. The page under it is the app's to mark as the `main` landmark.
 *
 * **The safe area is the app's.** On device the bar is the top of the screen, and the status bar
 * sits over it unless something insets it: wrap the app in `react-native-safe-area-context`'s
 * `SafeAreaView edges={["top"]}` (Expo ships it). Nothing in this registry measures insets.
 */
export function AppBar({
  brandSlot,
  navSlot,
  navLabel,
  status,
  actionSlot,
  className,
  navClassName,
}: AppBarProps) {
  return (
    <View
      role="banner"
      testID="app-bar"
      className={cn(
        "min-h-14 shrink-0 flex-row items-center gap-2 border-foreground/10 border-b bg-background px-4 py-2",
        className,
      )}
    >
      {brandSlot ? (
        <View testID="app-bar-brand" className="min-w-0 shrink-0 flex-row items-center gap-2">
          {brandSlot}
        </View>
      ) : null}
      {navSlot ? <Nav navSlot={navSlot} label={navLabel} className={navClassName} /> : null}
      {status ? (
        // `flex-1` is a zero basis: the status asks for no width of its own and is handed what
        // the others leave, which is what makes it the one that gives way first.
        <View testID="app-bar-status" className="min-w-0 flex-1 overflow-hidden">
          {typeof status === "string" || typeof status === "number" ? (
            <Text className="truncate text-right text-foreground/60 text-sm">{status}</Text>
          ) : (
            status
          )}
        </View>
      ) : null}
      {actionSlot ? (
        // `ml-auto` rather than a spacer, so the actions keep the far end with no status before
        // them.
        <View testID="app-bar-action" className="ml-auto shrink-0 flex-row items-center gap-1">
          {actionSlot}
        </View>
      ) : null}
    </View>
  );
}
