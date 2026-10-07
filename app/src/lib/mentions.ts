/** A person a note body can @-mention. */
export interface MentionablePerson {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * Finds the people a note body @-mentions. A mention is `@First Last`, matched to both names in any case.
 *
 * @param body - The note's text.
 * @param allPersons - Everyone who can be mentioned.
 * @returns The id of each person mentioned, once each.
 */
export function parseMentionedPersonIds(body: string, allPersons: MentionablePerson[]): string[] {
  const ids = new Set<string>();
  const pattern = /@([\w'-]+)\s+([\w'-]+)/g;
  for (const match of body.matchAll(pattern)) {
    const first = match[1].toLowerCase();
    const last = match[2].toLowerCase();
    for (const p of allPersons) {
      const isMentioned = p.firstName.toLowerCase() === first && p.lastName.toLowerCase() === last;
      if (isMentioned) {
        ids.add(p.id);
      }
    }
  }
  return Array.from(ids);
}
