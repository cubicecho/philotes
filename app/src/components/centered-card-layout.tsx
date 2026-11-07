import { Platform, ScrollView, View } from "react-native";
import { CardLayout, type CardLayoutProps } from "@/components/card-layout";
import { cn, type SlotNode } from "@/lib/utils";

export type CenteredCardLayoutProps = Omit<CardLayoutProps, "className"> & {
  /** The body of the card: the form, the message. */
  contentSlot?: SlotNode | undefined;
  /**
   * The root — the full-height box the card is centred in. A background, or a different padding.
   * On device it styles the scroll view's content container, which is the box that fills the
   * screen and does the centring.
   */
  className?: string | undefined;
  /**
   * The card. It is `w-full max-w-sm`; pass `max-w-md` here for a wider one, which replaces the
   * cap rather than competing with it.
   */
  cardClassName?: string | undefined;
};

/** The box both roots centre in, and the padding that keeps the card off the screen's edge. */
const CENTRE = "items-center justify-center p-4";

/** The card's width: all of a phone, a sign-in card's width anywhere wider. */
const CARD = "w-full max-w-sm";

/**
 * A single card, centred both ways on a page of its own.
 *
 * Takes every slot `CardLayout` takes — `title`, `description`, `iconSlot`, `actionSlot`,
 * `contentSlot`, `footerSlot`, `footerActionsSlot` and the rest — and hands them to it unchanged.
 * `className` is the page around the card; `cardClassName` is the card.
 */
export function CenteredCardLayout({
  className,
  cardClassName,
  titleClassName,
  level = 1,
  ...card
}: CenteredCardLayoutProps) {
  // The card is the page here, so its title is the page's: an h1 at PageHeader level 1's text-xl,
  // not a card title barely over the field labels under it. A caller's titleClassName still wins.
  const body = (
    <CardLayout
      {...card}
      level={level}
      titleClassName={cn("text-xl", titleClassName)}
      className={cn(CARD, cardClassName)}
    />
  );

  if (Platform.OS === "web") {
    return (
      <View
        role="main"
        testID="centered-card-layout"
        className={cn("min-h-svh w-full", CENTRE, className)}
      >
        {body}
      </View>
    );
  }

  return (
    <ScrollView
      role="main"
      testID="centered-card-layout"
      className="flex-1"
      contentContainerClassName={cn("grow", CENTRE, className)}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {body}
    </ScrollView>
  );
}

/** @deprecated Use `CenteredCardLayout`; this name goes in the next release. */
export const CenteredLayout = CenteredCardLayout;
/** @deprecated Use `CenteredCardLayoutProps`; this name goes in the next release. */
export type CenteredLayoutProps = CenteredCardLayoutProps;
