# AGENTS.md — Philotes Personal CRM

## Project Overview

Philotes is an open-source personal CRM built with TypeScript. It uses a monorepo
structure (npm workspaces) with three packages: `app/` (frontend), `server/`
(GraphQL API), and `db/` (database schema and connection).

## Tech Stack

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Frontend | React 19, Expo Router (web target), Apollo Client |
| UI       | React Native primitives, Tailwind 4 via NativeWind 5, [cubeui](https://github.com/cubicecho/cubeui) (native registry) |
| API      | Apollo Server 5 on Express, GraphQL              |
| Database | Drizzle ORM, PGlite (embedded Postgres)            |
| Testing  | Vitest                                             |
| Linting  | Biome (formatter + linter)                         |
| Runtime  | Node.js 26+, ESM (`"type": "module"` throughout)  |

## Project Structure

```
philotes/
├── app/                     # Frontend (Expo Router, web target)
│   ├── app/                 # File-based routes — the router reads THIS directory
│   │   ├── _layout.tsx      # Root layout (theme, ApolloProvider, Stack)
│   │   ├── login.tsx        # Unauthenticated routes live at the top level
│   │   └── (app)/           # Authenticated group (redirects to /login)
│   ├── src/
│   │   ├── __generated__/   # Generated GraphQL types (do not edit)
│   │   ├── components/
│   │   │   ├── ui/          # cubeui primitives, vendored (Button, Dialog, Input, …)
│   │   │   ├── *.tsx        # cubeui layout shells, vendored (PageLayout, Section, Sidebar, …)
│   │   │   ├── domain/      # Feature components (person/, label/, task/, …)
│   │   │   ├── layouts/     # The app shell (sidebar rail + phone bar)
│   │   │   └── settings/    # API keys, imports and exports
│   │   ├── hooks/           # useQueryStringState, useAvatarUpload
│   │   └── lib/             # auth, apollo, cn(), date type policies, relative time
│   ├── app.json             # Expo config
│   ├── components.json      # shadcn CLI config — points at the cubeui native registry
│   ├── global.css           # Imports cubeui-tokens.css (generated — do not edit)
│   └── metro.config.js      # Metro bundler config
├── server/                  # GraphQL API (Apollo Server 5 on Express)
│   ├── __generated__/       # Generated SDL + resolver types (do not edit)
│   └── src/
│       ├── index.ts         # Server entry point (port 3001)
│       ├── routes/          # graphql, avatars, ical
│       ├── schema.ts        # Calls buildSchema(db), then applies each extension
│       ├── tenancy.ts       # Row scope + server-owned columns, as buildSchema config
│       ├── resolvers/       # SDL extensions for what CRUD cannot express
│       └── __tests__/       # Server tests
├── db/                      # Database layer (Drizzle ORM + PGlite)
│   ├── drizzle/             # Generated migrations
│   └── src/
│       ├── models/          # One file per table — the actual definitions
│       ├── schema.ts        # Barrel re-exporting models/
│       ├── relations.ts     # defineRelations config (drives the GraphQL schema)
│       ├── api-keys.ts      # api_keys table (deliberately outside the GraphQL schema)
│       └── index.ts         # DB singleton + re-exports
├── docs/                    # Technical documentation for AI agents
├── vitest.config.ts         # Root config — runs every workspace's tests
├── biome.json               # Biome config (linter + formatter)
└── package.json             # Root workspace config
```

## Documentation Reference

Consult these docs before making changes to the corresponding area:

| Topic | Document |
| ----- | -------- |
| Database tables, migrations, Drizzle patterns | [`docs/database.md`](docs/database.md) |
| Apollo Server, schema generation, custom resolvers | [`docs/server.md`](docs/server.md) |
| GraphQL queries, mutations, types, filtering | [`docs/graphql.md`](docs/graphql.md) |
| React app, routing, Apollo Client, form pattern | [`docs/frontend.md`](docs/frontend.md) |
| UI primitives, domain components, layout pattern | [`docs/components.md`](docs/components.md) |
| Mutation-with-callback pattern for detail-view sub-components | [`docs/patterns.md`](docs/patterns.md) |
| Researched but not-yet-built features | [`docs/backlog.md`](docs/backlog.md) |
| Background research behind the product decisions | [`docs/research/`](docs/research/) |

## Build / Dev / Lint / Test Commands

All commands run from the **project root**.

### Development
```bash
npm run dev              # Start both server and app concurrently
npm run dev:app          # Start only the Expo dev server (port 3000)
npm run dev:server       # Start only the Apollo Server (port 3001, with watch)
```

### Building
```bash
npm run build            # Codegen, then the web export
npm run build:app        # Build only the frontend
```

### GraphQL Codegen
```bash
npm run codegen          # Generate types for both app and server
npm run codegen:app      # Generate client-side types (app/src/__generated__/)
npm run codegen:server   # Generate server resolver types (server/__generated__/)
```

> **Important:** Run `npm run codegen` after any change to the Drizzle schema
> or the `buildSchema` config (both change the GraphQL schema), or to GraphQL
> documents in `app/src/` and `app/app/` (queries, mutations, fragments). The
> generated files in `app/src/__generated__/` and `server/__generated__/` must
> be up to date before running type checks, tests, or builds.

### Testing
```bash
npm test                 # Run all tests once
npm run test:watch       # Run tests in watch mode

# Run a single test file:
npx vitest run server/src/__tests__/tenancy.test.ts

# Run tests matching a name pattern:
npx vitest run -t "covers every table in the schema"
```

### Linting & Formatting (Biome)
```bash
npm run check            # Run codegen, then check:biome and check:types
npm run check:biome      # Biome format, lint and import order, with fixes applied
npx biome ci .           # The same checks without writing (what CI should run)
npm run check:types      # Run tsc --noEmit across all packages (app, server, db)
```

### Database
```bash
npm run db:generate      # Generate Drizzle migration files
npm run db:migrate       # Run pending migrations
npm run db:push          # Push schema directly to DB (dev only)
npm run db:studio        # Open Drizzle Studio
```

### Git

Use merge instead of rebase when integrating remote changes:

```bash
git pull --no-rebase
```

Do not add `Co-Authored-By` trailers to commit messages.

### Worktrees

When working in a git worktree, run the following command to install dependencies
faster by preferring the local npm cache:

```bash
npm ci --prefer-offline --no-audit
```

## Code Style Guidelines

### Formatting (Biome)
Do not hand-format — run `npm run check:biome`. The settings, from `biome.json`:

- **Semicolons**: always
- **Quotes**: single quotes (`'`)
- **Indentation**: 2 spaces
- **Trailing commas**: all (including function params)
- **Line width**: 120 characters
- **Arrow parens**: always (`(x) => x`, not `x => x`)
- **Line endings**: LF
- **Import order**: sorted by Biome's `organizeImports` assist

### Imports
- Use **`type` imports** for type-only imports — enforced by Biome rule
  `style/useImportType`:
  ```ts
  import type { Person } from '@philotes/db';   // correct
  import { type Person } from '@philotes/db';   // also acceptable
  import { Person } from '@philotes/db';        // ERROR if Person is only used as a type
  ```
- Use `@/` path alias for imports within `app/` (maps to `app/src/`):
  ```ts
  import { Button } from '@/components/ui/button';
  import { cn } from '@/lib/utils';
  ```
- Use `@philotes/db` package name when importing from `db/` in `server/`
- Use **`.ts` extensions** in relative `server/` and `db/` imports. Node runs
  those packages directly, stripping the types itself, so the import
  specifier names the file that exists:
  ```ts
  import { schema } from './schema.ts';        // server/ and db/
  ```
  `app/` is bundled by Metro and omits the extension entirely:
  ```ts
  import { Button } from '@/components/ui/button';
  ```

### TypeScript
- **Strict mode** enabled everywhere — no implicit `any`, strict null checks
- Prefix unused parameters with `_` (enforced by Biome):
  ```ts
  const handler = (_req: Request, res: Response) => { ... }
  ```
- Use `interface` for object shapes, `type` for unions/intersections/utilities
- Export types alongside runtime values from shared packages (`db/`)
- Use `unknown` over `any` — `suspicious/noExplicitAny` is an error; an
  unavoidable one carries `// biome-ignore lint/suspicious/noExplicitAny: <reason>`
- Every package extends `tsconfig.base.json`. It sets `erasableSyntaxOnly`
  (no `enum`, `namespace` or parameter properties — Node has to be able to strip
  the types), `verbatimModuleSyntax`, `noUnusedLocals` and `noUnusedParameters`
- No non-null assertions (`value!`) — narrow the value instead
- Every `if`, `else` and loop body is a braced block on its own lines
- A logic check is negated by comparing with `false`, in a positively named
  const (`const isMissing = ids.has(id) === false;`), not with `!`. A null guard
  (`if (!value)`) may keep the `!`. `no-negation.grit` enforces it

### Naming Conventions
- **Files**: `kebab-case.ts` / `kebab-case.tsx`
- **Components**: `PascalCase` (function name and export)
- **Variables/functions**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `SCREAMING_SNAKE_CASE` for true constants, `camelCase` for
  config objects
- **Database columns**: `snake_case` in SQL, `camelCase` in Drizzle schema
  (Drizzle maps between them)
- **GraphQL**: `camelCase` for fields, `PascalCase` for types, `PascalCase`
  with `Input` suffix for input types

### React / Frontend
- Use **function components** exclusively (no class components)
- UI comes from **cubeui**, vendored with the shadcn CLI from its *native*
  registry: primitives in `app/src/components/ui/`, layout shells directly in
  `app/src/components/`. Do not hand-edit them — fix it upstream in
  `cubicecho/cubeui` and re-run `npx shadcn@latest add @cubeui/<item> --overwrite`
  from `app/`
- Custom app components go in `app/src/components/domain/`, `components/layouts/`
  or `components/settings/`
- Routes are file-based via **Expo Router** in `app/app/` — note that this is
  `app/app/`, not `app/src/`, which holds everything that is not a route.
  A directory in parentheses is a layout group: `(app)/` is the authenticated
  area, whose `_layout.tsx` redirects to `/login` when there is no token
- The root layout is `app/app/_layout.tsx`; the ApolloClient is built in
  `app/src/lib/apollo.ts`
- **Write React Native primitives, not DOM elements.** `View`, `Text`,
  `Pressable`, `ScrollView` and `Image` with Tailwind classes; `onPress`, not
  `onClick`. The web is the only target shipped today, through
  react-native-web, but nothing is written against the DOM. The rules that
  follow from that are in [`docs/frontend.md`](docs/frontend.md#react-native-rules)
- Icons come from `@/components/ui/icons` (cubeui's set) or
  `@/components/app-icons` (the app's extras) — never from `lucide-react` directly
- Use Apollo Client hooks (`useQuery`, `useMutation`) for data fetching
- Always pass `refetchQueries` on mutations that modify lists
- See [`docs/frontend.md`](docs/frontend.md) and [`docs/components.md`](docs/components.md)

### GraphQL / Server
- The GraphQL schema is **generated** from the Drizzle schema by
  `@vantreeseba/drizzle-graphql` — there are no hand-written CRUD resolvers
- `server/src/schema.ts` calls `buildSchema(db, ...)` and applies the extensions
- Multi-tenancy is **configuration, not resolver code**: `server/src/tenancy.ts`
  declares the row scope and the server-owned `userId`. Prefer adding to that
  config over overriding a generated resolver, which loses the scope, filter
  compilation and batching that come with it
- A new table needs a `scope` entry or it is visible across tenants —
  `server/src/__tests__/tenancy.test.ts` fails until it has one
- To add custom mutations/queries, extend the generated schema (see
  [`docs/server.md`](docs/server.md) for the extension pattern)
- Server runs on port **3001**; the app reaches it via `EXPO_PUBLIC_API_URL`
- See [`docs/server.md`](docs/server.md) and [`docs/graphql.md`](docs/graphql.md)

### Database / Drizzle
- See [`docs/database.md`](docs/database.md) for the table inventory, column
  conventions, tenancy rules, migration workflow, and table patterns. The
  model files themselves are the schema reference — do not trust a copy
- Table definitions live in `db/src/models/`, one file per table.
  `db/src/schema.ts` is only a barrel that re-exports them
- Relations defined in `db/src/relations.ts` using `defineRelations`. This
  config — not the table list — is what drizzle-graphql reads, so a table with
  no relations entry gets no relation fields in the API
- Nearly every table carries a `user_id`. A new one almost certainly needs it,
  plus a `scope` entry in `server/src/tenancy.ts` (see above)
- `db/src/index.ts` is a **singleton** — it creates one database connection at
  import time (not a factory). `DATABASE_URL` selects the driver: a
  `postgres://` URL uses postgres-js, anything else is a PGlite data directory,
  defaulting to `<repo>/pgdata`
- `@philotes/db` exports its TypeScript sources, which Node runs directly, so
  there is no build step between editing `db/src` and using it
- PGlite is embedded Postgres via WASM — no external DB server needed in dev

### Error Handling
- Server resolvers let Apollo Server handle GraphQL errors naturally. Throw a
  `GraphQLError` with an `extensions.code` when a client needs to branch on it
- Never let an error message reveal a row the caller is not allowed to see —
  report "not found" rather than "forbidden"
- Frontend: use Apollo Client error states from `useQuery`/`useMutation`. The
  root layout clears the token and redirects on an `UNAUTHENTICATED` code
- Never swallow errors silently — always surface them to the user or log them

### Testing
- Test files go in `__tests__/` directories adjacent to source, or as
  `*.test.ts` / `*.test.tsx` files. One root `vitest.config.ts` picks up every
  workspace, so run tests from the repo root
- Tests use `describe`/`it`/`expect` from Vitest (globals enabled)
- **Do not import `@philotes/db` from a test.** It opens a real PGlite instance
  against the repo's `pgdata` on import. Stub it with `vi.mock('@philotes/db')`
  and import table definitions from `db/src/schema.ts` directly when you need
  the real ones — see `server/src/__tests__/tenancy.test.ts`
- Prefer testing pure functions and configuration shape. Anything needing a
  live database should use its own throwaway `DATABASE_URL`
