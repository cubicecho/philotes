import { useMutation, useQuery } from '@apollo/client';
import { useCallback, useState } from 'react';
import { graphql } from '@/__generated__/gql';
import { OrderDirection, type PersonFilters, type PersonOrderBy } from '@/__generated__/graphql';
import { PersonForm, type PersonFormValue } from '@/components/domain/person/form';
import { PersonList } from '@/components/domain/person/list';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner.tsx';
import { useQueryStringState } from '@/hooks/use-query-string-state';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ---------------------------------------------------------------------------
// GraphQL documents
// ---------------------------------------------------------------------------

const GET_PERSONS = graphql(`
  query GetPersons(
    $limit: Int
    $offset: Int
    $where: PersonFilters
    $orderBy: PersonOrderBy
  ) {
    persons(limit: $limit, offset: $offset, where: $where, orderBy: $orderBy) {
      id
      firstName
      lastName
      email
      avatarPath
      labels {
        id
        label
        color
      }
      interactions(limit: 1, orderBy: { occurredAt: { direction: desc, priority: 1 } }) {
        occurredAt
      }
      ...Person_List
    }
  }
`);

const GET_LABELS = graphql(`
  query GetLabelsForPersonForm {
    labels {
      id
      color
      label
    }
  }
`);

const CREATE_PERSON = graphql(`
  mutation CreatePerson($values: CreatePersonInput!) {
    createPerson(values: $values) {
      id
    }
  }
`);

const DELETE_PERSON = graphql(`
  mutation DeletePerson($id: String!) {
    deletePersons(where: { id: { eq: $id } }) {
      id
    }
  }
`);

// ---------------------------------------------------------------------------
// URL state types
// ---------------------------------------------------------------------------

type SortField = 'name' | 'lastContacted';
type SortDir = 'asc' | 'desc';

interface PersonsUrlState {
  q: string;
  labels: string[];
  page: number;
  pageSize: number;
  sortField: SortField;
  sortDir: SortDir;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PersonsPage() {
  // ── URL state ──────────────────────────────────────────────────────────────
  const [urlState, setUrlState] = useQueryStringState<PersonsUrlState>(
    {
      q: '',
      labels: [],
      page: 0,
      pageSize: 10,
      sortField: 'name',
      sortDir: 'asc',
    },
    { typeMap: { page: 'number', pageSize: 'number', labels: 'stringArray' } },
  );

  const urlQ = urlState.q ?? '';
  const activeLabelIds = urlState.labels ?? [];
  const page = urlState.page ?? 0;
  const pageSize = urlState.pageSize ?? 10;
  const sortField: SortField = urlState.sortField ?? 'name';
  const sortDir: SortDir = urlState.sortDir ?? 'asc';

  // ── Local search state — prevents input re-mount on every keystroke ────────
  // The input reads from local state for instant feedback. URL state is updated
  // via a debounced callback so bookmarking and sharing still work.
  const [searchValue, setSearchValue] = useState(urlQ);

  const debouncedSetUrlQ = useCallback(
    debounce((q: string) => setUrlState({ q, page: 0 }), 300),
    // debounce returns a new function only once; setUrlState is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleSearchChange = (value: string): void => {
    setSearchValue(value);
    debouncedSetUrlQ(value);
  };

  // The GraphQL query uses the URL value (debounced) so server requests are
  // not sent on every keystroke, only after the user pauses typing.
  const q = urlQ;

  // ── Build GraphQL query variables ─────────────────────────────────────────
  //
  // For "name" sort: push search, sort, and pagination to the server.
  // For "lastContacted" sort: the server cannot sort by a nested relation
  // field (last interaction.occurredAt), so we fetch all persons without
  // pagination and sort/paginate client-side after receiving the data.

  const trimmedQ = q.trim();

  const where: PersonFilters | undefined = trimmedQ
    ? {
        OR: [
          { firstName: { ilike: `%${trimmedQ}%` } },
          { lastName: { ilike: `%${trimmedQ}%` } },
          { email: { ilike: `%${trimmedQ}%` } },
        ],
      }
    : undefined;

  const isNameSort = sortField === 'name';
  const orderDirection = sortDir === 'asc' ? OrderDirection.Asc : OrderDirection.Desc;

  // Server-side orderBy only available for name sort.
  const orderBy: PersonOrderBy | undefined = isNameSort
    ? {
        lastName: { direction: orderDirection, priority: 1 },
        firstName: { direction: orderDirection, priority: 2 },
      }
    : undefined;

  // Server-side pagination only when sort is name-based.
  // Fetch pageSize + 1 to detect whether a next page exists (sentinel pattern).
  const limit = isNameSort ? pageSize + 1 : undefined;
  const offset = isNameSort ? page * pageSize : undefined;

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data, previousData, loading, error } = useQuery(GET_PERSONS, {
    variables: { limit, offset, where, orderBy },
  });

