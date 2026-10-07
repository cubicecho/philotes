# UI Patterns

## Mutation-with-Callback Pattern

Used by all domain sub-components that perform GraphQL mutations on the detail
view (e.g. `PersonRelationships`, `PersonLabels`).

### Problem

Apollo Client's `refetchQueries` option on `useMutation` requires a
`DocumentNode`. When the same document is used in multiple places with
different variables (e.g. `GetPersonDetail` keyed by `$id`), passing the bare
document without variables causes the refetch to run without the correct
variables, returning wrong or empty data.

A second, smaller pull in the same direction: the detail route already holds
one query whose result every section on the page reads. Letting each section
refetch for itself would mean several round trips for one user action, and
sections disagreeing about what the current data is.

### Solution

The sub-component owns the mutation and its loading/error state. The **route**
(page component) owns the data-refresh logic. The two are connected via plain
callback props: `onDelete` and `onAdd`.

```
Route (owns query + refetch)
  └── SubComponent (owns mutation)
        ├── onDelete(id) → called after successful delete mutation
        └── onAdd(...args) → called after successful create/attach mutation
```

The route passes `() => refetch()` for both callbacks, which re-executes the
query with the correct variables already bound in the `useQuery` call.

### Structure of a Sub-Component

Each sub-component follows this layout:

```
component/
  fragment   — GraphQL fragment on the parent type (e.g. Person)
  mutations  — CREATE / DELETE mutations (no refetchQueries)
  props type — { parent entity, available options, onDelete, onAdd, showAdd? }
  ItemRow    — renders one item + calls mutation then onDelete(id)
  AddForm/Picker — calls mutation then onAdd(...args) + onClose()
  MainExport — composes rows and add-form, threads callbacks down
```

### Props Contract

Names vary with the entity; the shape does not. `PersonRelationships` is
representative:

```ts
export interface RelationshipsProps {
  // The parent entity, typed from the GraphQL fragment
  person: Person_RelationshipsFragment;
  // Available options for the add form/picker
  allPersons: Array<{ id: string; firstName: string; lastName: string }>;
  // Called by the component after a mutation succeeds
  onDelete: (id: string) => void;
  onAdd: (fromPersonId: string, toPersonId: string, type: string) => void;
  onEdit: (id: string, type: string) => void;
  // Whether to render the inline add trigger
  showAdd?: boolean;
  onShowAdd?: (show: boolean) => void;
}
```

### Route-Side Wiring

```tsx
// In the route component:
const { refetch } = useQuery(GET_ENTITY_DETAIL, { variables: { id } });

const handleDeleteFoo = () => refetch();
const handleAddFoo    = () => refetch();

// In JSX:
<FooSubComponent
  entity={entity}
  allOptions={allOptions}
  onDelete={handleDeleteFoo}
  onAdd={handleAddFoo}
  showAddButton
/>
```

### Key Rules

- Sub-components **never** call `refetchQueries` on their mutations.
- Sub-components **never** receive a `DocumentNode` or query variables.
- The route is the single source of truth for when data is re-fetched.
- The route's query must select every field its sub-components read. Fragment
  masking is off (see [`frontend.md`](./frontend.md#fragments)), so a spread is
  enough — the parent can read through it — but a field nobody selected is
  still absent.

### Examples

| Component | File |
| --- | --- |
| Relationships | `app/src/components/domain/person/relationships.tsx` |
| Labels | `app/src/components/domain/person/labels.tsx` |
| Call site | `app/app/(app)/persons/[id]/index.tsx`, which hands its `reload` to the two columns (`detail-contact-column.tsx`, `detail-activity-column.tsx`) as `onChanged` |
| The page's documents | `app/src/components/domain/person/detail-queries.ts` |
