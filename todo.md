# Multi-Tenant Plan

## Overview

Each tenant = one user. Persons are a shared global registry. Everything a
user *creates or tracks* about a person is private to that user.

---

## Conceptual Model

```
users (new)
  └── user_persons (new — "I track this person" + my personal context)
        └── persons (shared — identity only: name, email)

notes          ─┐
activities      │
interactions    │  all get userId added → only visible to owner
tasks           │
labels          │
personLabels    │
importantDates  │
personRelations─┘

addresses     ─┐  user-specific: different users may have different
contactInfos  ─┘  contact details on file for the same person
```

---

## Phase 1: Database Schema

### 1.1 Add `users` table
New file `db/src/models/users.ts`:
- `id` uuid PK
- `email` text unique not null
- `name` text not null
- `passwordHash` text not null
- `createdAt` / `updatedAt` timestamps

### 1.2 Add `user_persons` table
New file `db/src/models/user-persons.ts`.  
This is both the "I track this person" claim and the home for fields that
are personal context (not global facts):
- `userId` uuid FK → users.id (ON DELETE CASCADE) — part of composite PK
- `personId` uuid FK → persons.id (ON DELETE CASCADE) — part of composite PK
- `contactFrequency` (moved from `persons`)
- `howWeMet` (moved from `persons`)
- `firstMetDate` (moved from `persons`)
- `avatarPath` (moved from `persons`)
- `createdAt`

### 1.3 Slim down `persons`
Remove from `persons`: `contactFrequency`, `howWeMet`, `firstMetDate`,
`avatarPath`. Keep: `id`, `firstName`, `lastName`, `email`, `createdAt`,
`updatedAt`. The email uniqueness constraint stays — persons are a global
registry and email is the dedup key.

### 1.4 Add `userId` to all user-owned tables
Add `userId uuid NOT NULL FK → users.id` to each of:
- `notes`
- `activities`
- `interactions`
- `tasks`
- `labels`
- `importantDates`
- `personRelationships`
- `addresses`
- `contactInfos`

For `personLabels`: change the composite PK to `(personId, labelId, userId)`
and add `userId FK → users.id`. This way two users can independently tag the
same person with labels from their own label sets.

> **Tradeoff — addresses / contactInfos:** These could be shared facts about
> a person (one canonical phone number). We're making them user-specific
> because different users may have different/outdated info, and it avoids the
> surprising UX of one user's edit changing another user's view. Revisit if
> "verified shared contact info" becomes a feature request.

### 1.5 Generate and run migrations
```
npm run db:generate
npm run db:migrate
```
Update `db/src/relations.ts` to reflect all new FKs and the `user_persons`
join table.

---

## Phase 2: Auth Layer

### 2.1 Install dependencies
In `server/`:
- `bcryptjs` + `@types/bcryptjs`
- `jsonwebtoken` + `@types/jsonwebtoken`

### 2.2 Add `register` and `login` mutations
New file `server/src/resolvers/auth.ts` following the existing extension
pattern (`applyAuthExtension`):

```graphql
type AuthPayload {
  token: String!
  userId: ID!
}

extend type Mutation {
  register(email: String!, name: String!, password: String!): AuthPayload!
  login(email: String!, password: String!): AuthPayload!
}
```

- `register`: bcrypt-hash password, insert user, return JWT
- `login`: look up user by email, bcrypt-compare, return JWT
- JWT payload: `{ userId }`, signed with `JWT_SECRET` env var, expires in 30 days

### 2.3 Inject `userId` into GraphQL context
Update `server/src/routes/graphql.ts`:

```ts
export interface Context {
  db: DB;
  userId: string | null;
}
```

In the `context` function, read `Authorization: Bearer <token>` from the
request headers, verify the JWT, and set `userId`. Unauthenticated requests
get `userId: null` (public queries like `login`/`register` still work).

