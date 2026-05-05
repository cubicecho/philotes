# AGENTS.md — Philotes Personal CRM

## Project Overview

Philotes is an open-source personal CRM built with TypeScript. It uses a monorepo
structure (npm workspaces) with three packages: `app/` (frontend), `server/`
(GraphQL API), and `db/` (database schema and connection).

## Tech Stack

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Frontend | React 19, Vite, TanStack Router, Apollo Client    |
| UI       | Tailwind CSS, shadcn/ui components, Radix UI      |
| API      | Apollo Server, GraphQL                             |
| Database | Drizzle ORM, PGlite (embedded Postgres)            |
| Testing  | Vitest                                             |
| Linting  | Biome (formatter + linter)                         |
| Runtime  | Node.js 22+, ESM (`"type": "module"` throughout)  |

## Project Structure

```
philotes/
├── app/                     # Frontend (Vite + React)
│   ├── src/
│   │   ├── __generated__/   # Auto-generated GraphQL types (do not edit)
│   │   ├── components/
│   │   │   ├── ui/          # shadcn/ui primitives (Button, Input, Card, etc.)
│   │   │   ├── domain/      # Feature components (person/, label/)
│   │   │   └── layouts/     # Structural wrappers (FormListLayout)
│   │   ├── lib/             # Utilities (cn())
│   │   └── routes/          # TanStack Router file-based routes
│   ├── index.html
│   ├── vite.config.ts
│   └── tailwind.config.ts
├── server/                  # GraphQL API (Apollo Server)
│   └── src/
│       ├── index.ts         # Server entry point (port 3001)
│       ├── schema.ts        # Calls buildSchema(db) — no hand-written resolvers
│       ├── vendor/          # Vendored drizzle-graphql library
│       └── __tests__/       # Server tests
├── db/                      # Database layer (Drizzle ORM + PGlite)
│   └── src/
│       ├── schema.ts        # Drizzle table definitions + inferred type exports
│       ├── relations.ts     # Drizzle relation definitions
│       └── index.ts         # DB singleton + re-exports
├── docs/                    # Technical documentation for AI agents
│   ├── database.md          # DB schema, tables, migration workflow
│   ├── server.md            # Apollo Server, auto-generated GraphQL, codegen
│   ├── graphql.md           # Full GraphQL API reference (queries, mutations, types)
│   ├── frontend.md          # React app structure, routing, data fetching patterns
│   └── components.md        # Component inventory and patterns
├── vitest.config.ts
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

## Build / Dev / Lint / Test Commands

All commands run from the **project root**.

### Development
```bash
npm run dev              # Start both server and app concurrently
npm run dev:app          # Start only the Vite dev server (port 3000)
npm run dev:server       # Start only the Apollo Server (port 3001, with watch)
```

### Building
```bash
npm run build            # Build all workspaces (db → server → app)
npm run build:app        # Build only the frontend
npm run build:server     # Build only the server
```

### GraphQL Codegen
```bash
npm run codegen          # Generate types for both app and server
npm run codegen:app      # Generate client-side types (app/src/__generated__/)
npm run codegen:server   # Generate server resolver types (server/src/__generated__/)
```

> **Important:** Run `npm run codegen` after any change to the Drizzle schema
> (which rebuilds the GraphQL schema) or to GraphQL documents in `app/src/`
> (queries, mutations, fragments). The generated files in
> `app/src/__generated__/` and `server/src/__generated__/` must be up to date
> before running type checks, tests, or builds.

### Testing
```bash
npm test                 # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run test:ui          # Run tests with Vitest UI

# Run a single test file:
npx vitest run server/src/__tests__/resolvers.test.ts

