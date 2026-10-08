import type { DB } from '@cubicecho/philotes-db';
import express, { type NextFunction, type Request, type RequestHandler, type Response, Router } from 'express';
import type { Auth } from '../auth/better-auth.ts';
import { CARDDAV_DEFAULTS } from '../core/defaults.ts';
import { HttpStatus } from '../core/wire.ts';
import type { AvatarStore } from '../persons/avatar-store.ts';
import { VCardSyntaxError } from '../vcard/card.ts';
import { CardRejectedError } from '../vcard/store.ts';
import { type DavLocals, type DavUserResponse, requireDavUser } from './auth.ts';
import {
  type BookDeps,
  type BookEntry,
  bookRevision,
  deleteCard,
  NotOneCardError,
  putCard,
  readDeletedSince,
  readEntries,
  readPreconditions,
  WriteOutcome,
} from './book.ts';
import {
  cardHref,
  DAV_CAPABILITIES,
  DavMethod,
  DavPath,
  DavPrecondition,
  DavProp,
  DavRequestKind,
  NS_CARDDAV,
  NS_DAV,
  revisionOfSyncToken,
  syncTokenOf,
  uidOfHref,
  uidOfName,
  VCARD_CONTENT_TYPE,
  XML_CONTENT_TYPE,
} from './dav.ts';
import {
  type DavRequest,
  type DavResponse,
  DavSyntaxError,
  multiStatus,
  type PropValues,
  preconditionError,
  readDavRequest,
  type XmlNode,
} from './xml.ts';

/** What the address book is served from. */
export interface CardDavDeps {
  /** Drizzle client. */
  db: DB;
  /** Verifies the API key a client signs in with. */
  auth: Auth;
  /** Where pictures are kept, or null to serve and take cards without them. */
  avatarStore: AvatarStore | null;
}

/** A handler behind the guard, which has left the user on `res.locals`. */
type DavHandler = (req: Request, res: DavUserResponse) => Promise<void>;

/** A resource as a PROPFIND lists it: itself, and what is in it. */
interface Listing {
  self: DavResponse;
  children: DavResponse[];
}

/** The `Depth` that asks about a resource alone. Anything else also lists what is in it. */
const DEPTH_SELF = '0';
/** The media type and version of the cards served, as the address book declares them. */
const ADDRESS_DATA_TYPE = { '@_content-type': 'text/vcard', '@_version': '3.0' };
/** What a signed-in user may do to their own address book: everything. */
const PRIVILEGES = ['read', 'write', 'write-content', 'bind', 'unbind'];
/** The reports the address book answers, by their prefixed name. */
const REPORTS = [`${NS_CARDDAV}:addressbook-multiget`, `${NS_CARDDAV}:addressbook-query`, `${NS_DAV}:sync-collection`];

/** The status each end of a write is answered with. */
const WRITE_STATUS: Record<WriteOutcome, HttpStatus> = {
  [WriteOutcome.Created]: HttpStatus.Created,
  [WriteOutcome.Updated]: HttpStatus.NoContent,
  [WriteOutcome.Deleted]: HttpStatus.NoContent,
  [WriteOutcome.Missing]: HttpStatus.NotFound,
  [WriteOutcome.PreconditionFailed]: HttpStatus.PreconditionFailed,
};

/**
 * Writes a link to another resource.
 *
 * @param href - The resource's path.
 * @returns The element.
 */
function link(href: string): XmlNode {
  return { [`${NS_DAV}:href`]: href };
}

/**
 * Writes a resource type.
 *
 * @param names - The prefixed names of the types.
 * @returns The elements.
 */
function types(...names: string[]): XmlNode {
  return Object.fromEntries(names.map((name) => [name, '']));
}

/**
 * Describes the root, where a client starts and learns who it is signed in as.
 *
 * @returns The resource.
 */
