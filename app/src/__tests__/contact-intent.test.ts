import { describe, expect, it } from 'vitest';
import {
  type ContactIntent,
  ContactIntentAction,
  ContactResolutionKind,
  type ContactResolver,
  ContactRoute,
  contactIntentHref,
  hrefToPath,
  isContactUri,
  personUidOf,
  prefillFromExtras,
  prefillFromParams,
  resolveContactUri,
  splitFullName,
} from '@/lib/contact-intent';

const LOOKUP_URI = 'content://com.android.contacts/contacts/lookup/0r1-ABC/1';

/** An intent with nothing in it but what a test gives. */
function intentOf(overrides: Partial<ContactIntent>): ContactIntent {
  return { action: null, data: null, type: null, extras: {}, ...overrides };
}

describe('isContactUri', () => {
  it('knows the contacts provider by its authority', () => {
    expect(isContactUri(LOOKUP_URI)).toBe(true);
    expect(isContactUri('philotes://persons')).toBe(false);
    expect(isContactUri('/persons')).toBe(false);
    expect(isContactUri(null)).toBe(false);
  });
});

describe('splitFullName', () => {
  it('takes the last word as the family name', () => {
    expect(splitFullName('Ada King Lovelace')).toEqual({ firstName: 'Ada King', lastName: 'Lovelace' });
  });

  it('keeps a single word as a first name', () => {
    expect(splitFullName('  Ada ')).toEqual({ firstName: 'Ada' });
  });

  it('gives nothing for an empty name', () => {
    expect(splitFullName('   ')).toEqual({});
  });
});

describe('prefillFromExtras', () => {
  it('maps the insert extras onto the form', () => {
    expect(
      prefillFromExtras({
        name: 'Ada Lovelace',
        phone: ' +44 20 7946 0000 ',
        email: 'ada@example.com',
        company: 'Analytical Engines',
        job_title: 'Programmer',
        notes: 'Met at the Royal Society',
        unrelated: 'ignored',
      }),
    ).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+44 20 7946 0000',
      email: 'ada@example.com',
      organization: 'Analytical Engines',
      jobTitle: 'Programmer',
      about: 'Met at the Royal Society',
    });
  });

  it('leaves blank extras out', () => {
    expect(prefillFromExtras({ phone: '555-0100', email: ' ' })).toEqual({ phone: '555-0100' });
  });
});

describe('contactIntentHref', () => {
  it('opens a viewed contact', () => {
    expect(contactIntentHref(intentOf({ action: ContactIntentAction.View, data: LOOKUP_URI }))).toEqual({
      pathname: ContactRoute.Open,
      params: { uri: LOOKUP_URI },
    });
  });

  it('opens an edited contact on its form', () => {
    expect(contactIntentHref(intentOf({ action: ContactIntentAction.Edit, data: LOOKUP_URI }))).toEqual({
      pathname: ContactRoute.Open,
      params: { uri: LOOKUP_URI, edit: '1' },
    });
  });

  it('starts a new person from an insert, prefilled', () => {
    const insert = intentOf({ action: ContactIntentAction.Insert, extras: { phone: '555-0100' } });
    expect(contactIntentHref(insert)).toEqual({
      pathname: ContactRoute.NewPerson,
      params: { new: '1', phone: '555-0100' },
    });
    const insertOrEdit = intentOf({ action: ContactIntentAction.InsertOrEdit, extras: { name: 'Ada' } });
    expect(contactIntentHref(insertOrEdit)).toEqual({
      pathname: ContactRoute.NewPerson,
      params: { new: '1', firstName: 'Ada' },
    });
  });

  it('lists people for a pick', () => {
    expect(contactIntentHref(intentOf({ action: ContactIntentAction.Pick }))).toEqual({
      pathname: ContactRoute.Pick,
      params: {},
    });
  });

  it('ignores the launcher and a view of something else', () => {
    expect(contactIntentHref(intentOf({ action: 'android.intent.action.MAIN' }))).toBeNull();
    expect(contactIntentHref(intentOf({ action: ContactIntentAction.View, data: 'https://example.com' }))).toBeNull();
  });
});

describe('hrefToPath', () => {
  it('encodes the query', () => {
    expect(hrefToPath({ pathname: ContactRoute.Open, params: { uri: LOOKUP_URI } })).toBe(
      `/contacts/open?uri=${encodeURIComponent(LOOKUP_URI)}`,
    );
    expect(hrefToPath({ pathname: ContactRoute.Pick, params: {} })).toBe('/contacts/pick');
  });
});

describe('prefillFromParams', () => {
  it('reads only the known keys that hold text', () => {
    expect(prefillFromParams({ firstName: 'Ada', phone: '', new: '1', email: ['a', 'b'] })).toEqual({
      firstName: 'Ada',
    });
  });
});

describe('personUidOf', () => {
  it('prefers the UID DAVx5 keeps in SYNC1', () => {
    expect(personUidOf({ uid: 'abc', fileName: 'other.vcf' })).toBe('abc');
  });

  it('falls back to the card name in SOURCE_ID', () => {
    expect(personUidOf({ uid: null, fileName: 'a%20b.vcf' })).toBe('a b');
  });

  it('gives nothing for a contact not yet synced', () => {
    expect(personUidOf({ uid: null, fileName: null })).toBeNull();
    expect(personUidOf({ uid: null, fileName: 'not-a-card' })).toBeNull();
    expect(personUidOf(null)).toBeNull();
  });
});

describe('resolveContactUri', () => {
  /** A resolver with a phone that knows one contact and a server that knows one person. */
  function resolverOf(overrides: Partial<ContactResolver> = {}): ContactResolver {
    return {
      readSync: async (uri) => (uri === LOOKUP_URI ? { uid: 'uid-1', fileName: 'uid-1.vcf' } : null),
      requestPermission: async () => true,
      findPersonId: async (uid) => (uid === 'uid-1' ? 'person-1' : null),
      ...overrides,
    };
  }

  it('finds the person by the UID on the raw contact', async () => {
    expect(await resolveContactUri(LOOKUP_URI, resolverOf())).toEqual({
      kind: ContactResolutionKind.Person,
      personId: 'person-1',
    });
  });

  it('says when the contact is not one of Philotes', async () => {
    expect(await resolveContactUri('content://com.android.contacts/contacts/9', resolverOf())).toEqual({
      kind: ContactResolutionKind.NotPhilotes,
    });
  });

  it('says when the UID names no person', async () => {
    const resolver = resolverOf({ findPersonId: async () => null });
    expect(await resolveContactUri(LOOKUP_URI, resolver)).toEqual({
      kind: ContactResolutionKind.NoPerson,
      uid: 'uid-1',
    });
  });

  it('says when the build or the permission stands in the way', async () => {
    expect(await resolveContactUri(LOOKUP_URI, resolverOf({ readSync: null }))).toEqual({
      kind: ContactResolutionKind.NoModule,
    });
    expect(await resolveContactUri(LOOKUP_URI, resolverOf({ requestPermission: async () => false }))).toEqual({
      kind: ContactResolutionKind.Denied,
    });
  });
});
