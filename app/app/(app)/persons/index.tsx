import { useMutation, useQuery } from '@apollo/client';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { graphql } from '@/__generated__/gql';
import { OrderDirection, type PersonFilters } from '@/__generated__/graphql';
import { PersonForm, type PersonFormValue } from '@/components/domain/person/form';
import { PersonList, type PersonRowData } from '@/components/domain/person/list';
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
  query GetPersons($where: PersonFilters, $orderBy: PersonOrderBy) {
    persons(where: $where, orderBy: $orderBy) {
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
      contactInfos {
        id
        type
        value
        isPrimary
      }
      interactions(limit: 1, orderBy: { occurredAt: { direction: desc, priority: 1 } }) {
        occurredAt
      }
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
  sortField: SortField;
  sortDir: SortDir;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PersonsPage() {
  const router = useRouter();
  const { new: newParam } = useLocalSearchParams<{ new?: string }>();

  // ── URL state ──────────────────────────────────────────────────────────────
  const [urlState, setUrlState] = useQueryStringState<PersonsUrlState>(
    {
      q: '',
      labels: [],
      sortField: 'name',
      sortDir: 'asc',
    },
    { typeMap: { labels: 'stringArray' } },
  );

  const urlQ = urlState.q ?? '';
  const activeLabelIds = urlState.labels ?? [];
  const sortField: SortField = urlState.sortField ?? 'name';
  const sortDir: SortDir = urlState.sortDir ?? 'asc';

  // ── Local search state — instant input feedback, debounced URL/query update
  const [searchValue, setSearchValue] = useState(urlQ);

  const debouncedSetUrlQ = useCallback(
    debounce((q: string) => setUrlState({ q }), 300),
    // debounce returns a new function only once; setUrlState is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleSearchChange = (value: string): void => {
    setSearchValue(value);
    debouncedSetUrlQ(value);
  };

  // ── Build GraphQL query variables ─────────────────────────────────────────
  const trimmedQ = urlQ.trim();

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

  // ── Data fetching — the whole (searched) list; sorting by name on the server
  const { data, previousData, loading, error } = useQuery(GET_PERSONS, {
    variables: {
      where,
      orderBy: {
        lastName: { direction: isNameSort ? orderDirection : OrderDirection.Asc, priority: 1 },
        firstName: { direction: isNameSort ? orderDirection : OrderDirection.Asc, priority: 2 },
      },
    },
  });

  const displayData = data ?? previousData;
  const { data: labelsData } = useQuery(GET_LABELS);

  const [createPerson] = useMutation(CREATE_PERSON, {
    refetchQueries: ['GetPersons'],
  });
  const [deletePerson] = useMutation(DELETE_PERSON, {
    refetchQueries: ['GetPersons'],
  });

  const [dialogOpen, setDialogOpen] = useState(false);

  // FAB and other screens can deep-link the create dialog via /persons?new=1
  useEffect(() => {
    if (newParam) {
      setDialogOpen(true);
      router.setParams({ new: undefined });
    }
  }, [newParam, router]);

  // ── Shape raw data ─────────────────────────────────────────────────────────
  const rawPersons: PersonRowData[] = (displayData?.persons ?? []).map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    avatarPath: p.avatarPath,
    labels: p.labels ?? [],
    contactInfos: p.contactInfos ?? [],
    lastContactedAt: p.interactions[0]?.occurredAt ?? null,
  }));

  // ── Client-side sort for lastContacted (server can't sort by relation) ────
  const sortedPersons = isNameSort
    ? rawPersons
    : [...rawPersons].sort((a, b) => {
        const aTime = a.lastContactedAt ? a.lastContactedAt.getTime() : null;
        const bTime = b.lastContactedAt ? b.lastContactedAt.getTime() : null;
        if (aTime === null && bTime === null) return 0;
        if (aTime === null) return 1;
        if (bTime === null) return -1;
        return sortDir === 'asc' ? aTime - bTime : bTime - aTime;
      });

  // ── Label filtering (client-side — server cannot filter by nested relation)
  const filteredPersons =
    activeLabelIds.length > 0
      ? sortedPersons.filter((p) => activeLabelIds.every((id) => p.labels.some((l) => l.id === id)))
      : sortedPersons;

  const allLabels = (labelsData?.labels ?? []).map((l) => ({ id: l.id, label: l.label, color: l.color }));

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
    setUrlState({ labels: [...next] });
  };

  const handleSortChange = (value: string): void => {
    const dashIndex = value.lastIndexOf('-');
    const field = value.slice(0, dashIndex) as SortField;
    const dir = value.slice(dashIndex + 1) as SortDir;
    setUrlState({ sortField: field, sortDir: dir });
  };

  if (!displayData && loading) return <Spinner />;
  if (error) return <p>Error loading people: {error.message}</p>;

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
        grouped={isNameSort}
        onClickAdd={() => setDialogOpen(true)}
        onClickDelete={handleDelete}
      />
    </>
  );
}
