# Server

## Overview

The GraphQL API is GraphQL Yoga on Express 5. Its schema and resolvers are
generated from the Drizzle schema by `@vantreeseba/drizzle-graphql`. There are
no hand-written resolvers for standard CRUD, and none for tenancy either — see
[Tenancy](#tenancy).

- **Entry point**: `server/src/index.ts`
- **Port**: `3000`
- **Protocol**: GraphQL over HTTP at `/graphql`
- **Auth**: better-auth (`server/src/auth/`), by bearer token: a password, an
  emailed link, `SECURE_LOCAL_NET`, or an OIDC provider (see [OIDC Sign-in](#oidc-sign-in))

## Layout

Code is grouped by subject, not by kind. A domain folder holds whatever that
subject needs, under the same file names everywhere:

| File | Holds |
| --- | --- |
| `<domain>/input.ts` | zod schemas for the rows the domain's tables accept |
| `<domain>/hooks.ts` | `onWrite` hooks: validation and foreign-key ownership for generated writes |
| `<domain>/resolvers.ts` | An `apply<Name>Extension(schema)` for queries and mutations that are not plain CRUD |

The folders are `persons`, `notes`, `gratitudes`, `interactions`, `tasks`,
`important-dates`, `labels`, `relationships`, `contact-import`, `vcard`,
`carddav`, `api-keys`, `users`, `auth` and `sso`. `persons` has a second extension file, `duplicates.ts`, for
`potentialDuplicates` and `mergePersons`, and `normalized-values.ts`, which
fills a contact info's `normalizedValue` on every write. `interactions` has
`log.ts`, which logs events read from a phone or a mailbox (see
[Logged interactions](#logged-interactions)). `users` holds the
caller's settings (`setDefaultCountry`). Three more hold what no domain owns:

| Folder | Holds |
| --- | --- |
| `core/` | `config.ts` (the only reader of `process.env`), `defaults.ts` (every tunable), `wire.ts` (HTTP statuses and unit conversions), `context.ts`, `errors.ts`, `validation.ts`, `preflight.ts` |
| `graphql/` | `build-schema.ts`, `schema.ts`, `tenancy.ts`, `write-guards.ts`, `operation-limits.ts`, `handler.ts` |
| `http/` | `app.ts` (`createApp`), `health.ts`, `static.ts`, `shutdown.ts`, `sso.ts` (the OIDC sign-in's start and callback) |

`server/__generated__/schema.graphql` and `server/__generated__/resolvers.ts`
are generated. Do not edit them.

## How the Schema is Built

`graphql/build-schema.ts` exports `createSchema(db)`. `graphql/schema.ts` binds
it to the app's database, and tests bind it to a throwaway one.

```ts
const { schema: generated, entities } = buildSchema(db, {
  prefixes: { insert: 'create', update: 'update', delete: 'delete' },
  typeNameMapper: 'singularize', // tasks → Task, task, createTask
  scope,          // graphql/tenancy.ts
  contextValues,  // graphql/tenancy.ts
  exclude,
  features,
  onWrite: WRITE_HOOKS, // every domain's hooks.ts
  onError: mapWriteError,
  limits: { defaultLimit, maxLimit },
  complexity: true,
  mapColumnType,
});
```

For every Drizzle table this generates a type, single and list queries,
aggregate and groupBy queries, create/update/delete mutations, and filter,
order-by and input types. See [graphql.md](./graphql.md#naming) for the names.
The hand-written extensions in `EXTENSIONS` are then applied in order.

## Tenancy

Row-level isolation is configuration on `buildSchema`, not resolver code. It
lives in `graphql/tenancy.ts`.

**`scope`** is a per-table predicate ANDed into the SQL of every read, update
and delete the library generates — lists, single rows, aggregates, groupBy,
relation fields and cursor pages alike — *after* the client's own `where`, so a
client filter can only narrow it:

- every table in `USER_OWNED_TABLES` carries `user_id` and scopes on it
  directly, junction tables included;
- `users` scopes to the caller's own row.

Each one calls `requireAuth`, so an unauthenticated request throws rather than
falling back to an unscoped query.

**`contextValues`** takes `userId` out of every create and update input and
stamps it from the request. Ownership is therefore unstatable rather than
merely overwritten.

**`exclude`** drops better-auth's tables (`sessions`, `accounts`,
`verifications`, `apikeys`) and the server's own `oidc_settings`, which holds a
client secret, from the schema entirely: not readable, not filterable. **`features`** removes the generated `users` mutations, since
accounts belong to the auth flow, and keeps nested writes off, since they
would bypass the child table's hooks.

A scope cannot reach a plain insert, and says nothing about the rows a foreign
key *points at*. The `onWrite` hooks close that half: `guardWrites` in
`graphql/write-guards.ts` checks every referenced id against the caller on
create and update. A hook runs inside the mutation's own transaction, so a
throw rolls the write back and there is no window between check and write. A
write naming a row the caller cannot see answers `NOT_FOUND`.

`server/src/__tests__/graphql/tenancy.test.ts` asserts that every table in the
schema has a scope entry and that every table with a `userId` column has a
`contextValues` entry, so a new table cannot be added unscoped.

## Validating Writes

Every generated write is parsed before it reaches the database. A domain's
`input.ts` holds one zod schema per table, `.partial()` because an update's
`set` carries only the changed columns, and its `hooks.ts` hands the schema to
`guardWrites` along with the foreign keys to check:

```ts
const PERSON: ForeignKey = { key: 'personId', entity: 'Person', parent: persons };

export const taskWriteHooks: OnWriteConfig = {
  tasks: guardWrites({ input: taskInput, foreignKeys: [PERSON] }),
};
```

A failed parse is `BAD_USER_INPUT` with every issue's message. Lengths come
from `core/defaults.ts`, and a closed set of values is checked against its
vocabulary from the db package (`z.enum(Recurrence, …)`). A table with no entry
in `WRITE_HOOKS` takes generated writes unchecked, so a new table needs one.

A hand-written resolver validates the same way, with `parseOrThrow(schema,
value)` from `core/validation.ts`.

## Change Tracking

Every write to a person, or to a detail their contact card carries, gives the
person the user's next revision (the columns are described in
[`database.md`](database.md#change-tracking)). `persons/revisions.ts` holds the
three calls, each made inside the transaction of the write:

| Call | When |
| --- | --- |
| `touchPersons(tx, userId, personIds)` | the person or a card detail changed |
| `touchNewPersons(tx, userId)` | after an insert of people |
| `buryPersons(tx, userId, personIds)` | before a delete of people; writes their tombstones |

The generated writes get this from `countingChanges(table, hooks)` in
`persons/revision-hooks.ts`, which wraps the hooks of every table in
`CARD_TABLES`: `persons`, `contactInfos`, `addresses`, `importantDates`,
`personLabels` and `labels` (a label's name is on the card of everyone who
wears it). It finds the people in the `before` hook, by compiling the write's
own `where` with drizzle-graphql's `extractFilters` and selecting the rows it
will reach, because an `after` hook's rows hold only the columns the client
selected ([drizzle-graphql#177](https://github.com/cubicecho/drizzle-graphql/issues/177)).
A `where` that reaches through a relation cannot be compiled there and falls
back to every row of the caller's in that table: more people re-synced than
needed, never fewer.

A hand-written write calls the helpers itself. `mergePersons`, `mergeLabelInto`,
`importGoogleContacts`, `saveCard` (`vcard/store.ts`) and the avatar routes do.

A new table that points at a person is either a card table (add it to
`CARD_TABLES` and wrap its hooks) or goes in `OFF_CARD_TABLES` with the reason
its writes leave the revision alone. `__tests__/persons/revisions.test.ts`
fails until it is one or the other, and until a card table has a tested insert,
update and delete.

## vCard

`vcard/` turns a person into a vCard and back. It has no route of its own: the
Settings import and export use it, and so does the CardDAV endpoint in
`carddav/`, which has a document of its own: [`carddav.md`](carddav.md).

| File | Holds |
| --- | --- |
| `card.ts` | `Card`: a person and their details as one plain value, with no ids. The vocabularies for property names, parameters and type words |
| `decode.ts` | `parseVCards(text)`: vCard 3.0 or 4.0 text to cards. Throws `VCardSyntaxError` when the text is not a vCard |
| `encode.ts` | `writeVCard(card)` and `writeVCards(cards)`: cards to vCard 3.0 text |
| `store.ts` | `readCards(db, userId)` and `saveCard(tx, userId, card, options)`: cards to and from the tables |
| `resolvers.ts` | `exportVCards` and `importVCards` |

The text is parsed and written by [`ical.js`](https://github.com/kewisch/ical.js);
`decode.ts` and `encode.ts` only map its jCard properties to and from a `Card`.

**What maps to what.** `N`, `NICKNAME`, `ORG` (organization, then department),
`TITLE` and `NOTE` (the person's `about`) are the person. `EMAIL`, `TEL`, `URL`,
`IMPP` and `X-SOCIALPROFILE` are contact infos; a `TEL` typed `fax` is a fax,
and any other type Philotes has is written as `X-PHILOTES-CONTACT`. `ADR` is an
address. `BDAY` and `ANNIVERSARY` are the important dates of those kinds, and
any other date on the card is an Apple-style `X-ABDATE` with its name as the
group's `X-ABLabel`. `CATEGORIES` are labels. `PHOTO` is the avatar. `UID` and
`REV` are the person's `uid` and `updatedAt`. Everything else on a card, with
the labels of its groups, is kept in `persons.vcard_extra` and written back
unchanged, so a phone's own fields survive a round trip.

Notes, interactions, tasks, gratitudes, relationships, how you met and the
contact frequency are Philotes' own and never leave in a card.

**A date without a year** is read from `--MMDD`, from `X-APPLE-OMIT-YEAR`, or
from the year 1604 that Apple writes, and is written the Apple way, which
Android reads too.

**A custom label** on a number or an address (`label` on the row) is a group
with an `X-ABLabel`, as Apple and Google write it. `FN` is written from the
name and read only when a card has no other name.

**Saving** has two modes. `SaveMode.Replace` makes the person exactly what the
card says, as a sync client expects: details missing from the card are deleted,
and a detail that did not change keeps its row. `SaveMode.Merge` only adds: an
empty field is filled, a new detail is added, and nothing the user wrote is
changed. A detail is the same one when its key matches: a contact info's type
and `normalizedValue`, an address's parts, a date's kind and name. A save that
changes nothing leaves the person's revision alone, so a re-sync of the same
card is free. A label the user does not have is created, in
`LABEL_DEFAULTS.importedColor`. A card is checked by the same zod schemas as a
GraphQL write, and a refused card is a `CardRejectedError` carrying the message.

`importVCards(vcf)` saves each card in a transaction of its own, in merge mode,
so one bad card does not lose the rest. It finds the person a card belongs to
by `UID`, then by its first email address, then by its first phone number
together with the same name; anyone else is new. `exportVCards` returns every
person as one file, without pictures, which would not fit in a GraphQL answer.

## Logged interactions

An interaction is typed in (`source: manual`) or logged from something read: a
phone's call log (`call-log`) or texts (`sms`), or a mailbox (`email`).
`logInteractions(db, userId, events)` in `interactions/log.ts` does the
logging for every source, and the `logInteractions` mutation is the phone's
door to it.

- **Matching is on the server.** Each event carries the other party's number
  or address as the source wrote it. The server normalizes it the way it
  normalizes a contact detail (`normalizeContactValue`, with the user's
  default country) and looks it up in `contact_infos.normalized_value`, among
  details of the source's kind: a number only matches a phone number. The
  normalization, the default country and the current contact details all live
  here, so the phone does not need a copy of any of them, and a background
  scan does not need the people list loaded.
- **An event that matches nobody is dropped.** Its number is in the request
  and nowhere else: not stored, not logged.
- **One interaction per event and person.** A number two people share (a
  household's landline) logs against both, and an email logs against each
  person it was with. The unique key is `(user_id, source, external_id,
  person_id)`; the insert is `ON CONFLICT DO NOTHING` on it, so a rescan, or
  an event sent twice in one call, writes nothing more. Typed-in interactions
  have a null `external_id`, which the key never counts as a repeat.
- `source` and `externalId` are server-owned columns (`contextValues` in
  `tenancy.ts`): the generated `createInteraction` writes `manual` and null,
  and no update can change either. `direction` and `durationSeconds` are
  ordinary columns, checked by `interactionInput`.
- The mutation takes at most `INTERACTION_DEFAULTS.maxLoggedPerCall` events, and
  only the phone's sources. The answer counts what was `logged`, what was
  `alreadyLogged` and what was `unmatched`.

## Operation Limits

A list returns `defaultPageSize` rows when the request passes no `limit`, and
refuses a `limit` above `maxPageSize`. `graphql/operation-limits.ts` refuses an
operation that nests too deep, uses too many aliases or costs more than
`maxCost`, where a list costs its page size times one row. `__typename` is
free, since Apollo Client adds it to every selection set. The numbers are
`OPERATION_LIMIT_DEFAULTS` in `core/defaults.ts`. A client that needs every row
pages through them — see `useAllRows` in [frontend.md](./frontend.md#data-fetching).

## Context

Every resolver receives the `Context` declared in `core/context.ts`: `db`,
`auth`, `limiter`, `ip`, `userId`, `headers` and `avatarStore` (null when the
server was built without one, as most tests are). `graphql/handler.ts` builds it
once per request, and `userId` is whatever better-auth resolves from the
request's session cookie or bearer token. A resolver that needs a user calls
`requireAuth(ctx)`, which throws `UNAUTHENTICATED`, and never reads `userId`
itself.

The iCal feed (`important-dates/ical.ts`), avatar uploads
(`persons/avatars.ts`) and the CardDAV address book (`carddav/`, under `/dav`)
are plain Express routes and authenticate on their own. The CardDAV routes are
mounted before `cors()`, which would otherwise answer their `OPTIONS` itself.

### Avatar storage

The avatar routes keep images through an `AvatarStore` (`persons/avatar-store.ts`:
`prepare`, `put`, `read`, `remove`) and never touch the filesystem themselves.
`index.ts` picks the store: `createS3AvatarStore` (`persons/avatar-store-s3.ts`)
when `S3_ENDPOINT` is set, otherwise `createDiskAvatarStore` on `AVATAR_DIR`. It
calls `prepare()` at boot, which makes the directory or the missing bucket.

The stored `avatarPath` is `/avatars/<name>` with either store. `GET /avatars/<name>`
checks the session, answers 404 unless one of the caller's people has that
picture, and streams the image from the store, so a bucket stays private. The
path is written by the upload route only; `persons/hooks.ts` refuses it in a
GraphQL write, or a user could point a person at someone else's file. `npm run storage:up` starts a MinIO for development.

The route tests run once per store. To run them against a real S3-compatible
store as well, set `TEST_S3_ENDPOINT`, `TEST_S3_ACCESS_KEY_ID` and
`TEST_S3_SECRET_ACCESS_KEY`; without them that run is left out.

## Adding Custom Resolvers

A resolver that is not plain CRUD goes in its domain's `resolvers.ts`, as one
`apply<Name>Extension(schema)` that `build-schema.ts` lists in `EXTENSIONS`:

1. Parse an SDL extension with `parse(...)`.
2. `const extended = extendSchema(schema, extensionSDL)`.
3. Get the type with `objectType(extended, 'Mutation')` from
   `graphql/object-type.ts`.
4. Set `field.resolve = async (parent, args, context) => { ... }`.
5. Return `extended`.

Prefer configuration over an override: a resolver written by hand does not get
the scope, filter compilation or batching the generated one has. See
`relationships/resolvers.ts` for a case that genuinely needs it.

A mutation that touches several tables runs in one `db.transaction` and checks
ownership itself before it writes. `mergePersons` in `persons/duplicates.ts`
is the fullest example: it moves every row a user recorded about one person to
another. **A new table with a person column has to be added to
`PERSON_OWNED_TABLES` or `PERSON_JUNCTIONS` there**, or a merge leaves its rows
on the person who was merged away.

## OIDC Sign-in

One OpenID Connect provider per instance, under better-auth's provider id
`oidc`, through its `genericOAuth` plugin (PKCE, state and nonce are
better-auth's). It comes from one of two places, and `effectiveOidc` in
`sso/settings.ts` is the only code that decides which:

1. `OIDC_ISSUER` + `OIDC_CLIENT_ID` in the environment. It wins, and the app
   cannot change it.
2. A pairing: the `oidc_settings` row, written when someone pastes a provider's
   setup URL (`<issuer>#setup=<initial access token>&name=<name>`).
   `sso/pairing.ts` checks the discovery document names the same issuer before
   the token goes anywhere, registers at its `registration_endpoint`
   (RFC 7591), and keeps the client. `unpairSso` deletes it there (RFC 7592) and
   forgets the row whatever the provider answers.

better-auth fixes its plugins at creation, so pairing builds a new instance.
`AuthHost` (`auth/auth-host.ts`) holds the current one; the GraphQL context,
CardDAV, `/ical` and `/avatars` all ask `authHost.current()` per request. The
host passes one session store to every instance it builds, so with
`SESSION_STORE=memory` a rebuild signs nobody out.

**Who may pair** (`sso/resolvers.ts`): anyone while there are no users, so the
person installing it can set sign-in up from the login page; only the admin
after. `users.isAdmin` is set by `claimFirstAdmin` in better-auth's
`databaseHooks.user.create`, which every way of making an account goes through;
the migration made the oldest existing user admin. Refusals are `FORBIDDEN`,
pairing twice is `CONFLICT`, and a provider's refusal is `BAD_USER_INPUT` (or
`TOO_MANY_REQUESTS`) with `extensions.reason` from `PairingFailure`.

**The browser legs** (`http/sso.ts`) are the only better-auth routes served over
HTTP: `GET /sso/oidc` starts (`signInSocial`, with its state cookie), and
`GET /api/auth/callback/oidc` is better-auth's callback. The callback's session
cookie is dropped; the browser lands on the app's `/auth/sso?token=…` with a
one-time token, and `verifyOneTimeToken` swaps it for a bearer session. A spent
or expired token is `BAD_USER_INPUT`, never `UNAUTHENTICATED`.

`SERVER_URL` is where those routes live, and the redirect URI is
`<SERVER_URL>/api/auth/callback/oidc`. It defaults to `APP_URL` in production
and `http://localhost:PORT` in development, where the app is on the Expo port.

## Error Handling

Yoga masks any error that is not a `GraphQLError`, and `graphql/logger.ts` logs
the real cause. Resolvers throw or let errors propagate — do not swallow them.
Use the helpers in `core/errors.ts` (`badInput`, `notFound`, `requireAuth`) so
a client can branch on `extensions.code`, and keep the message free of anything
about rows the caller cannot see: report "not found" rather than "forbidden".

## Running the Server

```bash
npm run db:up        # Postgres in Docker on port 5439
npm run dev:server   # Watch mode
```

The server applies pending migrations at boot.

## GraphQL Codegen

After any change to the Drizzle schema or to the `buildSchema` config,
regenerate:

```bash
npm run codegen          # Both app + server types
npm run codegen:server   # Rewrites the SDL snapshot, then resolver types
npm run codegen:app      # App client types only
```

Generated output:
- `server/__generated__/schema.graphql` — SDL snapshot
- `server/__generated__/resolvers.ts` — Typed resolver interfaces
- `app/src/__generated__/graphql.ts` — All GraphQL types for the client
- `app/src/__generated__/gql.ts` — `graphql()` tagged template helper
