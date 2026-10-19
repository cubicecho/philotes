// What an Android contacts intent means to Philotes. Pure: the native module hands the intent over
// (`contacts-native.ts`) and the routes act on what these functions decide. Android's own words for
// actions, extras and URIs live here, as the protocol words they are.

/** The intent actions the app answers as a contacts app (`android.intentFilters` in `app.json`). */
export const ContactIntentAction = {
  View: 'android.intent.action.VIEW',
  Edit: 'android.intent.action.EDIT',
  Insert: 'android.intent.action.INSERT',
  InsertOrEdit: 'android.intent.action.INSERT_OR_EDIT',
  Pick: 'android.intent.action.PICK',
} as const;
export type ContactIntentAction = (typeof ContactIntentAction)[keyof typeof ContactIntentAction];

/** The `ContactsContract.Intents.Insert` extras a new person's form can hold. */
export const ContactInsertExtra = {
  Name: 'name',
  Phone: 'phone',
  Email: 'email',
  Company: 'company',
  JobTitle: 'job_title',
  Notes: 'notes',
} as const;
export type ContactInsertExtra = (typeof ContactInsertExtra)[keyof typeof ContactInsertExtra];

/** Every URI the contacts provider hands out starts with this. */
export const CONTACTS_URI_PREFIX = 'content://com.android.contacts/';

/**
 * The account types whose raw contacts are Philotes people. DAVx5 keeps each address book as an
 * account of this type (`account_type_address_book` in DAVx5's `strings.xml`).
 */
export const PHILOTES_ACCOUNT_TYPES: readonly string[] = ['at.bitfire.davdroid.address_book'];

/** The file name DAVx5 gives a card ends with this; Philotes names the card after the person's uid. */
const CARD_SUFFIX = '.vcf';

/** The routes an intent lands on. */
export const ContactRoute = {
  Open: '/contacts/open',
  Pick: '/contacts/pick',
  NewPerson: '/persons',
} as const;

/** The intent, as the native module describes it. */
export interface ContactIntent {
  action: string | null;
  /** The intent's data URI, such as a contact lookup URI. */
  data: string | null;
  /** The intent's MIME type, when it carries one. */
  type: string | null;
  /** Its string extras. Others, such as `Insert.DATA`'s ContentValues, are left out. */
  extras: Record<string, string>;
}

/** What a new person's form can start with, from an "Add to contacts". Each is left out when not given. */
export interface PersonPrefill {
  firstName?: string;
  lastName?: string;
  organization?: string;
  jobTitle?: string;
  about?: string;
  email?: string;
  phone?: string;
}

/** The query string keys a prefill travels under, on `/persons?new=1`. */
export const PREFILL_KEYS = [
  'firstName',
  'lastName',
  'organization',
  'jobTitle',
  'about',
  'email',
  'phone',
] as const satisfies readonly (keyof PersonPrefill)[];

/** Where an intent sends the app: a path and its query parameters. */
export interface ContactHref {
  pathname: string;
  params: Record<string, string>;
}

/** The sync columns of the raw contact behind a contact URI, as the native module reads them. */
export interface RawContactSync {
  /** `SYNC1`: the vCard UID DAVx5 stored. */
  uid: string | null;
  /** `SOURCE_ID`: the card's file name on the server, such as `<uid>.vcf`. */
  fileName: string | null;
}

/**
 * Whether a URI is one of the contacts provider's.
 *
 * @param uri - Any URI or path.
 * @returns True for a `content://com.android.contacts/…` URI.
 */
export function isContactUri(uri: string | null | undefined): uri is string {
  return uri?.startsWith(CONTACTS_URI_PREFIX) ?? false;
}

/**
 * Splits a full name the way a phone's single name field is meant: the last word is the family name.
 *
 * @param name - The name as typed, such as "Ada King Lovelace".
 * @returns The first and last name; a single word is a first name only, and an empty name is neither.
 */
export function splitFullName(name: string): Pick<PersonPrefill, 'firstName' | 'lastName'> {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lastName = words.length > 1 ? words.pop() : undefined;
  const firstName = words.length > 0 ? words.join(' ') : undefined;
  return { ...(firstName === undefined ? {} : { firstName }), ...(lastName === undefined ? {} : { lastName }) };
}

/** Which prefill field each extra fills, besides the name, which is split. */
const EXTRA_FIELD: Readonly<Record<Exclude<ContactInsertExtra, 'name'>, keyof PersonPrefill>> = Object.freeze({
  phone: 'phone',
  email: 'email',
  company: 'organization',
  job_title: 'jobTitle',
  notes: 'about',
});

/**
 * Reads the form's starting values from an insert intent's extras.
 *
 * @param extras - The intent's string extras.
 * @returns The fields the extras fill; blank extras are left out.
 */
export function prefillFromExtras(extras: Readonly<Record<string, string>>): PersonPrefill {
  const prefill: PersonPrefill = splitFullName(extras[ContactInsertExtra.Name] ?? '');
  for (const [extra, field] of Object.entries(EXTRA_FIELD)) {
    const value = extras[extra]?.trim();
    if (value) {
      prefill[field] = value;
    }
  }
  return prefill;
}

