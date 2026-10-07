import { ContactTypeEnum } from '@/__generated__/graphql';

/** One of a person's contact details, as far as picking the main one needs it. */
export interface ContactValue {
  /** The contact type, one of the `ContactTypeEnum` values. */
  type: string;
  value: string;
  isPrimary?: boolean | null;
}

/** The contact types that can be called or texted. */
const PHONE_TYPES: ReadonlySet<string> = new Set([ContactTypeEnum.Phone]);

/** The contact types that can be written to. */
const EMAIL_TYPES: ReadonlySet<string> = new Set([ContactTypeEnum.Email]);

/**
 * Picks the value to use out of the details of some types.
 *
 * @param infos - The person's contact details.
 * @param types - The types that count.
 * @returns The detail marked primary, else the first; `null` when the person has none of those types.
 */
function primaryOf(infos: readonly ContactValue[], types: ReadonlySet<string>): string | null {
  const matching = infos.filter((info) => types.has(info.type));
  const chosen = matching.find((info) => info.isPrimary) ?? matching[0];
  return chosen?.value ?? null;
}

/**
 * The address to write to a person at.
 *
 * @param infos - The person's contact details.
 * @returns The email marked primary, else the first; `null` when the person has none.
 */
export function primaryEmail(infos: readonly ContactValue[]): string | null {
  return primaryOf(infos, EMAIL_TYPES);
}

/**
 * The number to call or text a person on.
 *
 * @param infos - The person's contact details.
 * @returns The phone number marked primary, else the first; `null` when the person has none.
 */
export function primaryPhone(infos: readonly ContactValue[]): string | null {
  return primaryOf(infos, PHONE_TYPES);
}
