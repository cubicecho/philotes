import { type ContactValue, primaryEmail, primaryPhone } from '@/lib/primary-contact';

/** What naming a person needs: the name the server worked out, and their contact details when loaded. */
export interface NamedPerson {
  /** First and last name, else the nickname, else the organization. Empty when the person has none. */
  displayName: string;
  /** Read only when `displayName` is empty. */
  contactInfos?: readonly ContactValue[] | null;
}

/** What a person with no name and no contact detail is called. */
export const UNNAMED_PERSON = 'Unnamed';

/**
 * A person's name as it is shown. A contact a phone synced may have nothing but a number, so a person
 * without a name is called by their main email address, then their main phone number.
 *
 * @param person - The person.
 * @returns The display name, else a contact detail, else "Unnamed".
 */
export function personName(person: NamedPerson): string {
  const infos = person.contactInfos ?? [];
  return person.displayName || primaryEmail(infos) || primaryPhone(infos) || UNNAMED_PERSON;
}

/**
 * The letters drawn in place of a photo.
 *
 * @param name - The name as shown.
 * @returns The first letter or digit of the first word and of the last, in upper case; one for a single word.
 */
export function initialsOf(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+/u, ''))
    .filter(Boolean);
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}
