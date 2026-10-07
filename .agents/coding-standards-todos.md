# Coding standards ledger

Findings from bringing philotes in line with the `coding-standards`, `cubicecho_typescript`,
`cubicecho_frontend` and `cubicecho_backend` skills. IDs are stable — don't renumber when
items are removed. `(unverified)` marks items inferred from docs or naming rather than
confirmed in code. Nothing here is implemented until approved.

## Summary

| Prefix | Kind |
|---|---|
| `R` | Refactor: same behavior, better shape |
| `F` | Feature: new behavior |
| `T` | Test work |
| `D` | Comment or doc that no longer matches the code |
| `B` | Bug, or near copies that behave differently |
| `A` | Public API change; needs a decision |

| ID | Kind | What it does | Buys | Needs | Status |
|---|---|---|---|---|---|
| B1 | Bug | Stops the server logging the sign-in link in every environment, which needs a mailer first because production sign-in reads that log line | No credentials in logs | A2 | declined |
| B2 | Bug | Makes revoking an API key answer "not found" for a key that belongs to someone else, as every other resolver does | Does not reveal which key ids exist | — | done |
| B3 | Bug | Checks who is uploading an avatar, and that the person is in their list, before the file is written; stores it under a random name with the extension of its type. Reading stays open by unguessable name until A2, because an image request cannot carry a bearer token | Closes an unauthenticated write, and one user overwriting another's picture | — | done |
| B11 | Bug | Shows uploaded avatars: the app prefixed `/avatars/` to a path that already starts with it, so no upload ever displayed | Avatars display | B3 | done |
| B4 | Bug | Stops contact import returning raw database error text, and scopes its duplicate check to the importing user | No schema details in responses; no cross-user dedupe | — | done |
| B5 | Bug | Keeps the owner on the person-label rows that merging two labels re-inserts | Merge does not fail on the NOT NULL owner column | — | done |
| B6 | Refactor [reuse] | Chooses the migrator by `DATABASE_URL` in one function in the db package, used by the server, the `migrate` script and the tests. Not a bug after all: on drizzle-orm 1.0.0-rc.4 the PGlite migrator also applied all 18 tables to a real Postgres 17, so the server only worked by the two migrators sharing an implementation | The server no longer depends on that accident | — | done |
| B7 | Bug | Makes the avatar upload in the app check the response and use the configured API URL | A failed upload is reported, and works off-origin | B3 | done |
| B8 | Bug | Refetches the lists that import, person delete, label merge and label delete change | No stale rows after a mutation | — | approved |
| B9 | Bug | Shows loading and error states in the API key and export cards, which today show "empty" while loading | Honest states | — | approved |
| F1 | Feature | Asks for confirmation before each of the seven one-click deletes | No accidental data loss | — | approved |
| A1 | API change | Moves the server to graphql-yoga on Express 5 with `createApp(deps)`, the `core/ http/ graphql/ auth/` layout, `/healthz`, graceful shutdown, body cap and operation limits | The cubicecho backend shape; injection replaces `vi.mock` of own modules | — | approved |
| A2 | API change | Replaces the hand-rolled JWT magic link and API keys with better-auth, and puts `/avatars` behind the session cookie; every user signs in again and existing API keys stop working | One audited auth stack, with rate limiting | A1 | approved |
| A3 | API change | Makes Postgres the only production database (PGlite for tests), loads the db package from source, and adds `waitForDatabase`; a deployment now needs a Postgres | Production runs what CI tests | A1 | approved |
| A4 | API change | Moves to drizzle-graphql 13 with `nestedWrites: false`, list bounds and complexity limits; unbounded list queries get a default page size | Bounded queries | A1 | approved |
| A5 | API change | Rewrites the Dockerfile, compose files, CI (`postgres` and `boot` jobs) and release (GHCR) to the standard, on port 3000 as a non-root user | Standard deployment; image published without Docker Hub secrets | A1, A3 | approved |
| R1 | Refactor [pattern] | Introduces an `ErrorCode` vocabulary and one `errorMessage`, with zod validating resolver input | One error contract | A1 | approved |
| R2 | Refactor [consistency] | Brings the tables to the conventions: timestamps with time zone, `createdAt`/`updatedAt`, indexed foreign keys, named unique constraints | Standard schema; needs a migration | A3 | approved |
| R3 | Refactor [sweep] | P16/P22: a `defaults.ts` per package and `as const` vocabularies for contact type, recurrence, channel and import stage | Clears most of the 118 magic-number warnings | — | approved |
| R4 | Refactor [sweep] | P4: a doc block with `@param` and `@returns` on the 188 functions without one, and the tags on 28 more | Documented code | — | approved |
| R5 | Refactor [sweep] | P5/P19: removes 220 divider-comment lines and shortens 15 long comment runs | Less noise | — | approved |
| R6 | Refactor [sweep] | P1: names about 228 unnamed conditions before they are tested | Conditions read as English | — | approved |
| R7 | Refactor [sweep] | P17: removes the type assertions that narrowing or a better type makes unnecessary (103, of which 28 `as any`) | Types that are checked | — | approved |
| R8 | Refactor [sweep] | P24: turns 7 nested ternaries and the closed-set chains into lookup tables | A new member cannot fall through | R3 | approved |
| R9 | Refactor [reuse] | One home each for the duplicated date, relative-time, name-colour, truncation and full-name helpers, and for `ChannelIcon` | One copy to fix | B10 | approved |
| B10 | Bug | The two `ChannelIcon` copies differ (one lacks "video"), and the two `nameToColor` copies give different colours for the same name | Same person, same colour | — | approved |
| R10 | Refactor [consistency] | Renames off-vocabulary props (`onClickAdd`, `active`, `subtitle`, `emptyMessage`, `viewAllHref`) to the cubeui vocabulary | One prop vocabulary | — | approved |
| R11 | Refactor [reuse] | Uses `ListItem`, `ToggleChip`, `Empty` and `text-info` where rows, chips, empties and links are hand-rolled, and `as="nav"` on the sidebar | cubeui primitives instead of copies | — | approved |
| R12 | Refactor [consistency] | Moves the five settings files from raw `gql` and hand-written types to the generated `graphql()` documents | Typed operations | — | approved |
| R13 | Refactor [reuse] | Merges the three near-identical tag components into one | One component | — | approved |
| R14 | Refactor [sweep] | Replaces the 82 shadcn alias classes with cubeui tokens, and updates the docs that allow the aliases | Token colours only | — | approved |
| R15 | Refactor [simplify] | Splits the oversized files, starting with the 792-line person page | Files a reader can hold | R4–R6 | approved |
| T1 | Test | Sets up Storybook with `play` stories as the UI tests | UI tests | — | declined |
| F2 | Feature | Guards the 18 form dialogs against discarding unsaved changes; needs `hasUnsavedChanges` on cubeui's `FormDialog` first | No lost edits | upstream | open |
| A6 | API change | TypeScript 7 | Standard toolchain | — | open |

Status is `open`, `approved`, `declined` or `done`.

## Conventions

- Missing lookups and failures throw a `GraphQLError`; a row that belongs to another user is "not found", never "forbidden"
- Multi-tenancy is configuration in `server/src/tenancy.ts`, not resolver code
- Vendored cubeui (`app/src/components/ui/`, the shells in `app/src/components/`, `app/src/lib/{utils,format,color,cubeui-theme,readable-text-color}.ts`) is not edited here; fix it upstream
- App components take no `children`; content goes in `*Slot` props typed `SlotNode`
- Generated files and the command that rebuilds them: `server/__generated__/`, `app/src/__generated__/` → `npm run codegen`; `db/dist/` → `npm run build -w db`
- Tests live in `server/src/__tests__/`, run with `npm test`
- P21 (import style) is overridden by AGENTS.md: `app/` uses the `@/` alias without extensions

## Order

1. Bugs B2–B6 on the current server, each with a test.
2. App work that does not depend on the server shape: B7–B10, F1, R9–R14.
3. Backend migration A1 → A3 → A4 → A2 → A5, with R1 and R2 inside it.
4. Sweeps R3–R8 and R15 last, so they run over the code that stays.