function rootResource(): DavResponse {
  return {
    href: DavPath.Root,
    props: {
      [DavProp.ResourceType]: types(`${NS_DAV}:collection`),
      [DavProp.DisplayName]: CARDDAV_DEFAULTS.addressBookName,
      [DavProp.CurrentUserPrincipal]: link(DavPath.Principal),
    },
  };
}

/**
 * Describes the signed-in user, who points at where their address books are.
 *
 * @param email - The user's email.
 * @returns The resource.
 */
function principalResource(email: string): DavResponse {
  return {
    href: DavPath.Principal,
    props: {
      [DavProp.ResourceType]: types(`${NS_DAV}:collection`, `${NS_DAV}:principal`),
      [DavProp.DisplayName]: email,
      [DavProp.CurrentUserPrincipal]: link(DavPath.Principal),
      [DavProp.PrincipalUrl]: link(DavPath.Principal),
      [DavProp.AddressBookHomeSet]: link(DavPath.Home),
    },
  };
}

/**
 * Describes the collection that holds the user's one address book.
 *
 * @returns The resource.
 */
function homeResource(): DavResponse {
  return {
    href: DavPath.Home,
    props: {
      [DavProp.ResourceType]: types(`${NS_DAV}:collection`),
      [DavProp.DisplayName]: CARDDAV_DEFAULTS.addressBookName,
      [DavProp.CurrentUserPrincipal]: link(DavPath.Principal),
    },
  };
}

/**
 * Describes the address book.
 *
 * @param revision - How many changes the user's people have seen.
 * @returns The resource.
 */
function bookResource(revision: number): DavResponse {
  const token = syncTokenOf(revision);
  return {
    href: DavPath.Book,
    props: {
      [DavProp.ResourceType]: types(`${NS_DAV}:collection`, `${NS_CARDDAV}:addressbook`),
      [DavProp.DisplayName]: CARDDAV_DEFAULTS.addressBookName,
      [DavProp.CurrentUserPrincipal]: link(DavPath.Principal),
      [DavProp.SupportedReportSet]: {
        [`${NS_DAV}:supported-report`]: REPORTS.map((report) => ({ [`${NS_DAV}:report`]: { [report]: '' } })),
      },
      [DavProp.SupportedAddressData]: { [`${NS_CARDDAV}:address-data-type`]: ADDRESS_DATA_TYPE },
      [DavProp.CurrentUserPrivilegeSet]: {
        [`${NS_DAV}:privilege`]: PRIVILEGES.map((privilege) => ({ [`${NS_DAV}:${privilege}`]: '' })),
      },
      [DavProp.MaxResourceSize]: String(CARDDAV_DEFAULTS.cardMaxBytes),
      [DavProp.SyncToken]: token,
      [DavProp.CTag]: token,
    },
  };
}

/**
 * Describes one card.
 *
 * @param entry - The card.
 * @returns The resource.
 */
function cardResource(entry: BookEntry): DavResponse {
  const props: PropValues = {
    [DavProp.ResourceType]: '',
    [DavProp.ETag]: entry.etag,
    [DavProp.ContentType]: VCARD_CONTENT_TYPE,
  };
  if (entry.vcard !== null) {
    props[DavProp.AddressData] = entry.vcard;
  }
  return { href: cardHref(entry.uid), props };
}

/**
 * Whether a request asks for the cards themselves, which costs reading everything about each person.
 *
 * @param request - The request.
 * @returns True when `address-data` is among the properties asked for.
 */
function wantsCards(request: DavRequest): boolean {
  return request.props?.includes(DavProp.AddressData) === true;
}

/**
 * Sends a multi-status answer.
 *
 * @param res - The response.
 * @param responses - The resources.
 * @param request - What was asked, which says which properties are sent.
 * @param syncToken - The address book's token, on the answer to a sync.
 * @returns Nothing.
 */
function sendMultiStatus(res: Response, responses: DavResponse[], request: DavRequest, syncToken?: string): void {
  res
    .status(HttpStatus.MultiStatus)
    .type(XML_CONTENT_TYPE)
    .send(multiStatus(responses, request.props, syncToken));
}

