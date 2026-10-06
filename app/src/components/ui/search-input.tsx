import { useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, X } from '@/components/ui/icons';
import { Input, type InputHandle, type InputProps } from '@/components/ui/input';
import {
  SEARCH_CLEAR_LABEL,
  SEARCH_DEBOUNCE_MS,
  type SearchInputOwnProps,
  searchInputName,
  useSettledText,
} from '@/components/ui/search-input-base';

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
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  ref,
  ...props
}: SearchInputProps) {
  const [draft, setDraft] = useState(defaultValue ?? '');
  const text = value ?? draft;
  const inner = useRef<InputHandle>(null);
  useImperativeHandle<InputHandle, InputHandle>(ref, () => ({
    focus: () => inner.current?.focus(),
  }));

  const settled = useSettledText(onSettledText, debounce);

  const change = (next: string) => {
    if (value === undefined) setDraft(next);
    onChangeText?.(next);
    // An emptied box is not someone part-way through a word, so there is nothing to wait for.
    if (next === '') settled.now(next);
    else settled.later(next);
  };

  // Enter asks now. Left as the caller's own when nothing is settling, so the key is not taken
  // from a form that submits on it.
  const submit = onSettledText
    ? () => {
        settled.now(text);
        onSubmitEditing?.();
      }
    : onSubmitEditing;

  return (
    <Input
      {...props}
      ref={inner}
      type="search"
      value={text}
      onChangeText={change}
      onSubmitEditing={submit}
      disabled={disabled}
      id={id}
      aria-label={searchInputName({ label, ariaLabel, ariaLabelledBy, id })}
      aria-labelledby={ariaLabelledBy}
      leadingSlot={<Search />}
      trailingSlot={
        clearable && text !== '' && !disabled ? (
          <Button
            variant="secondary"
            size="icon-xs"
            aria-label={clearLabel}
            onPress={() => {
              change('');
              inner.current?.focus();
            }}
            iconSlot={<X />}
          />
        ) : undefined
      }
    />
  );
}
