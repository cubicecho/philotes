import type { Server } from 'node:http';
import { Readable } from 'node:stream';
import * as dbSchema from '@cubicecho/philotes-db/schema';
import { eq } from 'drizzle-orm';
import { XMLParser } from 'fast-xml-parser';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Auth } from '../../auth/better-auth.ts';
import { DavPath } from '../../carddav/dav.ts';
import { HttpStatus } from '../../core/wire.ts';
import { createApp } from '../../http/app.ts';
import type { AvatarStore } from '../../persons/avatar-store.ts';
import { createTestAuth, createTestDb, createUser, portOf, type TestDb } from '../helpers.ts';

/** One resource of a multi-status answer, as the tests read it. */
interface Resource {
  href: string;
  /** The resource's own status line, on one that is gone. */
  status: string | null;
  /** The properties found, by local name. */
  found: Record<string, unknown>;
  /** The local names of the properties asked for that the resource does not have. */
  missing: string[];
}

/** What a request to the address book is made with. */
interface DavRequestInit {
  /** The `Authorization` header. Left out, the request is anonymous. */
  as?: string;
  body?: string;
  headers?: Record<string, string>;
}

const OK_LINE = 'HTTP/1.1 200 OK';
const NOT_FOUND_LINE = 'HTTP/1.1 404 Not Found';
const PICTURE = Buffer.from('picture').toString('base64');

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  parseTagValue: false,
  isArray: (name) => name === 'response' || name === 'propstat',
});

/**
 * Writes a vCard.
 *
 * @param lines - The card's properties.
 * @returns The card's text.
 */
function vcard(...lines: string[]): string {
  return ['BEGIN:VCARD', 'VERSION:3.0', ...lines, 'END:VCARD', ''].join('\r\n');
}

/**
 * Writes a PROPFIND body.
 *
 * @param props - The properties asked for, with their prefixes.
 * @returns The XML.
 */
function propfind(...props: string[]): string {
  const asked = props.map((prop) => `<${prop}/>`).join('');
  return `<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav" xmlns:cs="http://calendarserver.org/ns/"><d:prop>${asked}</d:prop></d:propfind>`;
}

/**
 * Writes a sync-collection body.
 *
 * @param token - The token the client holds, or empty for a first sync.
 * @returns The XML.
 */
function syncCollection(token: string): string {
  return `<d:sync-collection xmlns:d="DAV:"><d:sync-token>${token}</d:sync-token><d:sync-level>1</d:sync-level><d:prop><d:getetag/></d:prop></d:sync-collection>`;
}

/**
 * Writes an addressbook-multiget body that asks for the cards themselves.
 *
 * @param hrefs - The cards.
 * @returns The XML.
 */
function multiget(...hrefs: string[]): string {
  const named = hrefs.map((href) => `<d:href>${href}</d:href>`).join('');
  return `<card:addressbook-multiget xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav"><d:prop><d:getetag/><card:address-data/></d:prop>${named}</card:addressbook-multiget>`;
}

/**
 * Reads a multi-status body.
 *
 * @param xml - The body.
 * @returns Its resources, and its sync token when it has one.
 */
function readMultiStatus(xml: string): { resources: Resource[]; syncToken: string | null } {
  const { multistatus } = parser.parse(xml);
  const responses: Array<Record<string, unknown>> = multistatus.response ?? [];
  const resources = responses.map((response) => {
    const propstats = (response.propstat ?? []) as Array<{ prop: Record<string, unknown> | ''; status: string }>;
    const propsWith = (line: string) =>
      Object.assign({}, ...propstats.filter((propstat) => propstat.status === line).map((propstat) => propstat.prop));
    return {
      href: String(response.href),
      status: typeof response.status === 'string' ? response.status : null,
      found: propsWith(OK_LINE),
      missing: Object.keys(propsWith(NOT_FOUND_LINE)),
    };
  });
  return { resources, syncToken: multistatus['sync-token'] ?? null };
}

/**
 * Builds a store that keeps its files in a map.
 *
 * @returns The store and its files.
 */