/**
 * The route that opens the person behind a contact URI.
 *
 * @param uri - The contacts provider URI.
 * @param edit - True to open their edit form.
 * @returns The `/contacts/open` route.
 */
export function openContactHref(uri: string, edit = false): ContactHref {
  return { pathname: ContactRoute.Open, params: edit ? { uri, edit: '1' } : { uri } };
}

/**
 * Where an intent sends the app.
 *
 * @param intent - The intent the app was opened with.
 * @returns The route, or `null` for an intent that is not about contacts, such as the launcher's.
 */
export function contactIntentHref(intent: ContactIntent): ContactHref | null {
  const { action, data } = intent;
  const isAboutContact = isContactUri(data);
  if (action === ContactIntentAction.View && isAboutContact) {
    return openContactHref(data);
  }
  if (action === ContactIntentAction.Edit && isAboutContact) {
    return openContactHref(data, true);
  }
  // INSERT_OR_EDIT asks to add the details to someone, new or existing. Choosing an existing person
  // is left to the user once the form is up, so both start a new person.
  const isInsert = action === ContactIntentAction.Insert || action === ContactIntentAction.InsertOrEdit;
  if (isInsert) {
    const prefill = prefillFromExtras(intent.extras);
    return { pathname: ContactRoute.NewPerson, params: { new: '1', ...prefill } };
  }
  if (action === ContactIntentAction.Pick) {
    return { pathname: ContactRoute.Pick, params: {} };
  }
  return null;
}

/**
 * A route as one path string, for `+native-intent`, which hands the router a string.
 *
 * @param href - The route.
 * @returns The path with its query string.
 */
export function hrefToPath({ pathname, params }: ContactHref): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return query === '' ? pathname : `${pathname}?${query}`;
}

/**
 * The Philotes uid a raw contact stands for: its UID, or failing that the name of its card.
 *
 * @param sync - The raw contact's sync columns.
 * @returns The person's uid, or `null` for a contact that has not been through the server yet.
 */
export function personUidOf(sync: RawContactSync | null): string | null {
  if (sync?.uid) {
    return sync.uid;
  }
  const fileName = sync?.fileName;
  if (fileName?.endsWith(CARD_SUFFIX)) {
    try {
      return decodeURIComponent(fileName.slice(0, -CARD_SUFFIX.length)) || null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Reads a prefill back from a route's query parameters.
 *
 * @param params - The route's parameters, as the router gives them.
 * @returns The prefill, with only the known keys that hold text.
 */
export function prefillFromParams(params: Readonly<Record<string, string | string[] | undefined>>): PersonPrefill {
  const prefill: PersonPrefill = {};
  for (const key of PREFILL_KEYS) {
    const value = params[key];
    if (typeof value === 'string' && value !== '') {
      prefill[key] = value;
    }
  }
  return prefill;
}

/** What resolving a contact URI can come to. */
export const ContactResolutionKind = {
  /** A person of this user's. */
  Person: 'person',
  /** The contact is not one of Philotes', or has not been synced yet. */
  NotPhilotes: 'notPhilotes',
  /** Its UID names no person this user has. */
  NoPerson: 'noPerson',
  /** The development build has no native module. */
  NoModule: 'noModule',
  /** Reading contacts was refused. */
  Denied: 'denied',
} as const;
export type ContactResolutionKind = (typeof ContactResolutionKind)[keyof typeof ContactResolutionKind];

/** What resolving a contact URI came to. */
export type ContactResolution =
  | { kind: typeof ContactResolutionKind.Person; personId: string }
  | { kind: typeof ContactResolutionKind.NoPerson; uid: string }
  | {
      kind:
        | typeof ContactResolutionKind.NotPhilotes
        | typeof ContactResolutionKind.NoModule
        | typeof ContactResolutionKind.Denied;
    };

/** What resolving needs from the device and the server, passed in so it can be tested. */
export interface ContactResolver {
  /** `null` when the native module is missing from the build. */
  readSync: ((uri: string) => Promise<RawContactSync | null>) | null;
  requestPermission: () => Promise<boolean>;
  findPersonId: (uid: string) => Promise<string | null>;
}

/**
 * Finds the person behind a contact URI by the UID sync stored on its raw contact.
 *
 * @param uri - The contacts provider URI from the intent.
 * @param resolver - The device and server lookups.
 * @returns The person, or why there is none.
 */
export async function resolveContactUri(uri: string, resolver: ContactResolver): Promise<ContactResolution> {
  const { readSync } = resolver;
  if (readSync === null) {
    return { kind: ContactResolutionKind.NoModule };
  }
  const isGranted = await resolver.requestPermission();
  if (isGranted === false) {
    return { kind: ContactResolutionKind.Denied };
  }
  const uid = personUidOf(await readSync(uri));
  if (uid === null) {
    return { kind: ContactResolutionKind.NotPhilotes };
  }
  const personId = await resolver.findPersonId(uid);
  return personId === null
    ? { kind: ContactResolutionKind.NoPerson, uid }
    : { kind: ContactResolutionKind.Person, personId };
}
