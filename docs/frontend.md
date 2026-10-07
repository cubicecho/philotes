# Frontend

## Overview

The frontend is a React 19 app built with **Expo Router**. Metro bundles it,
NativeWind 5 compiles Tailwind 4, Apollo Client handles GraphQL, and the UI is
[cubeui](https://github.com/cubicecho/cubeui)'s **native** registry.

The web is the only target shipped today, but the app is written in React
Native primitives — `View`, `Text`, `Pressable`, `ScrollView` — which
react-native-web turns into DOM. **Do not write `<div>` / `<span>` /
`<button>`**; see [React Native rules](#react-native-rules).

- **Entry point**: `expo-router/entry` (see `app/package.json` `main`)
- **Root layout**: `app/app/_layout.tsx`
- **Dev server**: `http://localhost:3000`
- **GraphQL endpoint**: `${EXPO_PUBLIC_API_URL}/graphql` — unset in dev, so the
  request is same-origin and the API is expected at the app's own host

## Directory Structure

Routes live in `app/app/`. Everything that is not a route lives in `app/src/`.
This split matters: putting a component under `app/app/` turns it into a route.

```
app/
├── app/                        # Expo Router — file-based routes
│   ├── _layout.tsx             # Theme, ApolloProvider, <Stack>, ErrorBoundary; imports global.css
│   ├── login.tsx               # /login
│   ├── auth/verify.tsx         # /auth/verify (magic-link landing)
│   └── (app)/                  # Authenticated group — no URL segment
│       ├── _layout.tsx         # Redirects to /login; renders the AppShell
│       ├── index.tsx           # /
│       ├── network.tsx         # /network
│       ├── labels/index.tsx    # /labels
│       ├── settings/index.tsx  # /settings
│       └── persons/
│           ├── index.tsx       # /persons
│           └── [id]/           # /persons/:id
│               ├── _layout.tsx
│               ├── index.tsx
│               └── timeline.tsx
└── src/
    ├── __generated__/          # Generated GraphQL types (do not edit)
    │   ├── gql.ts              # graphql() tagged template helper
    │   ├── graphql.ts          # Types for every query/mutation/fragment
    │   └── type-policies.ts    # Scalar type policies for the Apollo cache
    ├── components/
    │   ├── *.tsx               # cubeui layout shells, vendored (page-layout, section, sidebar, …)
    │   ├── app-form.tsx        # useAppForm — the app's one form hook
    │   ├── app-icons(.web).tsx # Icons cubeui's set does not ship
    │   ├── domain/             # Feature components, one directory per entity
    │   ├── layouts/            # app-shell.tsx
    │   ├── settings/           # API keys, imports and exports
    │   └── ui/                 # cubeui primitives, vendored (no app logic here)
    ├── hooks/                  # use-query-string-state, use-avatar-upload
    └── lib/                    # auth, apollo, utils (cn), date-type-policy, …
```

## Routing

File-based via Expo Router:

- A file under `app/app/` becomes a route at its path. Default-export the
  component; there is no route-object export to write.
- `[id].tsx` / `[id]/` is a dynamic segment, read with `useLocalSearchParams()`.
- `_layout.tsx` wraps every route in its directory, rendering `<Slot />` (or
  `<Stack />`) where children go.
- A directory in parentheses — `(app)` — groups routes under a shared layout
  **without** adding a URL segment.
- Navigate with `<Link href="...">` or `useRouter()` from `expo-router`.

There is no generated route tree to keep in sync.

## Auth

`app/app/(app)/_layout.tsx` gates the authenticated area: no token means
`<Redirect href="/login" />`. The token itself is read and written through
`@/lib/auth`.

It decides after mount, because the token lives in `localStorage` and the first
render cannot read it.

The Apollo link chain in `@/lib/apollo` attaches `Authorization: Bearer <token>`
to every request, and an error link clears the token and sends the browser to
`/login` on an `UNAUTHENTICATED` response.

## Data Fetching

GraphQL operations are co-located in the route or component that uses them.
Define them with `graphql()` so the types are generated:

```ts
import { graphql } from '@/__generated__/gql';

const GET_PERSONS = graphql(`
  query GetPersons($where: PersonFilters, $orderBy: PersonOrderBy) {
    persons(where: $where, orderBy: $orderBy) {
      id
      firstName
      lastName
    }
  }
`);
```

Then use the Apollo hooks:

```ts
const { data, loading, error, refetch } = useQuery(GET_PERSONS, { variables });
const [createPerson] = useMutation(CREATE_PERSON, {
  refetchQueries: [{ query: GET_PERSONS }],
});
```

Always pass `refetchQueries` on mutations that modify lists — except on detail
pages, where the route owns refetching; see
[`patterns.md`](./patterns.md).

Filtering, sorting and pagination are the API's, not the client's: pass `where`
and `orderBy` through to the query rather than filtering an array in the
component. See [`graphql.md`](./graphql.md#filtering).

## Fragments

Fragment masking is **off** (`fragmentMasking: false` in `app/codegen.ts`, and
the client sets no `dataMasking`), so a parent can read every field its query
selected, including through a fragment spread.

`domain/label/list.tsx` uses `useFragment` to read a row from the cache. It is
a valid pattern, not a required one — most components take plain typed props
from the route instead, which is the simpler default for new work:

```ts
export interface PersonRowData {
  id: string;
  firstName: string;
  // …
}
```

## React Native rules

- **No DOM elements.** `View`, `Text`, `Pressable`, `ScrollView`, `Image`, and
  cubeui components. `onPress`, not `onClick`; `onChangeText` / `onValueChange`,
  not `onChange(event)`. The one exception is the d3 canvas in
  `app/(app)/network.tsx`.
- **Every string sits in a `<Text>`, and every `<Text>` names its colour**
  (`text-foreground`, `text-foreground/60`, `text-destructive`, …). Text does
  not inherit colour or font from a parent `View`.
- **Every border names its colour** — `border border-border`, never a bare
  `border`.
- **A `View` is a column.** Write `flex-row` where a row is meant, `gap-*`
  rather than `space-x/y`, and no CSS grid.
- **Links around a control use `asChild`**:
  `<Link href="/persons" asChild><Button content="People" /></Link>`.
- **Icons** come from `@/components/ui/icons` or `@/components/app-icons`,
  never from `lucide-react` directly — the native half wraps each glyph so it
  takes a `className`.

## cubeui

The components are vendored, not installed as a package: `app/components.json`
points the shadcn CLI at `https://cubicecho.github.io/cubeui/r/native/{name}.json`.

```bash
cd app
npx shadcn@latest add @cubeui/<item> --overwrite
```

Do not edit a vendored file to fix or restyle it — change it in
`cubicecho/cubeui` and pull it again. The rules cubeui components share:

- **Shells take no children.** Content goes in `*Slot` props (`contentSlot`,
  `actionSlot`, `iconSlot`), which take elements, never a bare string. Word
  props — `title`, `description`, `label`, `content` — take strings.
- **`Button` is `content` + `iconSlot`**; an icon-only button is an
  `ActionButton` with a required `label`.
- **Every screen is a `PageLayout`.** The shell's main area does not scroll; a
  `PageLayout`'s body scrolls under its pinned header.
- **Loading, error and empty are `QueryState`**, not three hand-written
  branches.

## Form Presentation Rule

**All forms are presented inside a dialog** — a `FormDialog` from
`@/components/ui/form-dialog`. Never render a form inline on a page, and never
make a value editable in place: editing opens the dialog. This keeps the UI
consistent and avoids layout shift. Confirmations are a `ConfirmDialog` or a
`ConfirmButton`.

## Form Pattern

Forms use TanStack Form through cubeui's `createAppForm`, called once in
`@/components/app-form`:

```tsx
import { useAppForm } from '@/components/app-form';
import { Form } from '@/components/ui/form';

const form = useAppForm({
  defaultValues: { name: '' },
  onSubmit: async ({ value }) => { /* call mutation */ },
});

<form.AppForm>
  <Form className="gap-4">
    <form.AppField name="name" validators={{ onChange: ({ value }) => (value.trim() ? undefined : 'Required') }}>
      {(field) => <field.InputField label="Name" />}
    </form.AppField>
    <form.SubmitButton createLabel="Add" editLabel="Save" isEdit={isEdit} savingLabel="Saving…" />
  </Form>
</form.AppForm>
```

Import `useAppForm` — do not call `createAppForm` again in a feature file; a
second call mints its own contexts. A field cubeui does not ship is added to
the one call in `app-form.tsx`.

## Styling

Tailwind CSS v4 through NativeWind 5. There is no `tailwind.config.js`: the
theme is `app/cubeui-tokens.css` (cubeui's `tokens` item — generated, do not
edit), imported by `app/global.css`, which the root layout imports. Use utility
classes directly in JSX, and `cn()` from `@/lib/utils` when merging conditional
classes.

Use the tokens — `bg-background`, `text-foreground/60`, `border-border`,
`text-destructive` — never a palette class (`bg-red-50`) or a hex in a class
name. A colour the user chose (a label's) is data, so it goes inline: `Badge
backgroundColor`, `ColorDot`, or `style`, with `readableTextColor()` picking
the ink on top.

Light, dark and system are cubeui's `useThemePreference`, called in the root
layout, with `ThemePicker` on the Settings page. `public/index.html` carries the
pre-paint script that applies the stored choice before the first frame.

## Running & Building

```bash
npm run dev:app        # Expo dev server (port 3000)
npm run build:app      # Static web export → app/dist/
```

## Codegen

After changing any GraphQL query, mutation, or fragment:

```bash
npm run codegen:app    # Regenerates app/src/__generated__/
```

Codegen reads the SDL snapshot at `server/__generated__/schema.graphql`, so if
the server schema changed, run `npm run codegen` (or `codegen:server` first) —
otherwise the client is generated against a stale schema. Never edit
`__generated__/` by hand.