/**
 * Reads the request's body as a question of one of the kinds a method takes.
 *
 * @param req - The request.
 * @param res - The response, which is answered 400 when the body is not such a question.
 * @param kinds - The kinds the method takes.
 * @returns The question, or null once the request has been refused.
 */
function readQuestion(req: Request, res: Response, kinds: DavRequestKind[]): DavRequest | null {
  try {
    const request = readDavRequest(typeof req.body === 'string' ? req.body : '');
    if (kinds.includes(request.kind)) {
      return request;
    }
    res.status(HttpStatus.BadRequest).send('The request body does not suit the method.');
  } catch (error) {
    if (error instanceof DavSyntaxError === false) {
      throw error;
    }
    res.status(HttpStatus.BadRequest).send(error.message);
  }
  return null;
}

/**
 * Builds a PROPFIND handler for a resource that holds no cards.
 *
 * @param describe - Describes the resource, and what is in it, for the signed-in user.
 * @returns The handler.
 */
function propfindOf(describe: (user: DavLocals) => Listing | Promise<Listing>): DavHandler {
  return async (req, res) => {
    const request = readQuestion(req, res, [DavRequestKind.Propfind]);
    if (request === null) {
      return;
    }
    const { self, children } = await describe(res.locals);
    const isSelfOnly = req.get('depth') === DEPTH_SELF;
    sendMultiStatus(res, isSelfOnly ? [self] : [self, ...children], request);
  };
}

/**
 * Answers a sync: what changed in the address book since the token a client holds.
 *
 * @param deps - The database and the avatar store.
 * @param res - The response.
 * @param request - The sync, with the client's token.
 * @returns Nothing.
 */
async function sendChanges(deps: BookDeps, res: DavUserResponse, request: DavRequest): Promise<void> {
  const { userId } = res.locals;
  // Read first: a change that lands while the rest is read is then sent now and again next time, never missed.
  const current = await bookRevision(deps.db, userId);
  const since = request.syncToken === null ? null : revisionOfSyncToken(request.syncToken);
  const isFirstSync = request.syncToken === null || since === null;
  const isUnknownToken = request.syncToken !== null && (since === null || since > current);
  if (isUnknownToken) {
    res.status(HttpStatus.Forbidden).type(XML_CONTENT_TYPE).send(preconditionError(DavPrecondition.ValidSyncToken));
    return;
  }
  const changed = await readEntries(deps, userId, {
    since: isFirstSync ? undefined : since,
    withData: wantsCards(request),
  });
  const deleted = isFirstSync ? [] : await readDeletedSince(deps.db, userId, since);
  const responses = [...changed.map(cardResource), ...deleted.map((uid) => ({ href: cardHref(uid) }))];
  sendMultiStatus(res, responses, request, syncTokenOf(current));
}

/**
 * Answers a multiget: the cards a client names.
 *
 * @param deps - The database and the avatar store.
 * @param res - The response.
 * @param request - The multiget, with its hrefs.
 * @returns Nothing.
 */
async function sendNamedCards(deps: BookDeps, res: DavUserResponse, request: DavRequest): Promise<void> {
  const named = request.hrefs.map((href) => ({ href, uid: uidOfHref(href) }));
  const uids = named.flatMap(({ uid }) => (uid === null ? [] : [uid]));
  const entries = await readEntries(deps, res.locals.userId, { uids, withData: wantsCards(request) });
  const byUid = new Map(entries.map((entry) => [entry.uid, entry]));
  const responses = named.map(({ href, uid }) => {
    const entry = uid === null ? undefined : byUid.get(uid);
    // A card that is not there is answered at the href the client used, so it can tell which.
    return entry === undefined ? { href } : cardResource(entry);
  });
  sendMultiStatus(res, responses, request);
}

/**
 * Answers a query with every card. The query's filter is not applied: a client narrows what it gets.
 *
 * @param deps - The database and the avatar store.
 * @param res - The response.
 * @param request - The query.
 * @returns Nothing.
 */
