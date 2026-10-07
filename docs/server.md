# Server

## Overview

The GraphQL API is an Apollo Server whose schema and resolvers are generated
from the Drizzle ORM schema by `@vantreeseba/drizzle-graphql`. There are no
hand-written resolvers for standard CRUD, and none for tenancy either — see
[Tenancy](#tenancy).

- **Entry point**: `server/src/index.ts`
- **Port**: `3001`
- **Protocol**: GraphQL over HTTP (Apollo Server 5 on Express)

## Key Files

| File | Purpose |
| --- | --- |
| `server/src/index.ts` | Starts Express + ApolloServer |
| `server/src/routes/graphql.ts` | Mounts `/graphql`, builds the per-request `Context` |
| `server/src/schema.ts` | Calls `buildSchema`, then applies each SDL extension |
| `server/src/tenancy.ts` | Row scope, server-owned columns, schema exclusions |
| `server/src/resolvers/` | The extensions: auth, api keys, imports, relationships, upcoming dates, merge labels, per-user person context, junction FK ownership |
| `server/__generated__/schema.graphql` | Generated SDL — do not edit manually |
| `server/__generated__/resolvers.ts` | Generated resolver types — do not edit manually |

## How the Schema is Built

```ts
const { schema: drizzleSchema, entities } = buildSchema(db, {
  prefixes: { insert: "create", update: "update", delete: "delete" },
  // Table keys are plural (`tasks`); derive the singular for type and
  // single-row names (Task, task, createTask).
  typeNameMapper: "singularize",
  scope,          // from tenancy.ts
  contextValues,
  exclude,
  features,
  onWrite,        // from resolvers/junction-ownership.ts
});
```

For every Drizzle table this generates a type, single and list queries,
aggregate and groupBy queries, create/update/delete mutations, and filter,
order-by and input types. See [graphql.md](./graphql.md#naming) for the names.

## Tenancy

Row-level isolation is configuration on `buildSchema`, not resolver code.

**`scope`** is a per-table predicate ANDed into the SQL of every read, update
and delete the library generates — lists, single rows, aggregates, groupBy,
relation fields and cursor pages alike — *after* the client's own `where`, so a
client filter can only narrow it:

- most tables carry `user_id` and scope on it directly;
- `users` scopes to the caller's own row;
- `persons` are shared, and scope through `user_persons` with a relation
  filter;
- junction tables carry no `user_id` and scope through their parent, compiling
  to `fk IN (SELECT id FROM parent WHERE user_id = $1)`.

Each one calls `requireAuth`, so an unauthenticated request throws rather than
falling back to an unscoped query.

**`contextValues`** takes `userId` out of every create and update input and
stamps it from the request. Ownership is therefore unstatable rather than
merely overwritten.

**`exclude`** drops `passwordHash` from the schema entirely — not readable,
not filterable. **`features`** removes generated `users` mutations; accounts
belong to the magic-link flow.

A scope cannot reach a plain insert, and says nothing about the rows a foreign
key *points at*. `resolvers/junction-ownership.ts` closes that half with
`onWrite` hooks that check every referenced id against the caller on create
and update. They run inside the mutation's own transaction, so a throw rolls
the write back and there is no window between check and write.

`server/src/__tests__/tenancy.test.ts` asserts that every table in the schema
has a scope entry and that every table with a `userId` column has a
`contextValues` entry, so a new table cannot be added unscoped.

## Context

Every resolver receives:

```ts
export interface Context {
  db: DB;
  userId: string | null;
}
```

`userId` comes from the request's `Bearer` token in `routes/graphql.ts`
(the iCal feed at `routes/ical.ts` authenticates separately, by API key). Resolvers that require a user call `requireAuth(ctx)`,
which throws an `Unauthenticated` `GraphQLError`.

## Adding Custom Resolvers

Extensions live in `server/src/resolvers/` and each export one
`apply<Name>Extension(schema)` that `schema.ts` chains:

1. Parse an SDL extension with `parse(...)`.
2. `const extended = extendSchema(schema, extensionSDL)`.
3. Get the type with `extended.getType("TypeName") as GraphQLObjectType`.
4. Set `field.resolve = async (parent, args, context) => { ... }`.
5. Return `extended`.

Prefer configuration over an override: a resolver written by hand does not get
the scope, filter compilation or batching the generated one has. See
`resolvers/user-scope.ts` for the two cases that genuinely need it.

## Error Handling

Apollo Server converts thrown errors to GraphQL errors. Resolvers should throw
or let errors propagate — do not swallow them silently. Use `GraphQLError` with
an `extensions.code` for errors a client should branch on, and keep the message
free of anything about rows the caller cannot see.

## Running the Server

```bash
npm run dev:server   # Watch mode
```

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