# Run tests matching a name pattern:
npx vitest run -t "should create a person"
```

### Linting & Formatting (Biome)
```bash
npm run check            # Run codegen, then check:biome and check:types
npm run check:biome      # Run Biome linter + formatter check (all-in-one)
npm run check:fix        # Run Biome linter + formatter with auto-fix
npm run lint             # Run Biome linter only
npm run lint:fix         # Run Biome linter with auto-fix
npm run format           # Format all files with Biome
npm run format:check     # Check formatting without writing
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
- **Semicolons**: always
- **Quotes**: double quotes (`"`)
- **Indentation**: 2 spaces
- **Trailing commas**: all (including function params)
- **Line width**: 80 characters
- **Arrow parens**: always (`(x) => x`, not `x => x`)
- **Line endings**: LF

### Imports
- Use **`type` imports** for type-only imports — enforced by Biome rule
  `style/useImportType`:
  ```ts
  import type { Person } from "@philotes/db";   // correct
  import { type Person } from "@philotes/db";    // also acceptable
  import { Person } from "@philotes/db";         // ERROR if Person is only used as a type
  ```
- Use `@/` path alias for imports within `app/` (maps to `app/src/`):
  ```ts
  import { Button } from "@/components/ui/button";
  import { cn } from "@/lib/utils";
  ```
- Use `@philotes/db` package name when importing from `db/` in `server/`
- Use `.js` extensions in server/db imports (ESM requirement):
  ```ts
  import { schema } from "./schema.js";  // in server code
  ```

### TypeScript
- **Strict mode** enabled everywhere — no implicit `any`, strict null checks
- Prefix unused parameters with `_` (enforced by Biome):
  ```ts
  const handler = (_req: Request, res: Response) => { ... }
  ```
- Use `interface` for object shapes, `type` for unions/intersections/utilities
- Export types alongside runtime values from shared packages (`db/`)
- Use `unknown` over `any` — `suspicious/noExplicitAny` is a warning

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
- shadcn/ui components live in `app/src/components/ui/` — no app logic here
- Custom app components go in `app/src/components/domain/` or `components/layouts/`
- Routes are file-based via TanStack Router in `app/src/routes/`
- The root layout is in `app/src/routes/__root.tsx`
- Use Apollo Client hooks (`useQuery`, `useMutation`) for data fetching
- Always pass `refetchQueries` on mutations that modify lists
- See [`docs/frontend.md`](docs/frontend.md) and [`docs/components.md`](docs/components.md)

### GraphQL / Server
- The GraphQL schema is **auto-generated** from the Drizzle schema via the
  vendored `@vantreeseba/drizzle-graphql` library — there are no hand-written resolvers
- `server/src/schema.ts` calls `buildSchema(db)` and exports the result
- To add custom mutations/queries, extend the generated schema (see
  [`docs/server.md`](docs/server.md) for the extension pattern)
- Server runs on port **3001**; Vite proxies `/graphql` to it in development
- See [`docs/server.md`](docs/server.md) and [`docs/graphql.md`](docs/graphql.md)

### Database / Drizzle
- See [`docs/database.md`](docs/database.md) for full schema reference,
  column conventions, migration workflow, and table patterns
- Schema definitions in `db/src/schema.ts` using Drizzle's `pgTable`
- Relations defined in `db/src/relations.ts` using `defineRelations`
- `db/src/index.ts` is a **singleton** — it creates one PGlite instance at
  import time (not a factory). Use `DATABASE_URL` env var or falls back to
  `../pgdata`
- Uses PGlite (embedded Postgres via WASM) — no external DB server needed

### Error Handling
- Server resolvers let Apollo Server handle GraphQL errors naturally
- Frontend: use Apollo Client error states from `useQuery`/`useMutation`
- Never swallow errors silently — always surface them to the user or log them

### Testing
- Test files go in `__tests__/` directories adjacent to source, or as
  `*.test.ts` / `*.test.tsx` files
- Use in-memory PGlite (no `dataDir`) for database tests
- Tests use `describe`/`it`/`expect` from Vitest (globals enabled)
- Create fresh test contexts in `beforeEach` for isolation
