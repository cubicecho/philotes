# Server

## Overview

The GraphQL API is an Apollo Server that auto-generates its schema and
resolvers directly from the Drizzle ORM schema via a vendored
`@vantreeseba/drizzle-graphql` library. There are no hand-written resolvers for standard
CRUD operations.

- **Entry point**: `server/src/index.ts`
- **Port**: `3001` (Vite dev server proxies `/graphql` → `http://localhost:3001`)
- **Protocol**: GraphQL over HTTP (Apollo Server standalone)

## Key Files

| File | Purpose |
| --- | --- |
| `server/src/index.ts` | Starts ApolloServer, injects `db` into context |
| `server/src/schema.ts` | Calls `buildSchema(db)` to auto-generate the full GraphQL schema |
| `@vantreeseba/drizzle-graphql` (npm package) | Local package that converts Drizzle schema → GraphQL schema + resolvers |
| `server/src/__generated__/schema.graphql` | Auto-generated SDL — do not edit manually |
| `server/src/__generated__/resolvers.ts` | Auto-generated resolver types — do not edit manually |

## How the Schema is Built

`server/src/schema.ts` calls `buildSchema` from the `@vantreeseba/drizzle-graphql` package:

```ts
import { db } from "@philotes/db";
import { buildSchema } from "@vantreeseba/drizzle-graphql";

const { schema: drizzleSchema, entities } = buildSchema(db, {
  prefixes: { insert: "create", update: "update", delete: "delete" },
  suffixes: { list: "s", single: "" },
});

export const schema = drizzleSchema;
export { entities };
```

For every Drizzle table this generates:

- A GraphQL **type** (e.g. `Person`, `Label`)
- **Query** fields: `person(...)`, `persons(...)` — single and list with filtering, ordering, pagination
- **Mutation** fields: `createPerson`, `createPersons`, `updatePersons`, `deletePersons`
- Filter input types, order-by types, update input types

## Generated Query/Mutation Naming

Given `suffixes: { list: "s", single: "" }` and `prefixes: { insert: "create", ... }`:

| Operation | Generated name |
| --- | --- |
| Single query | `person`, `label`, `importantDate` |
| List query | `persons`, `labels`, `importantDates` |
| Insert one | `createPerson` |
| Insert many | `createPersons` |
| Update | `updatePersons` |
| Delete | `deletePersons` |

## Context

Every resolver receives a `Context` object:

```ts
export interface Context {
  db: DB;
}
```

`DB` is the Drizzle instance type exported from `@philotes/db`. The context is
populated in `startStandaloneServer`:

```ts
context: async () => ({ db }),
```

## Adding Custom Resolvers

The auto-generated schema can be extended using `extendSchema` from `graphql`:

1. Parse an SDL extension with `parse(...)`.
2. Extend with `extendSchema(drizzleSchema, extensionSDL)`.
3. Get the type with `extendedSchema.getType("TypeName") as GraphQLObjectType`.
4. Set `field.resolve = async (parent, args, context) => { ... }`.
5. Export `extendedSchema` instead of `drizzleSchema`.

See the commented-out code in `server/src/schema.ts` for a reference example
of `attachLabelToPerson` / `detachLabelFromPerson`.

## Error Handling

Apollo Server catches thrown errors and converts them to GraphQL errors
automatically. Resolvers should throw or let errors propagate — do not
swallow them silently.

## Running the Server

```bash
npm run dev:server   # Watch mode (tsx watch)
npm run build:server # Compile to dist/
```

## GraphQL Codegen

After any change to the Drizzle schema (which changes the auto-generated
GraphQL schema), regenerate types:

```bash
npm run codegen          # Both app + server types
npm run codegen:server   # Server resolver types only
npm run codegen:app      # App client types only
```

Generated output:
- `server/src/__generated__/schema.graphql` — SDL snapshot
- `server/src/__generated__/resolvers.ts` — Typed resolver interfaces
- `app/src/__generated__/graphql.ts` — All GraphQL types for the client
- `app/src/__generated__/gql.ts` — `graphql()` tagged template helper
