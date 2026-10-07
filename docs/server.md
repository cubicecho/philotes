# Server

## Overview

The GraphQL API is GraphQL Yoga on Express 5. Its schema and resolvers are
generated from the Drizzle schema by `@vantreeseba/drizzle-graphql`. There are
no hand-written resolvers for standard CRUD, and none for tenancy either — see
[Tenancy](#tenancy).

- **Entry point**: `server/src/index.ts`
- **Port**: `3000`
- **Protocol**: GraphQL over HTTP at `/graphql`
- **Auth**: better-auth (`server/src/auth/`), by session cookie or bearer token

## Layout

Code is grouped by subject, not by kind. A domain folder holds whatever that
subject needs, under the same file names everywhere:

| File | Holds |
| --- | --- |
| `<domain>/input.ts` | zod schemas for the rows the domain's tables accept |
| `<domain>/hooks.ts` | `onWrite` hooks: validation and foreign-key ownership for generated writes |
| `<domain>/resolvers.ts` | An `apply<Name>Extension(schema)` for queries and mutations that are not plain CRUD |

The folders are `persons`, `notes`, `gratitudes`, `interactions`, `tasks`,
`important-dates`, `labels`, `relationships`, `contact-import`, `api-keys` and
`auth`. `persons` has a second extension file, `duplicates.ts`, for
`potentialDuplicates` and `mergePersons`. Three more hold what no domain owns:

| Folder | Holds |
| --- | --- |
| `core/` | `config.ts` (the only reader of `process.env`), `defaults.ts` (every tunable), `wire.ts` (HTTP statuses and unit conversions), `context.ts`, `errors.ts`, `validation.ts`, `preflight.ts` |
| `graphql/` | `build-schema.ts`, `schema.ts`, `tenancy.ts`, `write-guards.ts`, `operation-limits.ts`, `handler.ts` |
| `http/` | `app.ts` (`createApp`), `health.ts`, `static.ts`, `shutdown.ts` |

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
`verifications`, `apikeys`) from the schema entirely: not readable, not
filterable. **`features`** removes the generated `users` mutations, since
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

## Operation Limits

A list returns `defaultPageSize` rows when the request passes no `limit`, and
refuses a `limit` above `maxPageSize`. `graphql/operation-limits.ts` refuses an
operation that nests too deep, uses too many aliases or costs more than
`maxCost`, where a list costs its page size times one row. The numbers are
`OPERATION_LIMIT_DEFAULTS` in `core/defaults.ts`. A client that needs every row
pages through them — see `useAllRows` in [frontend.md](./frontend.md#data-fetching).

## Context

Every resolver receives the `Context` declared in `core/context.ts`: `db`,
`auth`, `limiter`, `ip`, `userId` and `headers`. `graphql/handler.ts` builds it
once per request, and `userId` is whatever better-auth resolves from the
request's session cookie or bearer token. A resolver that needs a user calls
`requireAuth(ctx)`, which throws `UNAUTHENTICATED`, and never reads `userId`
itself.

The iCal feed (`important-dates/ical.ts`) and avatar uploads
(`persons/avatars.ts`) are plain Express routes and authenticate on their own.

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
