import * as React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ColorBar } from '@/components/ui/color-bar';
import { cn } from '@/lib/utils';

// `className` is re-declared rather than inherited: nativewind types it as
// `className?: string`, which under `exactOptionalPropertyTypes` rejects the
// conditional `cond ? 'x' : undefined` several call sites pass.
type ViewProps = Omit<React.ComponentProps<typeof View>, 'className'> & {
  className?: string | undefined;
};
type TextProps = Omit<React.ComponentProps<typeof Text>, 'className'> & {
  className?: string | undefined;
};

type CardProps = ViewProps & {
  /** Renders a left-edge ColorBar along with the positioning it requires. */
  accentColor?: string | null | undefined;
  /** What the accent colour stands for, for anyone who cannot see it. */
  accentLabel?: string | undefined;
  /**
   * Makes the whole card a target. A card that takes this renders a
   * `Pressable` instead of a `View` — a `View` has no press handling on
   * native, and an `onClick` on a plain `div` is not reachable by keyboard.
   */
  onPress?: React.ComponentProps<typeof Pressable>['onPress'] | undefined;
};

const Card = React.forwardRef<React.ElementRef<typeof View>, CardProps>(
  ({ className, accentColor, accentLabel, onPress, children, ...props }, ref) => {
    const classes = cn(
      'rounded-lg border border-foreground/10 bg-secondary text-foreground shadow-sm',
      accentColor && 'relative overflow-hidden',
      className,
    );
    const inner = (
      <>
        <ColorBar color={accentColor} label={accentLabel} />
        {children}
      </>
    );

    // The two containers are written out rather than picked with `const Container = onPress ?
    // Pressable : View`. They do not actually share a prop list — only one of them takes a press
    // handler — and `rn2web` refuses an element chosen at runtime, because the tag it emits, the
    // reset class it carries and the role it infers all follow from knowing which one it is.
    if (onPress) {
      return (
        <Pressable ref={ref} onPress={onPress} role="button" className={classes} {...props}>
          {inner}
        </Pressable>
      );
    }
    return (
      <View ref={ref} className={classes} {...props}>
        {inner}
      </View>
    );
  },
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<React.ElementRef<typeof View>, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

type CardTitleProps = TextProps & {
  /**
   * Which heading the title is, `1 | 2 | 3`. The default, 3, is shadcn's and every card's that sits
   * under a page title; a card that *is* the page — a sign-in, a token gate — is the page's `1`.
   * The size does not follow it: the rank says where the card sits, not how big its title looks.
   */
  level?: 1 | 2 | 3 | undefined;
};

// shadcn's current card: the page's own text size, so a card under a page header never has a
// bigger title than the page does (#249).
const CARD_TITLE = 'text-base font-semibold leading-none text-foreground';

// One arm per level because the compiler emits `<h1>`–`<h3>` from a *literal* `aria-level`; a level
// held in a variable would be a tag chosen at runtime, which it refuses (see `page-header.tsx`).
const CardTitle = React.forwardRef<React.ElementRef<typeof Text>, CardTitleProps>(
  ({ className, level = 3, ...props }, ref) => {
    if (level === 1) {
      return <Text ref={ref} role="heading" aria-level={1} className={cn(CARD_TITLE, className)} {...props} />;
    }
    if (level === 2) {
      return <Text ref={ref} role="heading" aria-level={2} className={cn(CARD_TITLE, className)} {...props} />;
    }
    return <Text ref={ref} role="heading" aria-level={3} className={cn(CARD_TITLE, className)} {...props} />;
  },
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<React.ElementRef<typeof Text>, TextProps>(({ className, ...props }, ref) => (
  <Text ref={ref} className={cn('text-sm text-foreground/60', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<React.ElementRef<typeof View>, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<React.ElementRef<typeof View>, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('flex flex-row items-center p-6 pt-0', className)} {...props} />
));
CardFooter.displayName = 'CardFooter';

/**
 * The header's trailing slot — a menu button, a status chip.
 *
 * shadcn's web `CardHeader` is a grid and `CardAction` places itself in its second
 * column with `col-start-2 row-span-2 self-start justify-self-end`. Yoga has no grid,
 * so the same position is a self-aligned absolute box: the header already reserves its
 * right padding, and the action is the only thing that sits there.
 */
const CardAction = React.forwardRef<React.ElementRef<typeof View>, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} className={cn('absolute right-6 top-6 items-end', className)} {...props} />
));
CardAction.displayName = 'CardAction';

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
