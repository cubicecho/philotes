import type * as React from 'react';
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { PULSE_DURATION, PULSE_LOW, skeletonClass } from '@/components/ui/skeleton-base';
import { cn } from '@/lib/utils';

type SkeletonProps = Omit<React.ComponentProps<typeof View>, 'className'> & {
  /** Its size, and anything else about its box: `h-4 w-1/3`. Rounded and `bg-hover` already. */
  className?: string | undefined;
};

const PulsingView = Animated.createAnimatedComponent(View);

function Skeleton({ className, style, ...props }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const half = {
      duration: PULSE_DURATION / 2,
      easing: Easing.bezier(0.4, 0, 0.6, 1),
      useNativeDriver: true,
    };
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: PULSE_LOW, ...half }),
        Animated.timing(opacity, { toValue: 1, ...half }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <PulsingView testID="skeleton" {...props} className={cn(skeletonClass, className)} style={[style, { opacity }]} />
  );
}

export type { SkeletonProps };
export { Skeleton };