function memoryStore(): { store: AvatarStore; files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>();
  const store: AvatarStore = {
    prepare: async () => {},
    put: async (name, body) => {
      files.set(name, body);
    },
    read: async (name) => {
      const body = files.get(name);
      return body === undefined ? null : Readable.from([body]);
    },
    remove: async (name) => {
      files.delete(name);
    },
  };
  return { store, files };
}

describe('CardDAV', () => {
  let db: TestDb;
  let auth: Auth;
  let server: Server;
  let baseUrl: string;
  let files: Map<string, Buffer>;
  let owner: string;
  let ownerId: string;

  /**
   * Makes a user with an API key.
   *
   * @param email - The user's email.
   * @returns The user's id, their key, and the `Authorization` header a client would send.
   */
  async function signUp(email: string): Promise<{ userId: string; key: string; header: string }> {
    const userId = await createUser(db, email);
    // A sync makes many requests, so the key carries no rate limit, as one made in the app does.
    const { key } = await auth.api.createApiKey({ body: { userId, name: 'phone', rateLimitEnabled: false } });
    return { userId, key, header: basic(email, key) };
  }

  /**
   * Writes an `Authorization: Basic` header.
   *
   * @param username - The user name.
   * @param password - The password.
   * @returns The header's value.
   */
  function basic(username: string, password: string): string {
    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  /**
   * Sends a request to the server.
   *
   * @param method - The method.
   * @param path - The path.
   * @param init - Who is asking, and with what.
   * @returns The response.
   */
  function dav(method: string, path: string, init: DavRequestInit = {}): Promise<Response> {
    const authorization: Record<string, string> = init.as === undefined ? {} : { Authorization: init.as };
    return fetch(`${baseUrl}${path}`, {
      method,
      body: init.body,
      redirect: 'manual',
      headers: { ...authorization, ...init.headers },
    });
  }

  /**
   * Asks a collection for properties and reads the answer.
   *
   * @param path - The collection.
   * @param as - The `Authorization` header.
   * @param depth - The `Depth` header.
   * @param props - The properties asked for.
   * @returns The resources listed.
   */
  async function list(path: string, as: string, depth: string, ...props: string[]): Promise<Resource[]> {
    const response = await dav('PROPFIND', path, { as, body: propfind(...props), headers: { Depth: depth } });
    expect(response.status).toBe(HttpStatus.MultiStatus);
    return readMultiStatus(await response.text()).resources;
  }

  /**
   * Runs a report on the address book and reads the answer.
   *
   * @param as - The `Authorization` header.
   * @param body - The report.
   * @returns The resources, and the sync token when there is one.
   */
  async function report(as: string, body: string): Promise<{ resources: Resource[]; syncToken: string | null }> {
    const response = await dav('REPORT', DavPath.Book, { as, body });
    expect(response.status).toBe(HttpStatus.MultiStatus);
    return readMultiStatus(await response.text());
  }

  beforeAll(async () => {
    db = await createTestDb();
    ({ auth } = createTestAuth(db));
    const memory = memoryStore();
    files = memory.files;
    server = createApp({ db, auth, avatarStore: memory.store }).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${portOf(server)}`;
    ({ header: owner, userId: ownerId } = await signUp('dav-owner@example.com'));
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  describe('finding the address book', () => {
    it('sends a client that knows only the server’s name to the root', async () => {
      const response = await dav('PROPFIND', DavPath.WellKnown);

      expect(response.status).toBe(HttpStatus.MovedPermanently);
      expect(response.headers.get('location')).toBe(DavPath.Root);
    });

    it('says what it can do before a client signs in', async () => {
      const response = await dav('OPTIONS', DavPath.Root);

      expect(response.status).toBe(HttpStatus.Ok);
      expect(response.headers.get('dav')).toContain('addressbook');
      expect(response.headers.get('allow')).toContain('REPORT');
    });

    it('leads from the root to the user, to their address books, to the one address book', async () => {
      const [root] = await list(DavPath.Root, owner, '0', 'd:current-user-principal');
      const [principal] = await list(DavPath.Principal, owner, '0', 'card:addressbook-home-set', 'd:displayname');
      const home = await list(DavPath.Home, owner, '1', 'd:resourcetype', 'd:displayname', 'd:sync-token');
      const book = home.find((resource) => resource.href === DavPath.Book);

      expect(root.found['current-user-principal']).toEqual({ href: DavPath.Principal });
      expect(principal.found['addressbook-home-set']).toEqual({ href: DavPath.Home });
      expect(principal.found.displayname).toBe('dav-owner@example.com');
      expect(home.map((resource) => resource.href)).toEqual([DavPath.Home, DavPath.Book]);
      expect(book?.found.resourcetype).toEqual({ collection: '', addressbook: '' });
      expect(book?.found['sync-token']).toMatch(/^urn:philotes:sync:\d+$/);
    });

    it('describes only the resource itself at depth 0, and every property when none is named', async () => {
      const response = await dav('PROPFIND', DavPath.Book, { as: owner, headers: { Depth: '0' } });
      const { resources } = readMultiStatus(await response.text());

      expect(resources).toHaveLength(1);
      expect(Object.keys(resources[0].found)).toEqual(
        expect.arrayContaining(['resourcetype', 'supported-report-set', 'getctag', 'current-user-privilege-set']),
      );
    });

    it('says which of the properties asked for a resource does not have', async () => {
      const [book] = await list(DavPath.Book, owner, '0', 'd:displayname', 'd:getetag', 'x:from-elsewhere');

      expect(book.found.displayname).toBe('Philotes');
      expect(book.missing).toEqual(['getetag']);
    });
  });

  describe('signing in', () => {
    it('asks for credentials when a request has none', async () => {
      const response = await dav('PROPFIND', DavPath.Root);

      expect(response.status).toBe(HttpStatus.Unauthorized);
      expect(response.headers.get('www-authenticate')).toContain('Basic realm="Philotes"');
    });

    it('refuses a key nobody was issued, a key under another user’s email, and a password that is not a key', async () => {
      const { key } = await signUp('dav-other@example.com');
      const unknown = await dav('PROPFIND', DavPath.Root, {
        as: basic('dav-owner@example.com', `phlt_${'x'.repeat(64)}`),
      });
      const mismatched = await dav('PROPFIND', DavPath.Root, { as: basic('dav-owner@example.com', key) });
      const notAKey = await dav('PROPFIND', DavPath.Root, { as: basic('dav-owner@example.com', 'hunter2') });
      const bearer = await dav('PROPFIND', DavPath.Root, { headers: { Authorization: `Bearer ${key}` } });

      expect(unknown.status).toBe(HttpStatus.Unauthorized);
      expect(mismatched.status).toBe(HttpStatus.Unauthorized);
      expect(notAKey.status).toBe(HttpStatus.Unauthorized);
      expect(bearer.status).toBe(HttpStatus.Unauthorized);
    });

    it('takes the email in any case', async () => {
      const { key } = await signUp('dav-cased@example.com');
      const response = await dav('PROPFIND', DavPath.Root, { as: basic('DAV-Cased@Example.com', key) });

      expect(response.status).toBe(HttpStatus.MultiStatus);
    });
  });

  describe('cards', () => {
    const ADA = `${DavPath.Book}ada.vcf`;

    it('keeps a card a client puts, and serves it back with a tag', async () => {
      const created = await dav('PUT', ADA, {
        as: owner,
        body: vcard('UID:something-else', 'FN:Ada Lovelace', 'N:Lovelace;Ada;;;', 'TEL;TYPE=CELL:+1 415 555 0100'),
        headers: { 'If-None-Match': '*', 'Content-Type': 'text/vcard' },
      });
      const fetched = await dav('GET', ADA, { as: owner });
      const body = await fetched.text();

      expect(created.status).toBe(HttpStatus.Created);
      expect(created.headers.get('etag')).toBeNull();
      expect(fetched.status).toBe(HttpStatus.Ok);
      expect(fetched.headers.get('content-type')).toBe('text/vcard; charset=utf-8');
      expect(fetched.headers.get('etag')).toMatch(/^"\d+"$/);
      expect(body).toContain('FN:Ada Lovelace');
      // The name the card was put under is the one it is known by.
      expect(body).toContain('UID:ada');
      expect(body).toContain('TEL;TYPE=CELL:+1 415 555 0100');
    });

    it('lists the card with its tag', async () => {
      const fetched = await dav('GET', ADA, { as: owner });
      const resources = await list(DavPath.Book, owner, '1', 'd:getetag', 'd:getcontenttype');
      const card = resources.find((resource) => resource.href === ADA);

      expect(card?.found.getetag).toBe(fetched.headers.get('etag'));
      expect(card?.found.getcontenttype).toBe('text/vcard; charset=utf-8');
    });

    it('answers a HEAD with the tag and no body', async () => {
      const response = await dav('HEAD', ADA, { as: owner });

      expect(response.status).toBe(HttpStatus.Ok);
      expect(response.headers.get('etag')).toMatch(/^"\d+"$/);
      expect(await response.text()).toBe('');
    });

    it('replaces the card only when the client holds its current tag', async () => {
      const before = (await dav('GET', ADA, { as: owner })).headers.get('etag') ?? '';
      const body = vcard('FN:Ada King', 'N:King;Ada;;;');
      const again = await dav('PUT', ADA, { as: owner, body, headers: { 'If-None-Match': '*' } });
      const stale = await dav('PUT', ADA, { as: owner, body, headers: { 'If-Match': '"0"' } });
      const current = await dav('PUT', ADA, { as: owner, body, headers: { 'If-Match': before } });
      const after = await dav('GET', ADA, { as: owner });
      const text = await after.text();

      expect(again.status).toBe(HttpStatus.PreconditionFailed);
      expect(stale.status).toBe(HttpStatus.PreconditionFailed);
      expect(current.status).toBe(HttpStatus.NoContent);
      expect(after.headers.get('etag')).not.toBe(before);
      expect(text).toContain('FN:Ada King');
      // The card is the whole truth: the number the new one left out is gone.
      expect(text).not.toContain('TEL');
    });

    it('refuses an update to a card that is not there', async () => {
      const response = await dav('PUT', `${DavPath.Book}nobody.vcf`, {
        as: owner,
        body: vcard('FN:Nobody'),
        headers: { 'If-Match': '"3"' },
      });

      expect(response.status).toBe(HttpStatus.PreconditionFailed);
    });

    it('refuses a body that is not one card it can keep, and says so', async () => {
      const path = `${DavPath.Book}bad.vcf`;
      const garbage = await dav('PUT', path, { as: owner, body: 'not a card' });
      const two = await dav('PUT', path, { as: owner, body: vcard('FN:One') + vcard('FN:Two') });
      const nameless = await dav('PUT', path, { as: owner, body: vcard('EMAIL:nobody@example.com') });
      const misnamed = await dav('PUT', `${DavPath.Book}bad`, { as: owner, body: vcard('FN:Bad') });
      const missing = await dav('GET', path, { as: owner });

      expect(garbage.status).toBe(HttpStatus.Forbidden);
      expect(await garbage.text()).toContain('valid-address-data');
      expect(two.status).toBe(HttpStatus.Forbidden);
      expect(nameless.status).toBe(HttpStatus.Forbidden);
      expect(misnamed.status).toBe(HttpStatus.Forbidden);
      expect(missing.status).toBe(HttpStatus.NotFound);
    });

    it('fetches the cards a client names, and says which are not there', async () => {
      const gone = `${DavPath.Book}gone.vcf`;
      const { resources } = await report(owner, multiget(ADA, gone, `${baseUrl}${ADA}`));

      // A card is answered at its own path, however the client wrote it. One that is gone, as it was asked for.
      expect(resources.map((resource) => resource.href)).toEqual([ADA, gone, ADA]);
      expect(String(resources[0].found['address-data'])).toContain('FN:Ada King');
      expect(resources[0].found.getetag).toMatch(/^"\d+"$/);
      expect(resources[1].status).toBe(NOT_FOUND_LINE);
      expect(String(resources[2].found['address-data'])).toContain('FN:Ada King');
    });

    it('answers a query with every card', async () => {
      const body =
        '<card:addressbook-query xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav"><d:prop><d:getetag/></d:prop><card:filter/></card:addressbook-query>';
      const { resources } = await report(owner, body);

      expect(resources.map((resource) => resource.href)).toContain(ADA);
      expect(resources[0].found['address-data']).toBeUndefined();
    });

    it('deletes a card, and the person with it', async () => {
      const path = `${DavPath.Book}short-lived.vcf`;
      await dav('PUT', path, { as: owner, body: vcard('FN:Short Lived') });
      const stale = await dav('DELETE', path, { as: owner, headers: { 'If-Match': '"0"' } });
      const deleted = await dav('DELETE', path, { as: owner });
      const fetched = await dav('GET', path, { as: owner });
      const again = await dav('DELETE', path, { as: owner });
      const people = await db
        .select({ uid: dbSchema.persons.uid })
        .from(dbSchema.persons)
        .where(eq(dbSchema.persons.userId, ownerId));

      expect(stale.status).toBe(HttpStatus.PreconditionFailed);
      expect(deleted.status).toBe(HttpStatus.NoContent);
      expect(fetched.status).toBe(HttpStatus.NotFound);
      expect(again.status).toBe(HttpStatus.NotFound);
      expect(people.map((person: { uid: string }) => person.uid)).not.toContain('short-lived');
    });

    it('keeps a name that needs escaping in a path', async () => {
      const uid = 'urn:uuid:4fbe8971 ä';
      const path = `${DavPath.Book}${encodeURIComponent(uid)}.vcf`;
      const created = await dav('PUT', path, { as: owner, body: vcard('FN:Odd Name') });
      const resources = await list(DavPath.Book, owner, '1', 'd:getetag');
      const fetched = await dav('GET', path, { as: owner });

      expect(created.status).toBe(HttpStatus.Created);
      expect(resources.map((resource) => resource.href)).toContain(path);
      expect(await fetched.text()).toContain('FN:Odd Name');
    });

    it('carries a picture both ways, and drops the file with the card', async () => {
      const path = `${DavPath.Book}pictured.vcf`;
      await dav('PUT', path, { as: owner, body: vcard('FN:Pictured', `PHOTO;ENCODING=b;TYPE=PNG:${PICTURE}`) });
      const stored = files.size;
      const text = await (await dav('GET', path, { as: owner })).text();
      await dav('DELETE', path, { as: owner });

      expect(stored).toBe(1);
      expect(text.replace(/\r\n /g, '')).toContain(PICTURE);
      expect(files.size).toBe(0);
    });
  });

  describe('what a method or a body may be', () => {
    it('refuses a method a resource does not take, and names the ones it does', async () => {
      const response = await dav('PROPPATCH', DavPath.Book, { as: owner, body: propfind('d:displayname') });
      const onCollection = await dav('GET', DavPath.Book, { as: owner });

      expect(response.status).toBe(HttpStatus.MethodNotAllowed);
      expect(response.headers.get('allow')).toBe('OPTIONS, PROPFIND, REPORT');
      expect(onCollection.status).toBe(HttpStatus.MethodNotAllowed);
    });

    it('refuses a body that is not a question it answers', async () => {
      const garbage = await dav('PROPFIND', DavPath.Book, { as: owner, body: 'not xml <<<' });
      const unknown = await dav('REPORT', DavPath.Book, { as: owner, body: '<d:expand-property xmlns:d="DAV:"/>' });
      const misplaced = await dav('REPORT', DavPath.Book, { as: owner, body: propfind('d:getetag') });

      expect(garbage.status).toBe(HttpStatus.BadRequest);
      expect(unknown.status).toBe(HttpStatus.BadRequest);
      expect(misplaced.status).toBe(HttpStatus.BadRequest);
    });
  });

  describe('syncing', () => {
    it('gives everything first, then only what changed or went', async () => {
      const { header } = await signUp('dav-sync@example.com');
      const kept = `${DavPath.Book}kept.vcf`;
      const edited = `${DavPath.Book}edited.vcf`;
      const removed = `${DavPath.Book}removed.vcf`;
      for (const [path, name] of [
        [kept, 'Kept'],
        [edited, 'Edited'],
        [removed, 'Removed'],
      ]) {
        await dav('PUT', path, { as: header, body: vcard(`FN:${name}`) });
      }

      const first = await report(header, syncCollection(''));
      const idle = await report(header, syncCollection(first.syncToken ?? ''));
      await dav('PUT', edited, { as: header, body: vcard('FN:Edited Again') });
      await dav('DELETE', removed, { as: header });
      const second = await report(header, syncCollection(first.syncToken ?? ''));
      const [book] = await list(DavPath.Book, header, '0', 'd:sync-token', 'cs:getctag');

      expect(first.resources.map((resource) => resource.href).sort()).toEqual([edited, kept, removed]);
      expect(first.syncToken).toMatch(/^urn:philotes:sync:\d+$/);
      expect(idle.resources).toEqual([]);
      expect(idle.syncToken).toBe(first.syncToken);
      expect(second.syncToken).not.toBe(first.syncToken);
      expect(second.resources.map((resource) => resource.href).sort()).toEqual([edited, removed]);
      expect(second.resources.find((resource) => resource.href === edited)?.found.getetag).toMatch(/^"\d+"$/);
      expect(second.resources.find((resource) => resource.href === removed)?.status).toBe(NOT_FOUND_LINE);
      expect(book.found['sync-token']).toBe(second.syncToken);
      expect(book.found.getctag).toBe(second.syncToken);
    });

    it('tells a client whose token it never gave out to start over', async () => {
      const foreign = await dav('REPORT', DavPath.Book, { as: owner, body: syncCollection('http://example.com/7') });
      const ahead = await dav('REPORT', DavPath.Book, {
        as: owner,
        body: syncCollection('urn:philotes:sync:999999'),
      });

      expect(foreign.status).toBe(HttpStatus.Forbidden);
      expect(await foreign.text()).toContain('valid-sync-token');
      expect(ahead.status).toBe(HttpStatus.Forbidden);
    });
  });

  describe('one user’s address book and another’s', () => {
    it('shows a user none of another’s cards, under any name', async () => {
      const { header: stranger } = await signUp('dav-stranger@example.com');
      const path = `${DavPath.Book}ada.vcf`;
      const fetched = await dav('GET', path, { as: stranger });
      const deleted = await dav('DELETE', path, { as: stranger });
      const listed = await list(DavPath.Book, stranger, '1', 'd:getetag');
      const named = await report(stranger, multiget(path));
      const synced = await report(stranger, syncCollection(''));

      expect(fetched.status).toBe(HttpStatus.NotFound);
      expect(deleted.status).toBe(HttpStatus.NotFound);
      expect(listed.map((resource) => resource.href)).toEqual([DavPath.Book]);
      expect(named.resources[0].status).toBe(NOT_FOUND_LINE);
      expect(synced.resources).toEqual([]);
    });

    it('lets two users keep a card under the same name', async () => {
      const { header: stranger } = await signUp('dav-namesake@example.com');
      const path = `${DavPath.Book}ada.vcf`;
      const created = await dav('PUT', path, { as: stranger, body: vcard('FN:Another Ada') });
      const theirs = await (await dav('GET', path, { as: stranger })).text();
      const ours = await (await dav('GET', path, { as: owner })).text();

      expect(created.status).toBe(HttpStatus.Created);
      expect(theirs).toContain('FN:Another Ada');
      expect(ours).toContain('FN:Ada King');
    });
  });
});