async function sendEveryCard(deps: BookDeps, res: DavUserResponse, request: DavRequest): Promise<void> {
  const entries = await readEntries(deps, res.locals.userId, { withData: wantsCards(request) });
  sendMultiStatus(res, entries.map(cardResource), request);
}

/** How each report is answered. */
const REPORT_ANSWERS: Partial<
  Record<DavRequestKind, (deps: BookDeps, res: DavUserResponse, request: DavRequest) => Promise<void>>
> = {
  [DavRequestKind.SyncCollection]: sendChanges,
  [DavRequestKind.Multiget]: sendNamedCards,
  [DavRequestKind.Query]: sendEveryCard,
};

/**
 * Whether an error means the body a client sent is not a card the address book can keep.
 *
 * @param error - What was thrown.
 * @returns True for a body that is not one vCard, or holds something that cannot be saved.
 */
function isBadCard(error: unknown): boolean {
  return error instanceof NotOneCardError || error instanceof VCardSyntaxError || error instanceof CardRejectedError;
}

/**
 * Builds the handlers of the address book and its cards.
 *
 * @param deps - The database and the avatar store.
 * @returns The handlers, by resource and method.
 */
function bookHandlers(deps: BookDeps): {
  book: Partial<Record<DavMethod, DavHandler>>;
  card: Partial<Record<DavMethod, DavHandler>>;
} {
  /** The uid a request's path names. The card routes are only reached with one. */
  const uidOf = (req: Request): string => uidOfName(String(req.params.name)) ?? '';

  const propfindBook: DavHandler = async (req, res) => {
    const request = readQuestion(req, res, [DavRequestKind.Propfind]);
    if (request === null) {
      return;
    }
    const { userId } = res.locals;
    const book = bookResource(await bookRevision(deps.db, userId));
    const isSelfOnly = req.get('depth') === DEPTH_SELF;
    const entries = isSelfOnly ? [] : await readEntries(deps, userId, { withData: wantsCards(request) });
    sendMultiStatus(res, [book, ...entries.map(cardResource)], request);
  };

  const report: DavHandler = async (req, res) => {
    const request = readQuestion(req, res, [
      DavRequestKind.SyncCollection,
      DavRequestKind.Multiget,
      DavRequestKind.Query,
    ]);
    await (request === null ? undefined : REPORT_ANSWERS[request.kind]?.(deps, res, request));
  };

  const propfindCard: DavHandler = async (req, res) => {
    const request = readQuestion(req, res, [DavRequestKind.Propfind]);
    if (request === null) {
      return;
    }
    const [entry] = await readEntries(deps, res.locals.userId, { uids: [uidOf(req)], withData: wantsCards(request) });
    if (entry === undefined) {
      res.status(HttpStatus.NotFound).send('No such card.');
      return;
    }
    sendMultiStatus(res, [cardResource(entry)], request);
  };

  const getCard: DavHandler = async (req, res) => {
    const [entry] = await readEntries(deps, res.locals.userId, { uids: [uidOf(req)], withData: true });
    if (entry === undefined || entry.vcard === null) {
      res.status(HttpStatus.NotFound).send('No such card.');
      return;
    }
    res.set('ETag', entry.etag).type(VCARD_CONTENT_TYPE).send(entry.vcard);
  };

  const put: DavHandler = async (req, res) => {
    const preconditions = readPreconditions(req.get('if-match'), req.get('if-none-match'));
    const body = typeof req.body === 'string' ? req.body : '';
    try {
      const outcome = await putCard(deps, res.locals.userId, uidOf(req), body, preconditions);
      // No ETag: the card is kept as Philotes holds a person, not byte for byte, so the client reads it back.
      res.status(WRITE_STATUS[outcome]).end();
    } catch (error) {
      if (isBadCard(error) === false) {
        throw error;
      }
      res.status(HttpStatus.Forbidden).type(XML_CONTENT_TYPE).send(preconditionError(DavPrecondition.ValidAddressData));
    }
  };

  const remove: DavHandler = async (req, res) => {
    const preconditions = readPreconditions(req.get('if-match'), undefined);
    const outcome = await deleteCard(deps, res.locals.userId, uidOf(req), preconditions);
    res.status(WRITE_STATUS[outcome]).end();
  };

  return {
    book: { [DavMethod.Propfind]: propfindBook, [DavMethod.Report]: report },
    card: {
      [DavMethod.Propfind]: propfindCard,
      [DavMethod.Get]: getCard,
      [DavMethod.Head]: getCard,
      [DavMethod.Put]: put,
      [DavMethod.Delete]: remove,
    },
  };
}

