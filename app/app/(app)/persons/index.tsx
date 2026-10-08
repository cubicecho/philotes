import { useMutation } from '@apollo/client';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { graphql } from '@/__generated__/gql';
import { OrderDirection, type PersonFilters, type PersonRowFragment } from '@/__generated__/graphql';
import { PersonForm, type PersonFormValue } from '@/components/domain/person/form';
import { PersonList, type PersonRowData } from '@/components/domain/person/list';
import { PageLayout } from '@/components/page-layout';
import { QueryState } from '@/components/query-state';
import { FormDialog } from '@/components/ui/form-dialog';
import { usePeople } from '@/hooks/use-people';
import { useQueryStringState } from '@/hooks/use-query-string-state';
import { useIsOffline } from '@/lib/connection';
import { SEARCH_DEFAULTS } from '@/lib/defaults';
import { invalidateQueryFields } from '@/lib/invalidate';
import { PeopleSort, SortDirection, searchPeople, sortPeople } from '@/lib/people';
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

// The search, which the server runs whenever it can be reached. The whole list is not read here:
// `usePeople` keeps it.
const SEARCH_PERSONS = graphql(`
  query SearchPersons($where: PersonFilters, $orderBy: PersonOrderBy, $limit: Int!, $offset: Int!) {
    persons(where: $where, orderBy: $orderBy, limit: $limit, offset: $offset) {
      ...PersonRow
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

const SORT_FIELDS: readonly PeopleSort[] = Object.values(PeopleSort);
const SORT_DIRS: readonly SortDirection[] = Object.values(SortDirection);

/** The order the search is read in. Paging needs one fixed order, and two people can share a name. */
const SEARCH_ORDER = {
  sortName: { direction: OrderDirection.Asc, priority: 2 },
  id: { direction: OrderDirection.Asc, priority: 1 },
} as const;

/** Reads everyone's last contact as well as what changed: the refresh for someone who asked for one. */
const THOROUGH = { withLastContact: true } as const;

/**
 * Shapes a person for the list.
 *
 * @param person - The person as the API or the cache gives them.
 * @returns The row.
 */
function toRow(person: PersonRowFragment): PersonRowData {
  return {
    id: person.id,
    displayName: person.displayName,
    sortName: person.sortName,
    avatarPath: person.avatarPath,
    labels: person.labels,
    contactInfos: person.contactInfos,
    lastContactedAt: person.interactions[0]?.occurredAt ?? null,
  };
}

/** What the people list keeps in the URL's query string. */
interface PersonsUrlState {
  /** The search text. */
  q: string;
  /** Ids of the labels a person must carry, all of them, to be listed. */
  labels: string[];
  sortField: PeopleSort;
  sortDir: SortDirection;
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
      sortField: PeopleSort.Name,
      sortDir: SortDirection.Ascending,
    },
    { typeMap: { labels: 'stringArray' } },
  );

  const urlQ = urlState.q ?? '';
  const activeLabelIds = urlState.labels ?? [];
  const sortField: PeopleSort = urlState.sortField ?? PeopleSort.Name;
  const sortDir: SortDirection = urlState.sortDir ?? SortDirection.Ascending;

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

  const isNameSort = sortField === PeopleSort.Name;
  const isSearching = trimmedQ !== '';
  const isOffline = useIsOffline();

  // Everyone, from the device's own copy.
  const everyone = usePeople();
  // The search is the server's whenever the server is there. Until it answers, and for as long as
  // it cannot be reached, the same text is looked for in the copy.
  const search = useAllRows(SEARCH_PERSONS, {
    field: 'persons',
    variables: { where, orderBy: SEARCH_ORDER },
    skip: isSearching === false || isOffline,
  });
  const hasServerMatches = isSearching && isOffline === false && search.loading === false && search.error === undefined;
  const serverMatches = hasServerMatches ? search.data?.persons : undefined;
  const matches = serverMatches ?? searchPeople(everyone.people ?? [], trimmedQ);

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

  // Ordered here, since the copy has no order of its own and the server cannot order by a relation.
  const sortedPersons = sortPeople(matches, sortField, sortDir).map(toRow);

  // Label filtering (client-side — server cannot filter by nested relation)
  const hasLabelFilter = activeLabelIds.length > 0;
  const filteredPersons = hasLabelFilter
    ? sortedPersons.filter((p) => activeLabelIds.every((id) => p.labels.some((l) => l.id === id)))
    : sortedPersons;

  const allLabels = (labelsData?.labels ?? []).map((l) => ({ id: l.id, label: l.label, color: l.color }));

  // Handlers

  const handleDelete = async (id: string): Promise<void> => {
    await deletePerson({ variables: { id } });
    await everyone.refresh();
  };

  const handleSubmit = async ({ person, email }: PersonFormValue): Promise<void> => {
    const { data: created } = await createPerson({ variables: { values: person } });
    const personId = created?.createPerson?.id;
    if (personId && email) {
      // The person is saved by now. A refused address is reported, and can be added on their page.
      await createPersonEmail({ variables: { personId, value: email } });
    }
    setDialogOpen(false);
    await everyone.refresh();
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

  // With a list to show, a failed refresh only leaves it out of date, which the offline banner says.
  const hasList = everyone.people !== undefined;
  const error = hasList ? undefined : everyone.error;
  const pending = hasList === false && error === undefined;
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
              query={{ isPending: pending, isError: error !== undefined, error, refetch: () => everyone.refresh() }}
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
          loading={isSearching && search.loading}
          sortValue={`${sortField}-${sortDir}`}
          onSortChange={handleSortChange}
          grouped={isNameSort}
          onAddPress={() => setDialogOpen(true)}
          onDeletePress={handleDelete}
          // The row's last-contact line reads the newest interaction.
          onLogged={() => void everyone.refresh(THOROUGH)}
          onRefresh={() => everyone.refresh(THOROUGH)}
        />
      )}
    </>
  );
}