  // Keep showing stale results while the new query loads to prevent flash.
  const displayData = data ?? previousData;
  const { data: labelsData } = useQuery(GET_LABELS);

  // Use refetch by operation name to avoid type issues with dynamic variables
  const [createPerson] = useMutation(CREATE_PERSON, {
    refetchQueries: ['GetPersons'],
  });
  const [deletePerson] = useMutation(DELETE_PERSON, {
    refetchQueries: ['GetPersons'],
  });

  const [dialogOpen, setDialogOpen] = useState(false);

  // ── Post-fetch: shape raw data ─────────────────────────────────────────────

  const rawPersons = (displayData?.persons ?? []).map((p) => ({
    ref: p,
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    avatarPath: p.avatarPath,
    labels: p.labels ?? [],
    lastContactedAt: p.interactions[0]?.occurredAt ?? null,
  }));

  // ── Client-side sort for lastContacted ────────────────────────────────────
  // For lastContacted sort: sort all persons client-side.
  // Null lastContactedAt goes last regardless of direction.
  const sortedPersons = isNameSort
    ? rawPersons // already ordered by server
    : [...rawPersons].sort((a, b) => {
        const aTime = a.lastContactedAt ? a.lastContactedAt.getTime() : null;
        const bTime = b.lastContactedAt ? b.lastContactedAt.getTime() : null;
        if (aTime === null && bTime === null) return 0;
        if (aTime === null) return 1;
        if (bTime === null) return -1;
        return sortDir === 'asc' ? aTime - bTime : bTime - aTime;
      });

  // ── Pagination ────────────────────────────────────────────────────────────
  // For name sort: server returned pageSize + 1 items if there is a next page.
  // For lastContacted sort: paginate client-side across all results.
  const hasNextPage = isNameSort ? sortedPersons.length > pageSize : (page + 1) * pageSize < sortedPersons.length;

  const displayPersons = isNameSort
    ? hasNextPage
      ? sortedPersons.slice(0, pageSize)
      : sortedPersons
    : sortedPersons.slice(page * pageSize, (page + 1) * pageSize);

  // ── Label filtering (client-side — server cannot filter by nested relation)
  const filteredPersons =
    activeLabelIds.length > 0
      ? displayPersons.filter((p) => activeLabelIds.every((id) => p.labels.some((l) => l.id === id)))
      : displayPersons;

  // Collect all unique labels across all raw persons for the filter chips
  const allLabels = Array.from(new Map(rawPersons.flatMap((p) => p.labels).map((l) => [l.id, l])).values());

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDelete = async (id: string): Promise<void> => {
    await deletePerson({ variables: { id } });
  };

  const handleSubmit = async ({ person }: PersonFormValue): Promise<void> => {
    const { firstName, lastName, email } = person;
    await createPerson({ variables: { values: { firstName, lastName, email } } });
    setDialogOpen(false);
  };

  const handleToggleLabel = (id: string): void => {
    const next = new Set(activeLabelIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setUrlState({ labels: [...next], page: 0 });
  };

  const handleSortChange = (value: string): void => {
    const dashIndex = value.lastIndexOf('-');
    const field = value.slice(0, dashIndex) as SortField;
    const dir = value.slice(dashIndex + 1) as SortDir;
    setUrlState({ sortField: field, sortDir: dir, page: 0 });
  };

  // Show full spinner only on the very first load (no stale data yet).
  if (!displayData && loading) return <Spinner />;
  if (error) return <p>Error loading persons: {error.message}</p>;

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>New Person</DialogTitle>
            <DialogDescription>Add a new person to your CRM.</DialogDescription>
          </DialogHeader>
          <PersonForm
            availableLabels={labelsData?.labels ?? []}
            onSubmit={handleSubmit}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <PersonList
        persons={filteredPersons}
        allLabels={allLabels}
        activeLabelIds={activeLabelIds}
        onToggleLabel={handleToggleLabel}
        q={searchValue}
        onSearchChange={handleSearchChange}
        loading={loading}
        sortValue={`${sortField}-${sortDir}`}
        onSortChange={handleSortChange}
        page={page}
        pageSize={pageSize}
        hasNextPage={hasNextPage}
        onNextPage={() => setUrlState({ page: page + 1 })}
        onPrevPage={() => setUrlState({ page: page - 1 })}
        onPageSizeChange={(size) => setUrlState({ pageSize: size, page: 0 })}
        onClickAdd={() => setDialogOpen(true)}
        onClickDelete={handleDelete}
      />
    </>
  );
}