/**
 * Sends a request to the handler of its method. PROPFIND and REPORT are not methods a router has a
 * function for, so every resource takes all of them and picks here.
 *
 * @param handlers - The resource's handlers, by method.
 * @returns The route's handler, which answers 405 for a method the resource does not take.
 */
function dispatch(handlers: Partial<Record<DavMethod, DavHandler>>): RequestHandler {
  const allowed = [DavMethod.Options, ...Object.keys(handlers)].join(', ');
  return async (req, res) => {
    const handler = handlers[req.method as DavMethod];
    if (handler === undefined) {
      res.status(HttpStatus.MethodNotAllowed).set('Allow', allowed).end();
      return;
    }
    await handler(req, res as DavUserResponse);
  };
}

/**
 * Builds the CardDAV routes: one address book per user, holding one card per person.
 *
 * A client signs in with the user's email and an API key, finds the address book from the root, and
 * from then on asks what changed since the sync token it holds.
 *
 * @param deps - The database, the auth instance and the avatar store.
 * @returns The router, to mount at {@link DavPath.Mount}.
 */
export function createCardDavRouter(deps: CardDavDeps): Router {
  const { db, auth, avatarStore } = deps;
  const { book, card } = bookHandlers({ db, avatars: avatarStore });
  const xmlBody = express.text({ type: () => true, limit: CARDDAV_DEFAULTS.xmlBodyLimit });
  const cardBody = express.text({ type: () => true, limit: CARDDAV_DEFAULTS.cardBodyLimit });
  const allMethods = Object.values(DavMethod).join(', ');

  const router = Router();
  router.use((req, res, next) => {
    res.set('DAV', DAV_CAPABILITIES);
    // Answered before the guard: a client asks what the server can do before it signs in.
    if (req.method === DavMethod.Options) {
      res.set('Allow', allMethods).status(HttpStatus.Ok).end();
      return;
    }
    next();
  });
  router.use((req, res, next) => requireDavUser({ db, auth }, req, res, next));
  // After the guard, so that nobody unknown has a body read. A card may carry a picture; a question may not.
  router.use((req: Request, res: Response, next: NextFunction) => {
    const parse = req.method === DavMethod.Put ? cardBody : xmlBody;
    parse(req, res, next);
  });

  router.all(
    '/',
    dispatch({
      [DavMethod.Propfind]: propfindOf(({ email }) => ({
        self: rootResource(),
        children: [principalResource(email), homeResource()],
      })),
    }),
  );
  router.all(
    '/principal',
    dispatch({ [DavMethod.Propfind]: propfindOf(({ email }) => ({ self: principalResource(email), children: [] })) }),
  );
  router.all(
    '/addressbooks',
    dispatch({
      [DavMethod.Propfind]: propfindOf(async ({ userId }) => ({
        self: homeResource(),
        children: [bookResource(await bookRevision(db, userId))],
      })),
    }),
  );
  router.all('/addressbooks/contacts', dispatch(book));
  router.all(
    '/addressbooks/contacts/:name',
    (req, res, next) => {
      const isCard = uidOfName(String(req.params.name)) !== null;
      if (isCard) {
        next();
        return;
      }
      // Only cards live in the address book, so nothing else can be put there.
      const status = req.method === DavMethod.Put ? HttpStatus.Forbidden : HttpStatus.NotFound;
      res.status(status).send('Not a card.');
    },
    dispatch(card),
  );
  return router;
}
