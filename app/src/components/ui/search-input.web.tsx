import { useCallback, useRef, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Search, X } from '@/components/ui/icons';
import { Input, type InputHandle, type InputProps } from '@/components/ui/input';
import {
  SEARCH_CLEAR_LABEL,
  SEARCH_DEBOUNCE_MS,
  SEARCH_INPUT_CLASS,
  type SearchInputOwnProps,
  searchInputName,
  useSettledText,
} from '@/components/ui/search-input-base';
import { cn } from '@/lib/utils';

export type SearchInputProps = Omit<InputProps, 'type' | 'leadingSlot' | 'trailingSlot'> & SearchInputOwnProps;

export function SearchInput({
  label,
  clearLabel = SEARCH_CLEAR_LABEL,
  clearable = true,
  value,
  defaultValue,
  onChangeText,
  onSettledText,
  debounce = SEARCH_DEBOUNCE_MS,
  onSubmitEditing,
  disabled,
  id,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ref,
  ...props
}: SearchInputProps) {
  const element = useRef<HTMLInputElement | null>(null);
  const [typed, setTyped] = useState(String(defaultValue ?? '') !== '');
  const filled = value === undefined ? typed : String(value) !== '';

  // The ref `Input` hands back is the `<input>` on the web; the caller's ref gets it too.
  const attach = useCallback(
    (node: InputHandle | null) => {
      element.current = node as HTMLInputElement | null;
      // The node is both: an `HTMLInputElement` has `focus` and `select`.
      if (typeof ref === 'function') (ref as (node: InputHandle | null) => void)(node);
      else if (ref) (ref as { current: InputHandle | null }).current = node;
    },
    [ref],
  );

  const settled = useSettledText(onSettledText, debounce);

  // Enter asks now. Left as the caller's own when nothing is settling: `Input` holds Enter back
  // from the browser once it has a handler, and a form that submits on it has to keep the key.
  const submit = onSettledText
    ? () => {
        settled.now(element.current?.value ?? '');
        onSubmitEditing?.();
      }
    : onSubmitEditing;

  const clear = () => {
    const box = element.current;
    if (!box) return;
    // The prototype's setter, not `box.value = ""`: React tracks the last value it saw on the
    // element, and a plain assignment updates that too, so the `input` event would read as no
    // change and `onChange` would never fire.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(box, '');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    box.focus();
  };

  return (
    <Input
      {...props}
      ref={attach}
      type="search"
      value={value}
      defaultValue={defaultValue}
      onChangeText={(text) => {
        setTyped(text !== '');
        onChangeText?.(text);
        // An emptied box is not someone part-way through a word, so there is nothing to wait for.
        if (text === '') settled.now(text);
        else settled.later(text);
      }}
      onSubmitEditing={submit}
      disabled={disabled}
      id={id}
      aria-label={searchInputName({ label, ariaLabel, ariaLabelledBy, id })}
      aria-labelledby={ariaLabelledBy}
      className={cn(SEARCH_INPUT_CLASS, className)}
      leadingSlot={<Search />}
      trailingSlot={
        clearable && filled && !disabled ? (
          <button
            type="button"
            data-slot="search-input-clear"
            aria-label={clearLabel}
            onClick={clear}
            className={buttonVariants({ variant: 'secondary', size: 'icon-xs' })}
          >
            <X />
          </button>
        ) : undefined
      }
    />
  );
}
