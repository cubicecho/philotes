import { useRef, useState } from 'react';
import { View } from 'react-native';
import { ListItem } from '@/components/list-item';
import { type FieldProps, FieldWrapper, splitProps, useFieldContext } from '@/components/ui/form';
import { Textarea, type TextareaHandle } from '@/components/ui/textarea';
import type { MentionablePerson } from '@/lib/mentions';

interface MentionDropdownProps {
  /** What has been typed after the `@`; matched against the start of a name, ignoring case. */
  query: string;
  /** Everyone who can be mentioned. */
  allPersons: MentionablePerson[];
  /** Called with the person whose row is pressed. */
  onSelect: (person: MentionablePerson) => void;
}

/** The people an `@query` could mean, listed in flow beneath the textarea. */
export function MentionDropdown({ query, allPersons, onSelect }: MentionDropdownProps) {
  const lower = query.toLowerCase();
  // A person with no name has nothing a mention could be written with.
  const filtered = allPersons.filter((p) => p.displayName !== '' && p.displayName.toLowerCase().startsWith(lower));

  if (filtered.length === 0) {
    return null;
  }

  return (
    <View role="list" className="max-h-48 overflow-hidden rounded-md border border-foreground/10 bg-secondary py-1">
      {filtered.map((p) => (
        <ListItem key={p.id} title={p.displayName} onPress={() => onSelect(p)} />
      ))}
    </View>
  );
}

// The textarea reports its text but not its caret, so a mention is the `@word`
// the text currently ends with.
const TRAILING_MENTION = /@([\w']*)$/;

/**
 * The partial name after a trailing `@`, or `null` when the text does not end in one.
 *
 * @param text - The whole text of the textarea.
 * @returns What follows the last `@` when the text ends in `@word`, which may be empty; otherwise `null`.
 */
export function trailingMentionQuery(text: string): string | null {
  return TRAILING_MENTION.exec(text)?.[1] ?? null;
}

/**
 * Replace the trailing partial `@query` with `@` and the person's name.
 *
 * @param text - The whole text of the textarea, ending in the partial mention.
 * @param person - The person chosen.
 * @returns The text with the mention completed; unchanged when it does not end in one.
 */
export function completeMention(text: string, person: MentionablePerson): string {
  return text.replace(TRAILING_MENTION, `@${person.displayName}`);
}

type MentionTextareaFieldProps = FieldProps & {
  /** Everyone who can be mentioned. */
  allPersons: MentionablePerson[];
  placeholder?: string | undefined;
  /** The textarea's height in lines of text. */
  rows?: number | undefined;
};

/** A note body bound to a `string` field, offering people to mention as `@` is typed. Render inside `form.AppField`. */
export function MentionTextareaField(props: MentionTextareaFieldProps) {
  const [fieldProps, { allPersons, placeholder, rows }] = splitProps(props);
  const field = useFieldContext<string>();
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<TextareaHandle>(null);

  const handleSelect = (person: MentionablePerson) => {
    field.handleChange(completeMention(field.state.value, person));
    setMentionQuery(null);
    // Pressing a row took focus from the textarea.
    textareaRef.current?.focus();
  };

  return (
    <View className="gap-1">
      <FieldWrapper
        {...fieldProps}
        controlSlot={
          <Textarea
            ref={textareaRef}
            value={field.state.value}
            onChangeText={(text) => {
              field.handleChange(text);
              setMentionQuery(trailingMentionQuery(text));
            }}
            onBlur={field.handleBlur}
            onEscape={() => setMentionQuery(null)}
            rows={rows}
            placeholder={placeholder}
          />
        }
      />
      {mentionQuery !== null && (
        <MentionDropdown query={mentionQuery} allPersons={allPersons} onSelect={handleSelect} />
      )}
    </View>
  );
}
