import { Children } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  type BadgeProps,
  type BadgeVariant,
  badgeContainerVariants,
  badgeHasLabel,
  badgeIconClass,
  badgeInkFallback,
  badgeInkVariants,
  badgeRemoveLabel,
  badgeTextFallback,
  badgeTextVariants,
  badgeVariants,
} from '@/components/ui/badge-base';
import { X } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

/** A 12px glyph grown to about 28 by 28 of touch, without growing the pill. */
const REMOVE_HIT_SLOP = { top: 8, bottom: 8, left: 6, right: 8 } as const;

export type { BadgeProps, BadgeVariant };

export function Badge({
  variant = 'default',
  backgroundColor,
  textColor,
  className,
  label,
  onRemove,
  removeLabel,
  children,
}: BadgeProps) {
  const shape = badgeHasLabel(children) ? 'pill' : 'dot';
  const textClass = backgroundColor ? badgeTextFallback : badgeTextVariants({ variant });
  const inkClass = backgroundColor ? badgeInkFallback : badgeInkVariants({ variant });

  return (
    <View
      // Yoga stretches a child across a column and has no fit-content to stop it, so on native the
      // badge pins itself to the start. In a centred row, pass `className="self-center"`.
      className={cn('self-start', badgeContainerVariants({ variant, shape }), className)}
      {...(backgroundColor ? { style: { backgroundColor } } : {})}
      // A dot carries meaning and no text, so it is named or it is decoration;
      // the same split `color-dot` makes, for the same reason.
      {...(shape === 'dot'
        ? label
          ? ({ role: 'img', 'aria-label': label } as const)
          : ({ 'aria-hidden': true } as const)
        : {})}
    >
      {shape === 'pill'
        ? Children.map(children, (child) =>
            typeof child === 'string' || typeof child === 'number' ? (
              <Text className={textClass} {...(textColor ? { style: { color: textColor } } : {})}>
                {child}
              </Text>
            ) : (
              child
            ),
          )
        : null}
      {shape === 'pill' && onRemove ? (
        <Pressable
          onPress={onRemove}
          // The `role` is hand-written because a `<button>` has no native counterpart.
          role="button"
          aria-label={removeLabel ?? badgeRemoveLabel(children, label)}
          hitSlop={REMOVE_HIT_SLOP}
        >
          <X
            className={cn(badgeIconClass, inkClass)}
            // An inline prop wins over the colour the class maps to, as `style` does on the `Text`.
            {...(textColor ? { color: textColor } : {})}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

export { badgeVariants };
