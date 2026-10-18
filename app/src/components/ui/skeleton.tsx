import type * as React from "react";
import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { PULSE_DURATION_MS, PULSE_LOW, skeletonClass } from "@/components/ui/skeleton-base";
import { cn } from "@/lib/utils";

type SkeletonProps = Omit<React.ComponentProps<typeof View>, "className"> & {
  /** Its size, and anything else about its box: `h-4 w-1/3`. Rounded and `bg-foreground/10` already. */
  className?: string | undefined;
};

/** Tailwind's `animate-pulse` curve, so the device breathes the way the web does. */
const PULSE_EASE_IN = 0.4;
const PULSE_EASE_OUT = 0.6;
const PULSE_EASING = Easing.bezier(PULSE_EASE_IN, 0, PULSE_EASE_OUT, 1);

const PulsingView = Animated.createAnimatedComponent(View);

/** A pulsing block standing in for content that has not arrived. */
function Skeleton({ className, style, ...props }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const half = {
      duration: PULSE_DURATION_MS / 2,
      easing: PULSE_EASING,
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
    <PulsingView
      testID="skeleton"
      {...props}
      className={cn(skeletonClass, className)}
      style={[style, { opacity }]}
    />
  );
}

export type { SkeletonProps };
export { Skeleton };
