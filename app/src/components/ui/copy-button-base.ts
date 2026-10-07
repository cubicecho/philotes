import type { ComponentProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Button } from '@/components/ui/button';

type ButtonProps = ComponentProps<typeof Button>;

export type CopyButtonProps = {
  /** The text that goes on the clipboard. */
  value: string;
  /**
   * The accessible name before the press: say what is copied when the screen has more than one
   * thing that could be — "Copy endpoint URL". The default is `Copy`. For the moment after a
   * press the name is `Copied`, whatever this says.
   */
  label?: string | undefined;
  /** The button's variant. The default is `outline`. */
  variant?: ButtonProps['variant'] | undefined;
  /** The button's size. The default is `icon-sm`, which sits flush in a row of small text. */
  size?: ButtonProps['size'] | undefined;
  /** Called once the text is on the clipboard — a toast, an analytics event. */
  onCopied?: (() => void) | undefined;
  /**
   * Called when the clipboard refused the text — an insecure origin, a denied permission. The
   * button does not turn into a tick, so it never claims a copy that did not happen; this is where
   * the caller says so, since a shell holds no toasts.
   */
  onError?: ((error: unknown) => void) | undefined;
  /** The button's class: its position, say `absolute top-2 right-2` over a snippet. */
  className?: string | undefined;
};

/** How long the tick stays before the button offers to copy again, in ms. */
export const COPIED_MS = 1500;

/**
 * Writes `value` with `write` and holds `copied` for {@link COPIED_MS}.
 *
 * The timer is cleared on unmount, and a second press restarts it rather than
 * stacking a second one — the two things the hand-written copies of this got
 * wrong, since each wrote `setTimeout(() => setCopied(false), 1500)` and nothing
 * else.
 */
export function useCopy(
  write: (text: string) => Promise<void>,
  { value, onCopied, onError }: Pick<CopyButtonProps, 'value' | 'onCopied' | 'onError'>,
) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    try {
      await write(value);
    } catch (error) {
      onError?.(error);
      return;
    }
    onCopied?.();
    // The write is async, so the button can be gone by the time it lands, and a timer started
    // then would outlive the cleanup above.
    if (!mounted.current) return;
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }, [write, value, onCopied, onError]);

  return { copied, copy };
}
