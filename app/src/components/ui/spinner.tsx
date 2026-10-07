import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { LoaderCircle } from '@/components/ui/icons';
import { SPIN_DURATION, type SpinnerProps, spinnerClass } from '@/components/ui/spinner-base';
import { cn } from '@/lib/utils';

export type { SpinnerProps };

export function Spinner({ label = 'Loading', className }: SpinnerProps) {
  const turn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: SPIN_DURATION,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View role="status" aria-label={label} style={{ alignSelf: 'flex-start', transform: [{ rotate }] }}>
      <LoaderCircle className={cn(spinnerClass, className)} aria-hidden />
    </Animated.View>
  );
}
