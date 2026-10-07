import { useEffect, useRef } from 'react';

/** The props a search box adds to the input it is. The rest are `Input`'s, on each half. */
export type SearchInputOwnProps = {
  /**
   * The accessible name. A search box usually has no visible label, and an unnamed one is read as
   * "search field" and nothing else. `aria-label` wins over it, and a box pointed at by
   * `aria-labelledby` or an `id` (a `<label htmlFor>`, a `FormField`) takes its name from there
   * unless `label` is passed as well.
   */
  label?: string | undefined;
  /** The clear button's name. Announced, since the ✕ alone says nothing. */
  clearLabel?: string | undefined;
  /**
   * Off, there is no clear button. On, it shows only while there is text to clear, so an empty
   * box is not a box with a dead control in it.
   */
  clearable?: boolean | undefined;
  /**
   * The text once typing has paused: what a search that asks a server sends. Called `debounce`
   * milliseconds after the last key, and at once when the box is emptied or Enter is pressed.
   * `onChangeText` still hears every key, so the box itself never lags.
   */
  onSettledText?: ((text: string) => void) | undefined;
  /** How long typing has to pause before `onSettledText`, in milliseconds. */
  debounce?: number | undefined;
};

/**
 * Hides the ✕ WebKit and Blink draw in a `type="search"` box, so the one clear button is the named
 * one. The web half's alone: react-native-web's reset already hides it, and a device has none.
 */
export const SEARCH_INPUT_CLASS = '[&::-webkit-search-cancel-button]:appearance-none';

/** Long enough that a word is typed in one go, short enough that the answer does not feel late. */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * The timer behind `onSettledText`, which both halves hold the same way: `later` restarts the
 * wait, `now` ends it. Three apps wrote this beside their search box (#230), each as its own
 * `useEffect` and `setTimeout`.
 */
export function useSettledText(
  onSettledText: ((text: string) => void) | undefined,
  debounce: number,
): { later: (text: string) => void; now: (text: string) => void } {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The handler as of the last render, so a wait that outlives a render calls the current one.
  const handler = useRef(onSettledText);
  useEffect(() => {
    handler.current = onSettledText;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const now = (text: string) => {
    clearTimeout(timer.current);
    handler.current?.(text);
  };
  const later = (text: string) => {
    clearTimeout(timer.current);
    if (onSettledText === undefined) return;
    timer.current = setTimeout(() => handler.current?.(text), debounce);
  };
  return { later, now };
}

export const SEARCH_LABEL = 'Search';
export const SEARCH_CLEAR_LABEL = 'Clear search';

/**
 * The name to put in `aria-label`, or none. `label` is a default only where nothing else names the
 * box, because `aria-label` outranks a `<label htmlFor>` — a "Search" there would silently replace
 * the visible label a `FormField` drew.
 */
export function searchInputName({
  label,
  ariaLabel,
  ariaLabelledBy,
  id,
}: {
  label: string | undefined;
  ariaLabel: string | undefined;
  ariaLabelledBy: string | undefined;
  id: string | undefined;
}): string | undefined {
  if (ariaLabel !== undefined) return ariaLabel;
  if (label !== undefined) return label;
  return ariaLabelledBy || id ? undefined : SEARCH_LABEL;
}