### 2.4 Add a `requireAuth` helper
Small utility in `server/src/resolvers/auth.ts`:
```ts
function requireAuth(ctx: Context): string {
  if (!ctx.userId) throw new GraphQLError("Unauthenticated", { ... });
  return ctx.userId;
}
```
All user-scoped resolvers call this first.

---

## Phase 3: Resolver Enforcement

This is the bulk of the work. `drizzle-graphql` auto-generates resolvers that
are unaware of `userId`. We override them with custom extensions.

### 3.1 Create a `withUser` query helper
New file `server/src/resolvers/user-scope.ts`:
A small wrapper that appends `eq(table.userId, userId)` to any drizzle `where`
clause. Keeps the per-table extension files thin.

### 3.2 Write custom extensions for user-scoped tables
One file per table, following the existing `applyXxxExtension` pattern.
Each extension:
- Replaces the auto-generated list/single queries with versions that filter
  `WHERE userId = ?`
- Replaces create mutations to inject `userId` from context (caller cannot
  override it)
- Replaces update/delete mutations to add `AND userId = ?` so users can only
  touch their own rows

Tables needing extensions:
- `notes` (+ noteTags, noteMentions — inherit via note ownership)
- `activities` (+ activityTags)
- `interactions` (+ interactionTags)
- `tasks`
- `labels` (+ personLabels — label queries scoped to userId)
- `importantDates` (+ importantDateTags)
- `personRelationships`
- `addresses`
- `contactInfos`

### 3.3 Update the `persons` resolver
Persons are shared but a user only sees persons they've added to their CRM
(i.e., have a `user_persons` row for). The `persons` list query becomes:
```sql
SELECT p.* FROM persons p
JOIN user_persons up ON up.person_id = p.id
WHERE up.user_id = ?
```
Single `person` query adds the same join as an existence check.

### 3.4 Add `user_persons` resolvers
- `addPersonToMyContacts(personId)` — creates a `user_persons` row
- `updateMyPersonContext(personId, { contactFrequency, howWeMet, ... })` — updates user-specific fields
- `removePersonFromMyContacts(personId)` — deletes the `user_persons` row

---

## Phase 4: Frontend

### 4.1 Add Apollo auth link
In the Apollo Client setup, add an `authLink` that reads the JWT from
`localStorage` and sends it as `Authorization: Bearer <token>`.

### 4.2 Login / Register pages
New routes:
- `/login` — email + password form, calls `login` mutation, stores token
- `/register` — email + name + password form, calls `register` mutation

### 4.3 Auth gate
In `__root.tsx`, check for a JWT. If absent, redirect to `/login`. On 401
GraphQL errors, clear the token and redirect to `/login`.

### 4.4 Update person detail / create pages
- Person create: after creating the person, auto-create the `user_persons` row
- Person detail: show the `user_persons` fields (contactFrequency, howWeMet,
  etc.) in a separate "My context" section, editable independently of the
  shared person identity fields

### 4.5 Run codegen
```
npm run codegen
```
After all schema and resolver changes are done.

---

## What Stays the Same

- `persons` remains the dedup key (email unique). If user A adds
  `alice@example.com` and user B adds `alice@example.com` later, they both
  point at the same person row but each have their own `user_persons` context
  and their own notes/interactions/etc.
- The existing `drizzle-graphql` auto-generation still builds the base schema.
  Custom extensions layer on top, same as today.
- PGlite stays as-is — no changes to the DB engine.
- The existing extension pattern (`applyXxxExtension`) is reused throughout.

---

## Decisions

1. **No global person search** — users only see persons they have added to their
   contacts. There is no cross-user discovery.

2. **Email is not a dedup key** — the unique constraint on `persons.email` has
   been dropped. Multiple persons with the same email are allowed. Dedup will be
   handled separately in the future.

3. **No existing-data migration** — any rows without a `userId` should be
   deleted. The DB starts fresh with the multi-tenant schema.

4. **`merged` count in importGoogleContacts** — always returns 0 now that dedup
   is removed. The field is kept in the response type for API compatibility.
