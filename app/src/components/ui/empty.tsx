import * as React from 'react';
import { Text, View } from 'react-native';
import { IconClassContext } from '@/components/ui/icons-base';
import { cn } from '@/lib/utils';

// `className` is re-declared rather than inherited: nativewind types it as `className?: string`,
// which under `exactOptionalPropertyTypes` rejects the `cond ? "x" : undefined` call sites pass.
type ViewProps = Omit<React.ComponentProps<typeof View>, 'className'> & {
  className?: string | undefined;
};
type TextProps = Omit<React.ComponentProps<typeof Text>, 'className'> & {
  className?: string | undefined;
};

const Empty = React.forwardRef<React.ElementRef<typeof View>, ViewProps>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    testID="empty"
    className={cn(
      'w-full min-w-0 items-center justify-center gap-3 rounded-lg border-dashed border-foreground/10 py-10',
      className,
    )}
    {...props}
  />
));
Empty.displayName = 'Empty';

const EmptyHeader = React.forwardRef<React.ElementRef<typeof View>, ViewProps>(({ className, ...props }, ref) => (
  <View ref={ref} testID="empty-header" className={cn('items-center', className)} {...props} />
));
EmptyHeader.displayName = 'EmptyHeader';

export type EmptyMediaVariant = 'default' | 'icon';

/** `icon` is the muted bubble `EmptyState` draws; `default` is a bare box for an avatar or image. */
const EMPTY_MEDIA = {
  default: '',
  icon: "rounded-full bg-foreground/10 p-3 text-foreground/60 [&_svg:not([class*='size-'])]:size-6",
} satisfies Record<EmptyMediaVariant, string>;

type EmptyMediaProps = ViewProps & {
  /** `icon` draws the child glyph in a muted bubble, sized and inked; `default` leaves it alone. */
  variant?: EmptyMediaVariant | null | undefined;
};

const EmptyMedia = React.forwardRef<React.ElementRef<typeof View>, EmptyMediaProps>(
  ({ className, variant, children, ...props }, ref) => {
    const box = cn(
      'mb-3 shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
      EMPTY_MEDIA[variant ?? 'default'],
      className,
    );
    if (variant === 'icon') {
      return (
        <View ref={ref} testID="empty-icon" className={box} {...props}>
          <IconClassContext.Provider value="h-6 w-6 text-foreground/60">{children}</IconClassContext.Provider>
        </View>
      );
    }
    return (
      <View ref={ref} testID="empty-icon" className={box} {...props}>
        {children}
      </View>
    );
  },
);
EmptyMedia.displayName = 'EmptyMedia';

const EmptyTitle = React.forwardRef<React.ElementRef<typeof Text>, TextProps>(({ className, ...props }, ref) => (
  <Text ref={ref} testID="empty-title" className={cn('font-medium text-sm text-foreground', className)} {...props} />
));
EmptyTitle.displayName = 'EmptyTitle';

const EmptyDescription = React.forwardRef<React.ElementRef<typeof Text>, TextProps>(({ className, ...props }, ref) => (
  <Text
    ref={ref}
    testID="empty-description"
    className={cn(
      'text-center text-sm text-foreground/60 [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-info',
      className,
    )}
    {...props}
  />
));
EmptyDescription.displayName = 'EmptyDescription';

/** What to do about it: a button or two, under the words. */
const EmptyContent = React.forwardRef<React.ElementRef<typeof View>, ViewProps>(({ className, ...props }, ref) => (
  <View
    ref={ref}
    testID="empty-content"
    className={cn('w-full min-w-0 max-w-sm items-center gap-3', className)}
    {...props}
  />
));
EmptyContent.displayName = 'EmptyContent';

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
