# Components

## Overview

The component tree is split into five layers:

| Layer | Location | Purpose |
| --- | --- | --- |
| **UI primitives** | `app/src/components/ui/` | Vendored [cubeui](https://github.com/cubicecho/cubeui) primitives — no app logic |
| **Shells** | `app/src/components/*.tsx` | Vendored cubeui layout shells (`PageLayout`, `Section`, `ListItem`, …) |
| **Domain components** | `app/src/components/domain/` | Feature-specific forms and lists |
| **Layouts** | `app/src/components/layouts/` | The app's own chrome (`AppShell`) |
| **Settings** | `app/src/components/settings/` | Account settings panels |

Routes live in `app/app/` and are **not** components in this sense — a file
placed there becomes a URL. See [`frontend.md`](./frontend.md#routing).

Everything is written with React Native primitives (`View`, `Text`,
`Pressable`); see [`frontend.md`](./frontend.md#react-native-rules).

---

## UI Primitives and Shells (`components/ui/`, `components/*.tsx`)

Vendored from the cubeui **native** registry with
`npx shadcn@latest add @cubeui/<item> --overwrite`, run from `app/`. Do **not**
edit these files, add application logic to them, or wrap one to restyle it —
use its props and variants, compose it in `components/domain/`, and report a
missing prop upstream. The JSDoc at the top of each file is the reference; the
ones this app leans on:

| Component | File | Notes |
| --- | --- | --- |
| `Button` | `ui/button.tsx` | `content`, `iconSlot`, `variant`, `size`, `loading`, `onPress` |
| `ActionButton` | `action-button.tsx` | Icon-only button; `label` is its accessible name |
| `ConfirmButton`, `ConfirmDialog` | `confirm-button.tsx`, `ui/confirm-dialog.tsx` | Destructive-action confirmation |
| `FormDialog`, `FormDialogFooter` | `ui/form-dialog.tsx` | Modal — every form goes in one |
| `createAppForm`, `Form` | `ui/form.tsx` | TanStack Form integration; the app's one hook is `@/components/app-form` |
| `PageLayout` | `page-layout.tsx` | Every route: pinned title block over a scrolling body |
| `Section` | `section.tsx` | Heading, `actionSlot`, `contentSlot`; `surface="card"` for a card |
| `ListItem` | `list-item.tsx` | A row: `leadingSlot`, `title`, `description`, `actionSlot` |
| `QueryState`, `QueryError` | `query-state.tsx` | Loading / error / empty for a query |
| `EmptyState` | `page.tsx` | "Nothing here yet" |
| `MultiSelect` | `multi-select.tsx` | Multi-select over the caller's labels |
| `Badge` | `ui/badge.tsx` | Pill; `backgroundColor`/`textColor` for user-chosen colours |
| `SidebarLayout`, `Sidebar`, `SidebarNavItem`, `BarNavItem` | `split-layout.tsx`, `sidebar.tsx` | What `AppShell` is built from |
| `ThemePicker` | `ui/theme-picker.tsx` | Light / dark / system |
| icons | `ui/icons.tsx` | The shared icon set; app-only icons are in `app-icons.tsx` |

Shells take **no children**: content goes in `*Slot` props, and word props
(`title`, `label`, `content`) take strings.

---

## Domain Components (`components/domain/`)

One directory per entity — currently `address/`, `contact-info/`, `dashboard/`,
`label/`, `network/`, `person/`, `task/`. The directory listing is the inventory; what
follows documents the conventions, using two representative components.

"Label" and "tag" are the same thing in this app. `labels` is the table, and
`label/` is the only place its components live — do not reintroduce a parallel
`tag/` directory. `LabelChip` (`label/label-chip.tsx`) is the coloured pill for
one, a cubeui `Badge` in the label's colour; `Avatar` (`person/avatar.tsx`) is a
person's photo with an initials fallback.

`network/graph.web.tsx` is the one place a DOM element is drawn: d3 owns an
`<svg>` there. `graph.tsx` is its native twin, which says the graph is web-only.

### `PersonForm` (`domain/person/form.tsx`)

Creates and edits a person. TanStack Form + Zod.

```ts
interface PersonFormProps {
  availableLabels: Label_ListFragment[];
  initialValues?: PersonFormInitialValues;
  submitLabel?: string;
  onSubmit: (value: PersonFormValue) => Promise<void>;
  onCancel: () => void;
}

interface PersonFormValue {
  person: PersonFormPerson;   // the name parts, organization, jobTitle, department, about, contactFrequency, …
  email: string | null;       // a new person's address, saved as a contact info; null on an edit
  labelIds: string[];
}
```

Passing `initialValues` turns it into an edit form; the same component serves
both. The email field is only drawn when adding: a stored person's addresses
are contact infos, edited on their page. `primaryEmail` and `primaryPhone` in
`lib/primary-contact.ts` pick the one a row or a button uses.

A new person needs a first name, last name, nickname or organization; an edit
does not, since a stored person may be only a number. That rule is checked on
submit and shown in the footer, not on a field. A person is named on screen
with `personName` (`lib/person-name.ts`): the server's `displayName`, else an
email address, else a telephone number, else "Unnamed". Do not join name parts
in a component.

### `PersonList` + `PersonRow` (`domain/person/list.tsx`)

`PersonList` renders search, sort, an "Add Person" button and a list of
`PersonRow` rows inside a `PageLayout`. The rows are a virtualised
`SectionList`, one section per letter when the list is sorted by name, and the
page's body is told not to scroll (`scroll={false}`) because the list does.

It takes **plain typed props** — `PersonRowData`, `PersonContactInfo` — rather
than a fragment. This is the default for new components: the route owns the
query, the component states the shape it needs.

The alternative is a cache fragment, used by `domain/label/list.tsx`:

```ts
const LABEL_LIST = graphql(`
  fragment Label_List on Label {
    id
    color
    label
  }
`);

const { data: label, complete } = useFragment({ fragment: LABEL_LIST, from });
```

Both are valid. Reach for `useFragment` only when a row genuinely needs to
re-render from cache writes it did not trigger.

---

## Layout Preference

**Prefer a cubeui shell whenever one fits.** A screen is a `PageLayout`; a
titled group with an action is a `Section`; a row is a `ListItem`. Do not
hand-roll a `View` with `flex-row items-center justify-between` for a shape a
shell already draws — using the shell is what keeps spacing and alignment a
single-point edit.

---

## Layouts (`components/layouts/`)

### `AppShell` (`app-shell.tsx`)

The app chrome, rendered once by `app/app/(app)/_layout.tsx` — not by
individual routes. A cubeui `SidebarLayout`: a rail of the app's places from
`md` up, and a bar of the same places over the page on a phone. The route
renders into its `role="main"` view, which does not scroll — which is why every
route is a `PageLayout`.

---

## Settings (`components/settings/`)

`ApiKeyManager` lists the caller's API keys and revokes them;
`CreateApiKeyDialog` mints one and shows the plaintext key exactly once. See
[`server.md`](./server.md) for the API-key model. `ExportCalendarCard`,
`ExportPeopleCard`, `ExportVCardsCard`, `VCardImportCard` and
`GoogleCsvImportCard` are the import/export tab. A file is picked through
`ImportFileButton`, which is the browser's file dialog on the web and the
system's file picker on a device. Both imports are an `ImportCard`, which owns the stages
(choose, preview, importing, result) and is handed the file type, a rough
preview from `lib/import-preview.ts` and the mutation to run. The vCard export
asks the server for the file (`exportVCards`) when the button is pressed; the
CSV export is built in the browser.

---

## Add Button Placement in List Sections

Every list section on a detail page (Important Dates, Notes, Relationships,
etc.) is a `Section` with its add trigger in `actionSlot`:

```tsx
<Section
  surface="card"
  title="Important Dates"
  actionSlot={<Button variant="ghost" size="xs" iconSlot={<CalendarPlus />} content="Add" onPress={() => setDialogOpen(true)} />}
  contentSlot={<SectionList ... createOpen={dialogOpen} onCreateOpenChange={setDialogOpen} />}
/>
```

**Rules:**

- Use `Section`; do not hand-roll a card with a header row.
- The "Add" button lives in the **section header row**, right-aligned, never
  inside the list component itself.
- Dialog open state (`dialogOpen`, `setDialogOpen`) is owned by the **page**
  (route component), not the list component.
- The list component receives `createOpen: boolean` and
  `onCreateOpenChange: (open: boolean) => void` as props and renders the
  `FormDialog` internally — keeping the dialog co-located with the form it
  opens.
- If all items are already added (e.g. everyone is already linked), disable the
  trigger and say why in the section.

This ensures consistent UX: the add button is always in the same position
relative to the section title across all list sections.

---

## Adding a New Domain Component

1. Create a directory under `app/src/components/domain/<entity>/`, named in
   kebab-case, as is every file in it.
2. Add `form.tsx` — a Zod schema and `useAppForm` from
   `@/components/app-form`. Render it
   inside a `FormDialog`; see [`frontend.md`](./frontend.md#form-presentation-rule).
3. Add `list.tsx` — `ListItem` rows taking typed props.
4. Define the GraphQL operations in the route that uses it, under
   `app/app/(app)/<entity>/index.tsx`.
5. Run `npm run codegen:app` to generate types.
