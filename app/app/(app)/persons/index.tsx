import { useMutation } from '@apollo/client';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { graphql } from '@/__generated__/gql';
import { OrderDirection, type PersonFilters } from '@/__generated__/graphql';
import { PersonForm, type PersonFormValue } from '@/components/domain/person/form';
import { PersonList, type PersonRowData } from '@/components/domain/person/list';
import { PageLayout } from '@/components/page-layout';
import { QueryState } from '@/components/query-state';
import { FormDialog } from '@/components/ui/form-dialog';
import { useQueryStringState } from '@/hooks/use-query-string-state';
import { SEARCH_DEFAULTS } from '@/lib/defaults';
import { invalidateQueryFields } from '@/lib/invalidate';
import { useAllRows } from '@/lib/use-all-rows';

/**
 * Delays a function until its calls have stopped for a while.
 *
 * @typeParam T - The function being delayed.
 * @param fn - What to call once the calls stop.
 * @param delay - How long the calls must pause, in milliseconds.
 * @returns A function that restarts the wait on every call and hands its last arguments to `fn`.
 */
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const GET_PERSONS = graphql(`
  query GetPersons($where: PersonFilters, $orderBy: PersonOrderBy, $limit: Int!, $offset: Int!) {
    persons(where: $where, orderBy: $orderBy, limit: $limit, offset: $offset) {
      id
      displayName
      sortName
      avatarPath
      labels(limit: 20) {
        id
        label
        color
      }
      contactInfos(limit: 10) {
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
  query GetLabelsForPersonForm($limit: Int!, $offset: Int!) {
    labels(limit: $limit, offset: $offset, orderBy: { label: { direction: asc, priority: 2 }, id: { direction: asc, priority: 1 } }) {
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

const CREATE_PERSON_EMAIL = graphql(`
  mutation CreatePersonEmail($personId: UUID!, $value: String!) {
    createContactInfo(values: { personId: $personId, type: email, value: $value, isPrimary: true }) {
      id
    }
  }
`);

const DELETE_PERSON = graphql(`
  mutation DeletePerson($id: UUID!) {
    deletePerson(where: { id: { eq: $id } }) {
      id
    }
  }
`);

/** What the list can be ordered by, as the sort picker and the URL spell it. */
const SORT_FIELDS = ['name', 'lastContacted'] as const;
type SortField = (typeof SORT_FIELDS)[number];

/** The two directions of a sort, as the sort picker and the URL spell them. */
const SORT_DIRS = ['asc', 'desc'] as const;
type SortDir = (typeof SORT_DIRS)[number];

/** What the people list keeps in the URL's query string. */
interface PersonsUrlState {
  /** The search text. */
  q: string;
  /** Ids of the labels a person must carry, all of them, to be listed. */
  labels: string[];
  sortField: SortField;
  sortDir: SortDir;
}

/** The people page: the list with its search, label filter and sort, and the dialog that adds a person. */
export default function PersonsPage() {
  const router = useRouter();
  const { new: newParam } = useLocalSearchParams<{ new?: string }>();

  // URL state
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

  // Local search state — instant input feedback, debounced URL/query update
  const [searchValue, setSearchValue] = useState(urlQ);

  const debouncedSetUrlQ = useCallback(
    debounce((q: string) => setUrlState({ q }), SEARCH_DEFAULTS.debounceMs),
    // debounce returns a new function only once; setUrlState is stable
    [],
  );

  const handleSearchChange = (value: string): void => {
    setSearchValue(value);
    debouncedSetUrlQ(value);
  };

  // Build GraphQL query variables
  const trimmedQ = urlQ.trim();

  const where: PersonFilters | undefined = trimmedQ
    ? {
        OR: [
          { displayName: { ilike: `%${trimmedQ}%` } },
          { nickname: { ilike: `%${trimmedQ}%` } },
          { organization: { ilike: `%${trimmedQ}%` } },
          { contactInfos: { some: { value: { ilike: `%${trimmedQ}%` } } } },
        ],
      }
    : undefined;

  const isNameSort = sortField === 'name';
  const orderDirection = sortDir === 'asc' ? OrderDirection.Asc : OrderDirection.Desc;

  // Data fetching — the whole (searched) list; sorting by name on the server
  const { data, previousData, loading, error, refetch } = useAllRows(GET_PERSONS, {
    field: 'persons',
    variables: {
      where,
      orderBy: {
        sortName: { direction: isNameSort ? orderDirection : OrderDirection.Asc, priority: 2 },
        // Paging needs one fixed order, and two people can share a name.
        id: { direction: OrderDirection.Asc, priority: 1 },
      },
    },
  });

  const displayData = data ?? previousData;
  const { data: labelsData } = useAllRows(GET_LABELS, { field: 'labels' });

  // The dashboard and the network graph list people too, so the field goes, not one query.
  const [createPerson] = useMutation(CREATE_PERSON, {
    update: (cache) => invalidateQueryFields(cache, ['persons']),
  });
  const [createPersonEmail] = useMutation(CREATE_PERSON_EMAIL, {
    update: (cache) => invalidateQueryFields(cache, ['persons']),
  });
  const [deletePerson] = useMutation(DELETE_PERSON, {
    update: (cache) => invalidateQueryFields(cache, ['persons']),
  });

  const [dialogOpen, setDialogOpen] = useState(false);

  // FAB and other screens can deep-link the create dialog via /persons?new=1
  useEffect(() => {
    if (newParam) {
      setDialogOpen(true);
      router.setParams({ new: undefined });
    }
  }, [newParam, router]);

  // Shape raw data
  const rawPersons: PersonRowData[] = (displayData?.persons ?? []).map((p) => ({
    id: p.id,
    displayName: p.displayName,
    sortName: p.sortName,
    avatarPath: p.avatarPath,
    labels: p.labels ?? [],
    contactInfos: p.contactInfos ?? [],
    lastContactedAt: p.interactions[0]?.occurredAt ?? null,
  }));

  // Client-side sort for lastContacted (server can't sort by relation)
  const sortedPersons = isNameSort
    ? rawPersons
    : [...rawPersons].sort((a, b) => {
        const aTime = a.lastContactedAt ? a.lastContactedAt.getTime() : null;
        const bTime = b.lastContactedAt ? b.lastContactedAt.getTime() : null;
        const isNeitherContacted = aTime === null && bTime === null;
        if (isNeitherContacted) {
          return 0;
        }
        if (aTime === null) {
          return 1;
        }
        if (bTime === null) {
          return -1;
        }
        return sortDir === 'asc' ? aTime - bTime : bTime - aTime;
      });

  // Label filtering (client-side — server cannot filter by nested relation)
  const hasLabelFilter = activeLabelIds.length > 0;
  const filteredPersons = hasLabelFilter
    ? sortedPersons.filter((p) => activeLabelIds.every((id) => p.labels.some((l) => l.id === id)))
    : sortedPersons;

  const allLabels = (labelsData?.labels ?? []).map((l) => ({ id: l.id, label: l.label, color: l.color }));

  // Handlers

  const handleDelete = async (id: string): Promise<void> => {
    await deletePerson({ variables: { id } });
  };

  const handleSubmit = async ({ person, email }: PersonFormValue): Promise<void> => {
    const { data: created } = await createPerson({ variables: { values: person } });
    const personId = created?.createPerson?.id;
    if (personId && email) {
      // The person is saved by now. A refused address is reported, and can be added on their page.
      await createPersonEmail({ variables: { personId, value: email } });
    }
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
    const field = SORT_FIELDS.find((known) => known === value.slice(0, dashIndex));
    const dir = SORT_DIRS.find((known) => known === value.slice(dashIndex + 1));
    // The picker only offers pairs of the two lists above, so anything else is not a sort to apply.
    const isUnknownSort = field === undefined || dir === undefined;
    if (isUnknownSort) {
      return;
    }
    setUrlState({ sortField: field, sortDir: dir });
  };

  const pending = !displayData && loading;
  const showsQueryState = pending || error !== undefined;

  return (
    <>
      {/* Above the load guard, so /persons?new=1 opens the form while the list is still arriving. */}
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="New Person"
        description="Add a new person to your CRM."
        className="sm:max-w-xl"
      >
        <PersonForm
          availableLabels={labelsData?.labels ?? []}
          onSubmit={handleSubmit}
          onCancel={() => setDialogOpen(false)}
        />
      </FormDialog>

      {showsQueryState ? (
        <PageLayout
          title="People"
          contentSlot={
            <QueryState
              query={{ isPending: pending, isError: error !== undefined, error, refetch }}
              what="your people"
              count={filteredPersons.length}
            />
          }
        />
      ) : (
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
          onAddPress={() => setDialogOpen(true)}
          onDeletePress={handleDelete}
          // The row's last-contact line reads the newest interaction.
          onLogged={() => refetch()}
          onRefresh={refetch}
        />
      )}
    </>
  );
}
