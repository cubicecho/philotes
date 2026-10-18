import { Children, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, Text, View } from "react-native";
import {
  BADGE_PULSE_LOW,
  BADGE_PULSE_MS,
  type BadgeProps,
  type BadgeVariant,
  badgeContainerVariants,
  badgeHasLabel,
  badgeIconClass,
  badgeInkFallback,
  badgeInkVariants,
  badgeRemoveLabel,
  badgeSoftDotClass,
  badgeTextFallback,
  badgeTextVariants,
  badgeVariants,
} from "@/components/ui/badge-base";
import { X } from "@/components/ui/icons";
import { IconClassContext } from "@/components/ui/icons-base";
import { cn } from "@/lib/utils";

/** A 12px glyph grown to about 28 by 28 of touch, without growing the pill. */
const REMOVE_HIT_SLOP = { top: 8, bottom: 8, left: 6, right: 8 } as const;

/** Tailwind's `animate-pulse` curve, so the device breathes the way the web does. */
const PULSE_EASE_IN = 0.4;
const PULSE_EASE_OUT = 0.6;
const PULSE_EASING = Easing.bezier(PULSE_EASE_IN, 0, PULSE_EASE_OUT, 1);

/** `View`, which NativeWind hands a `className` to, able to take an animated `opacity`. */
const PulsingView = Animated.createAnimatedComponent(View);

/** Whether the reader asked the system for reduced motion, kept up to date as they change it. */
function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (live) {
        setReduce(value);
      }
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduce;
}

/**
 * The dot's opacity for `pulse`: a loop on the native driver while it runs, still at 1 otherwise.
 * A CSS keyframe is a class NativeWind resolves to nothing on device, so this is `Animated`, as
 * `Skeleton`'s pulse is.
 */
function usePulse(running: boolean): Animated.Value {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (running === false) {
      opacity.setValue(1);
      return;
    }
    const half = { duration: BADGE_PULSE_MS / 2, easing: PULSE_EASING, useNativeDriver: true };
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: BADGE_PULSE_LOW, ...half }),
        Animated.timing(opacity, { toValue: 1, ...half }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, running]);
  return opacity;
}

export type { BadgeProps, BadgeVariant };

/** A small pill naming a kind or a state, or a dot of the same colour when it has no children. */
export function Badge({
  variant = "default",
  backgroundColor,
  textColor,
  className,
  label,
  onRemove,
  removeLabel,
  mono = false,
  pulse = false,
  children,
}: BadgeProps) {
  const shape = badgeHasLabel(children) ? "pill" : "dot";
  const reduceMotion = useReduceMotion();
  const pulsing = pulse && shape === "dot" && reduceMotion === false;
  const opacity = usePulse(pulsing);
  const textClass = backgroundColor
    ? badgeTextFallback(mono)
    : badgeTextVariants({ variant, mono });
  const inkClass = backgroundColor ? badgeInkFallback : badgeInkVariants({ variant });
  // Not with `backgroundColor`: the caller's colour replaced the tint the dot belongs to.
  const softDot = shape === "pill" && !backgroundColor ? badgeSoftDotClass(variant) : null;
  const dotName = label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": true } as const);

  return (
    <PulsingView
      // Yoga stretches a child across a column and has no fit-content to stop it, so on native the
      // badge pins itself to the start. In a centred row, pass `className="self-center"`.
      className={cn("self-start", badgeContainerVariants({ variant, shape }), className)}
      style={[backgroundColor ? { backgroundColor } : null, pulsing ? { opacity } : null]}
      // A dot carries meaning and no text, so it is named or it is decoration;
      // the same split `color-dot` makes, for the same reason.
      {...(shape === "dot" ? dotName : {})}
    >
      {softDot ? <View aria-hidden className={softDot} /> : null}
      {/* An icon passed as a child takes the badge's ink at the web's `[&>svg]:size-3`. */}
      <IconClassContext.Provider value={cn("size-3", textClass)}>
        {shape === "pill"
          ? Children.map(children, (child) =>
              typeof child === "string" || typeof child === "number" ? (
                <Text
                  numberOfLines={1}
                  className={textClass}
                  {...(textColor ? { style: { color: textColor } } : {})}
                >
                  {child}
                </Text>
              ) : (
                child
              ),
            )
          : null}
      </IconClassContext.Provider>
      {shape === "pill" && onRemove ? (
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
    </PulsingView>
  );
}

export { badgeVariants };
