import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { HttpStatus } from '../core/wire.ts';
import { DavProp, DavRequestKind, NAMESPACES, NS_DAV, qualified } from './dav.ts';

/** A value in a response: text, or elements by their prefixed name. An empty string is an empty element. */
export type XmlNode = string | { [name: string]: XmlNode | XmlNode[] };

/** The properties one resource has. */
export type PropValues = Partial<Record<DavProp, XmlNode>>;

/** What a PROPFIND or REPORT body asks. */
export interface DavRequest {
  kind: DavRequestKind;
  /** The properties asked for, by local name, or null for every property. */
  props: string[] | null;
  /** The resources a multiget names. */
  hrefs: string[];
  /** The token a sync starts from, or null for a first sync. */
  syncToken: string | null;
}

/** One resource in a multi-status response. */
export interface DavResponse {
  href: string;
  /** The resource's properties. Left out for a resource that is gone. */
  props?: PropValues;
}

/** Thrown when a request body is not XML this server reads. */
export class DavSyntaxError extends Error {
  override name = 'DavSyntaxError';
}

const ATTRIBUTE_PREFIX = '@_';
const DECLARATION = { '?xml': { '@_version': '1.0', '@_encoding': 'utf-8' } };
/** The line a status element carries, by status. */
const STATUS_LINE: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.Ok]: 'HTTP/1.1 200 OK',
  [HttpStatus.NotFound]: 'HTTP/1.1 404 Not Found',
};
const KNOWN_PROPS = new Set<string>(Object.values(DavProp));
const KNOWN_KINDS = new Set<string>(Object.values(DavRequestKind));

// Prefixes are dropped: a client picks its own, and no two names this server reads differ only by namespace.
const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  parseTagValue: false,
  isArray: (name) => name === 'href',
});
const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: ATTRIBUTE_PREFIX,
  suppressEmptyNode: true,
});

/**
 * Narrows a parsed value to an element with children.
 *
 * @param value - What the parser made of an element.
 * @returns The element's children by name, or null for text or an empty element.
 */
function childrenOf(value: unknown): Record<string, unknown> | null {
  const isElement = typeof value === 'object' && value !== null && Array.isArray(value) === false;
  return isElement ? (value as Record<string, unknown>) : null;
}

/**
 * Reads a PROPFIND or REPORT body.
 *
 * @param body - The request body. Empty is a PROPFIND for every property, as the protocol says.
 * @returns What it asks.
 * @throws DavSyntaxError when the body is not XML, or asks something this server does not answer.
 */
export function readDavRequest(body: string): DavRequest {
  if (body.trim() === '') {
    return { kind: DavRequestKind.Propfind, props: null, hrefs: [], syncToken: null };
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(body);
  } catch {
    throw new DavSyntaxError('The request body is not XML.');
  }
  const kind = Object.keys(parsed).find((name) => KNOWN_KINDS.has(name)) as DavRequestKind | undefined;
  if (kind === undefined) {
    throw new DavSyntaxError('The request body asks for nothing this address book answers.');
  }
  const root = childrenOf(parsed[kind]) ?? {};
  const prop = childrenOf(root.prop);
  const hrefs = Array.isArray(root.href) ? root.href.filter((href) => typeof href === 'string') : [];
  const token = root['sync-token'];
  const hasToken = typeof token === 'string' && token.trim() !== '';
  return {
    kind,
    props: prop === null ? null : Object.keys(prop),
    hrefs,
    syncToken: hasToken ? token.trim() : null,
  };
}

/**
 * Picks out of a resource's properties the ones a request asked for.
 *
 * @param props - What the resource has.
 * @param requested - The names asked for, or null for all of them.
 * @returns The properties to send, and the names asked for that the resource does not have.
 */
function selectProps(props: PropValues, requested: string[] | null): { found: XmlNode; missing: XmlNode } {
  const found: Record<string, XmlNode> = {};
  const missing: Record<string, XmlNode> = {};
  const names = requested ?? Object.keys(props);
  for (const name of names) {
    // A name from another server's vocabulary has no namespace left to answer it in, so it is passed over.
    if (KNOWN_PROPS.has(name)) {
      const prop = name as DavProp;
      const value = props[prop];
      if (value === undefined) {
        missing[qualified(prop)] = '';
      } else {
        found[qualified(prop)] = value;
      }
    }
  }
  return { found, missing };
}

/**
 * Writes one resource of a multi-status body.
 *
 * @param response - The resource.
 * @param requested - The property names asked for, or null for all of them.
 * @returns The response element's children.
 */
function responseNode(response: DavResponse, requested: string[] | null): XmlNode {
  const href = { [`${NS_DAV}:href`]: response.href };
  if (response.props === undefined) {
    return { ...href, [`${NS_DAV}:status`]: STATUS_LINE[HttpStatus.NotFound] ?? '' };
  }
  const { found, missing } = selectProps(response.props, requested);
  const propstat = (prop: XmlNode, status: HttpStatus): XmlNode => ({
    [`${NS_DAV}:prop`]: prop,
    [`${NS_DAV}:status`]: STATUS_LINE[status] ?? '',
  });
  const hasMissing = Object.keys(missing).length > 0;
  const hasFound = Object.keys(found).length > 0;
  const parts = [
    ...(hasFound || hasMissing === false ? [propstat(found, HttpStatus.Ok)] : []),
    ...(hasMissing ? [propstat(missing, HttpStatus.NotFound)] : []),
  ];
  return { ...href, [`${NS_DAV}:propstat`]: parts };
}

/**
 * Declares every namespace on a root element.
 *
 * @returns The attributes.
 */
function namespaceAttributes(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(NAMESPACES).map(([prefix, uri]) => [`${ATTRIBUTE_PREFIX}xmlns:${prefix}`, uri]),
  );
}

/**
 * Writes a multi-status body.
 *
 * @param responses - The resources, in order.
 * @param requested - The property names asked for, or null for all of them.
 * @param syncToken - The address book's token, on the answer to a sync.
 * @returns The XML.
 */
export function multiStatus(responses: DavResponse[], requested: string[] | null, syncToken?: string): string {
  const token = syncToken === undefined ? {} : { [`${NS_DAV}:sync-token`]: syncToken };
  return builder.build({
    ...DECLARATION,
    [`${NS_DAV}:multistatus`]: {
      ...namespaceAttributes(),
      [`${NS_DAV}:response`]: responses.map((response) => responseNode(response, requested)),
      ...token,
    },
  });
}

/**
 * Writes the body that names a failed precondition.
 *
 * @param precondition - The precondition's prefixed name.
 * @returns The XML.
 */
export function preconditionError(precondition: string): string {
  return builder.build({
    ...DECLARATION,
    [`${NS_DAV}:error`]: { ...namespaceAttributes(), [precondition]: '' },
  });
}
