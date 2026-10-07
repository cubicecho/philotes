/** A person a note body can @-mention. */
export interface MentionablePerson {
  id: string;
  firstName: string;
  lastName: string;
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
 * Builds the pattern that finds one person's mention: `@`, their names with any white space between the
 * words, and no letter or digit straight after, so `@Ada Love` is not found in `@Ada Lovelace`.
 *
 * @param person - The person to look for.
 * @returns The pattern, or `null` for a person missing a first or a last name, who cannot be mentioned.
 */
function mentionPattern(person: MentionablePerson): RegExp | null {
  const firstWords = person.firstName.trim().split(/\s+/).filter(Boolean);
  const lastWords = person.lastName.trim().split(/\s+/).filter(Boolean);
  const isMissingName = firstWords.length === 0 || lastWords.length === 0;
  if (isMissingName) {
    return null;
  }
  const words = [...firstWords, ...lastWords].map(escapePattern).join('\\s+');
  return new RegExp(`@${words}(?![\\p{L}\\p{N}])`, 'iu');
}

/**
 * Finds the people a note body @-mentions. A mention is `@First Last`, matched to both names in any case;
 * either name may be several words, and may hold accented letters.
 *
 * @param body - The note's text.
 * @param allPersons - Everyone who can be mentioned.
 * @returns The id of each person mentioned, once each, in the order of `allPersons`.
 */
export function parseMentionedPersonIds(body: string, allPersons: MentionablePerson[]): string[] {
  const ids = new Set<string>();
  for (const person of allPersons) {
    const pattern = mentionPattern(person);
    const isMentioned = pattern?.test(body) === true;
    if (isMentioned) {
      ids.add(person.id);
    }
  }
  return Array.from(ids);
}
