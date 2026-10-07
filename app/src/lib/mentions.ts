/** A person a note body can @-mention. */
export interface MentionablePerson {
  id: string;
  /** The name a mention is written with. A person without one cannot be mentioned. */
  displayName: string;
}

/**
 * Escapes a string so a pattern matches it literally.
 *
 * @param text - The text to match.
 * @returns The text with every character a pattern reads specially escaped.
 */
function escapePattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Splits a name into its words.
 *
 * @param name - The name as shown.
 * @returns The words, without the white space between them.
 */
function wordsOf(name: string): string[] {
  return name.trim().split(/\s+/).filter(Boolean);
}

/**
 * Builds the pattern that finds one name's mentions: `@`, the words with any white space between them,
 * and no letter or digit straight after, so `@Ada Love` is not found in `@Ada Lovelace`.
 *
 * @param words - The name's words. At least one.
 * @returns The pattern, matching every mention in a body.
 */
function mentionPattern(words: string[]): RegExp {
  return new RegExp(`@${words.map(escapePattern).join('\\s+')}(?![\\p{L}\\p{N}])`, 'giu');
}

/**
 * Finds the people a note body @-mentions. A mention is `@` and the person's name as shown, in any case;
 * the name may be several words, and may hold accented letters. The longest name is looked for first and
 * its mentions are taken out of the text, so `@Ada Lovelace` mentions Ada Lovelace and not also a person
 * called Ada.
 *
 * @param body - The note's text.
 * @param allPersons - Everyone who can be mentioned.
 * @returns The id of each person mentioned, once each, in the order of `allPersons`.
 */
export function parseMentionedPersonIds(body: string, allPersons: MentionablePerson[]): string[] {
  const named = allPersons
    .map((person) => ({ id: person.id, words: wordsOf(person.displayName) }))
    .filter((person) => person.words.length > 0)
    .sort((a, b) => b.words.length - a.words.length);

  // People who share a name are all mentioned by it, so each distinct name is taken out once.
  const mentionedNames = new Set<string>();
  let remaining = body;
  for (const { words } of named) {
    const key = words.join(' ').toLowerCase();
    const pattern = mentionPattern(words);
    const isMentioned = mentionedNames.has(key) === false && pattern.test(remaining);
    if (isMentioned) {
      mentionedNames.add(key);
      remaining = remaining.replace(mentionPattern(words), ' ');
    }
  }

  return allPersons
    .filter((person) => mentionedNames.has(wordsOf(person.displayName).join(' ').toLowerCase()))
    .map((person) => person.id);
}
