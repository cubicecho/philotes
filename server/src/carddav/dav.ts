// The words of WebDAV and CardDAV this server speaks, and where its resources live. Every user sees the
// same paths: who is asking decides whose address book they hold.

/** The request methods the address book answers. */
export const DavMethod = {
  Options: 'OPTIONS',
  Propfind: 'PROPFIND',
  Report: 'REPORT',
  Get: 'GET',
  Head: 'HEAD',
  Put: 'PUT',
  Delete: 'DELETE',
} as const;
export type DavMethod = (typeof DavMethod)[keyof typeof DavMethod];

/** The properties a resource here can have, by their local name. */
export const DavProp = {
  ResourceType: 'resourcetype',
  DisplayName: 'displayname',
  CurrentUserPrincipal: 'current-user-principal',
  PrincipalUrl: 'principal-URL',
  AddressBookHomeSet: 'addressbook-home-set',
  SupportedReportSet: 'supported-report-set',
  SupportedAddressData: 'supported-address-data',
  CurrentUserPrivilegeSet: 'current-user-privilege-set',
  MaxResourceSize: 'max-resource-size',
  SyncToken: 'sync-token',
  CTag: 'getctag',
  ETag: 'getetag',
  ContentType: 'getcontenttype',
  AddressData: 'address-data',
} as const;
export type DavProp = (typeof DavProp)[keyof typeof DavProp];

/** The namespace prefixes a response is written with. */
export const NS_DAV = 'd';
export const NS_CARDDAV = 'card';
export const NS_CALENDAR_SERVER = 'cs';

/** The namespace each prefix stands for, as declared on a response's root. */
export const NAMESPACES: Record<string, string> = {
  [NS_DAV]: 'DAV:',
  [NS_CARDDAV]: 'urn:ietf:params:xml:ns:carddav',
  [NS_CALENDAR_SERVER]: 'http://calendarserver.org/ns/',
};

/** The namespace each property belongs to. */
const PROP_NAMESPACE: Record<DavProp, string> = {
  [DavProp.ResourceType]: NS_DAV,
  [DavProp.DisplayName]: NS_DAV,
  [DavProp.CurrentUserPrincipal]: NS_DAV,
  [DavProp.PrincipalUrl]: NS_DAV,
  [DavProp.AddressBookHomeSet]: NS_CARDDAV,
  [DavProp.SupportedReportSet]: NS_DAV,
  [DavProp.SupportedAddressData]: NS_CARDDAV,
  [DavProp.CurrentUserPrivilegeSet]: NS_DAV,
  [DavProp.MaxResourceSize]: NS_CARDDAV,
  [DavProp.SyncToken]: NS_DAV,
  [DavProp.CTag]: NS_CALENDAR_SERVER,
  [DavProp.ETag]: NS_DAV,
  [DavProp.ContentType]: NS_DAV,
  [DavProp.AddressData]: NS_CARDDAV,
};

/** What a request body asks for, by the local name of its root element. */
export const DavRequestKind = {
  Propfind: 'propfind',
  Multiget: 'addressbook-multiget',
  SyncCollection: 'sync-collection',
  Query: 'addressbook-query',
} as const;
export type DavRequestKind = (typeof DavRequestKind)[keyof typeof DavRequestKind];

/** A precondition a request failed, named in the error body so a client can tell which. */
export const DavPrecondition = {
  /** The sync token is not one this address book gave out. The client starts over. */
  ValidSyncToken: `${NS_DAV}:valid-sync-token`,
  /** The body is not a vCard this address book can keep. */
  ValidAddressData: `${NS_CARDDAV}:valid-address-data`,
} as const;
export type DavPrecondition = (typeof DavPrecondition)[keyof typeof DavPrecondition];

/** Where the resources live. Collections end in a slash. */
export const DavPath = {
  /** Where a client looks first, given only the server's name. It redirects to the root. */
  WellKnown: '/.well-known/carddav',
  /** Where the routes are mounted. */
  Mount: '/dav',
  Root: '/dav/',
  Principal: '/dav/principal/',
  Home: '/dav/addressbooks/',
  Book: '/dav/addressbooks/contacts/',
} as const;

/** The `DAV` header: classes 1 and 3, and the address book extension. */
export const DAV_CAPABILITIES = '1, 3, addressbook';
/** The media type of a card, as served. */
export const VCARD_CONTENT_TYPE = 'text/vcard; charset=utf-8';
/** The media type of a multi-status or error body. */
export const XML_CONTENT_TYPE = 'application/xml; charset=utf-8';
/** The realm a client is asked to sign in to. */
export const AUTH_REALM = 'Philotes';

const CARD_EXTENSION = '.vcf';
/** What a sync token starts with. The user's change count follows. */
const SYNC_TOKEN_PREFIX = 'urn:philotes:sync:';
const WHOLE_NUMBER = /^\d+$/;
/** Any base, for reading the path out of an href that may be a whole URL. */
const ANY_ORIGIN = 'http://localhost';

/**
 * Writes a property's name with its namespace prefix.
 *
 * @param prop - The property.
 * @returns The name as an element is written, such as `d:getetag`.
 */
export function qualified(prop: DavProp): string {
  return `${PROP_NAMESPACE[prop]}:${prop}`;
}

/**
 * Writes where a card lives.
 *
 * @param uid - The person's uid.
 * @returns The card's path.
 */
export function cardHref(uid: string): string {
  return `${DavPath.Book}${encodeURIComponent(uid)}${CARD_EXTENSION}`;
}

/**
 * Reads a person's uid out of a card's file name.
 *
 * @param name - The last part of the path, already decoded.
 * @returns The uid, or null when the name is not a card's.
 */
export function uidOfName(name: string): string | null {
  const isCard = name.endsWith(CARD_EXTENSION) && name.length > CARD_EXTENSION.length;
  return isCard ? name.slice(0, -CARD_EXTENSION.length) : null;
}

/**
 * Reads a person's uid out of an href a client sent.
 *
 * @param href - A path or a whole URL.
 * @returns The uid, or null when the href is not a card in the address book.
 */
export function uidOfHref(href: string): string | null {
  try {
    const { pathname } = new URL(href.trim(), ANY_ORIGIN);
    const isInBook = pathname.startsWith(DavPath.Book);
    const name = isInBook ? decodeURIComponent(pathname.slice(DavPath.Book.length)) : '';
    return name.includes('/') ? null : uidOfName(name);
  } catch {
    // Not a URL, or not valid percent-encoding: no card is named by it.
    return null;
  }
}

/**
 * Writes a person's entity tag.
 *
 * @param revision - The user's change count when the person last changed.
 * @returns The tag, quoted as a header carries it.
 */
export function etagOf(revision: number): string {
  return `"${revision}"`;
}

/**
 * Writes the token that stands for the address book as it is now.
 *
 * @param revision - The user's change count.
 * @returns The token.
 */
export function syncTokenOf(revision: number): string {
  return `${SYNC_TOKEN_PREFIX}${revision}`;
}

/**
 * Reads the change count out of a sync token.
 *
 * @param token - What a client sent.
 * @returns The count, or null when the token is not one of this server's.
 */
export function revisionOfSyncToken(token: string): number | null {
  const count = token.startsWith(SYNC_TOKEN_PREFIX) ? token.slice(SYNC_TOKEN_PREFIX.length) : '';
  return WHOLE_NUMBER.test(count) ? Number(count) : null;
}
