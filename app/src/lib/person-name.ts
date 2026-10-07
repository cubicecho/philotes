/** The two parts every person record has. */
export interface PersonName {
  firstName: string;
  lastName: string;
}

/**
 * A person's name as it is shown and searched: first name, a space, last name.
 *
 * @param person - Anything that carries the two name parts.
 * @returns The full name.
 */
export function fullName(person: PersonName): string {
  return `${person.firstName} ${person.lastName}`;
}
