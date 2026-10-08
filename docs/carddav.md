# CardDAV

Philotes is a CardDAV server: a user's people are one address book that a
contacts app syncs in both directions. On Android that app is
[DAVx⁵](https://www.davx5.com/), which writes the people into the phone's own
contacts, so the dialer, caller ID and messaging see them.

The code is `server/src/carddav/`, mounted at `/dav` by `http/app.ts`. It is
plain Express, not GraphQL. Cards are read and written by `vcard/` (see
[`server.md`](server.md#vcard)), and what changed since a client last looked
comes from change tracking (see [`server.md`](server.md#change-tracking)).

## Setting up a client

| Field | Value |
| --- | --- |
| Base URL | `https://<host>/dav/` |
| User name | The account's email |
| Password | An API key (`phlt_…`), made in Settings → API Keys |

Settings → API Keys shows the first two with copy buttons. A client given only
the host finds the rest through `/.well-known/carddav`.

## Signing in

HTTP Basic, on every request but `OPTIONS`. The password is an API key, checked
by `auth.api.verifyApiKey`, the same call the iCal feed uses, so a sync shows as
the key's "last used" and revoking the key stops the phone. The user name must
be the email of the key's owner, compared without case: a key pasted into the
wrong account is refused. A session token or the account's password is not
accepted. Any failure is a `401` with a `WWW-Authenticate: Basic` challenge and
says nothing about which half was wrong.

Basic credentials cross the wire on each request. Serve Philotes over HTTPS
before pointing a phone at it from outside a private network.

## Resources

| Path | What it is |
| --- | --- |
| `/.well-known/carddav` | Redirects (`301`) to `/dav/` |
| `/dav/` | The root. Names the principal |
| `/dav/principal/` | The signed-in user. Names the address book home |
| `/dav/addressbooks/` | The home. Holds one address book |
| `/dav/addressbooks/contacts/` | The address book |
| `/dav/addressbooks/contacts/<uid>.vcf` | One person's card |

The paths carry no user id: who is asking decides whose book it is, so one
user's URL never reaches another's people.

A card's name is the person's `uid`, URL-encoded. The `UID` inside a card that
is `PUT` is replaced by the name it was put under, so a card is always found
again where the client left it.

## Methods

| Method | On | Does |
| --- | --- | --- |
| `OPTIONS` | anything | Answers `DAV: 1, 3, addressbook`. Not authenticated |
| `PROPFIND` | any resource | Properties, at `Depth: 0` or `1` |
| `REPORT` | the address book | `sync-collection`, `addressbook-multiget`, `addressbook-query` |
| `GET`, `HEAD` | a card | The vCard (3.0), with its `ETag` |
| `PUT` | a card | Creates (`201`) or replaces (`204`) the person |
| `DELETE` | a card | Deletes the person and everything kept about them |

Anything else is a `405` with an `Allow` header. There is no `MKCOL` and no
`PROPPATCH`: the one address book cannot be renamed, added to or removed.

## Tags and tokens

- A card's `ETag` is the person's `revision`, quoted. It moves whenever the
  person or any of their details is written, from anywhere.
- The address book's sync token is `urn:philotes:sync:<n>`, where `n` is the
  user's `personsRevision`. `getctag` is the same value.
- `sync-collection` with no token lists every card. With a token it lists the
  cards whose revision is past it, and the cards deleted since (from
  `person_tombstones`) as `404` responses. A token this server did not write is
  a `403` with `DAV:valid-sync-token`, on which a client starts again.
- `PUT` and `DELETE` honour `If-Match` and `If-None-Match: *`; a card that is
  not as the request says is a `412`.

## Writing a card

A `PUT` is saved in `SaveMode.Replace`, in one transaction: the person becomes
exactly what the card says. It passes the same zod schemas as a GraphQL write.
A body that is not one vCard, or a card that is refused, is a `403` with
`CARDDAV:valid-address-data`.

`PUT` answers without an `ETag`, because the stored card is not byte-for-byte
the one sent (the `UID` and `REV` are the server's). A client reads it back,
as the protocol tells it to.

## Limits and known gaps

- Not yet tried against DAVx⁵ or any other real client. The tests in
  `server/src/__tests__/carddav/` speak the protocol as the RFCs (4918, 6352,
  6578) describe it.
- `addressbook-query` returns every card whatever filter it carries, and
  `sync-collection` ignores `nresults`. A client filters what it gets.
- Replace means replace. A client that drops a property it does not
  understand deletes it here. The risk is the Apple-style `X-ABDATE` that
  carries a person's named dates; everything else Philotes does not map is
  kept in `vcard_extra` only as long as the client sends it back.
- Notes, interactions, tasks, gratitudes, relationships, how you met and the
  contact frequency are not in a card, so a phone can neither see nor change
  them. Deleting a contact on the phone does delete them.
- The hrefs in answers are absolute paths from the origin's root. Philotes
  served under a path prefix needs the proxy to keep `/dav` and
  `/.well-known/carddav` at the root.
- Request bodies are capped by `CARDDAV_DEFAULTS` (`server/src/core/defaults.ts`):
  1 MB of XML, 8 MB for a card with its picture.
