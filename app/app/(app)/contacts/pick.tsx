import { useApolloClient } from '@apollo/client';
import { useState } from 'react';
import { FlatList, Text } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { Users } from '@/components/app-icons';
import { ListItem } from '@/components/list-item';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { usePeople } from '@/hooks/use-people';
import { finishPick } from '@/lib/contacts-native';
import { messageOf } from '@/lib/error-message';
import { PeopleSort, SortDirection, searchPeople, sortPeople } from '@/lib/people';

const PERSON_UID = graphql(`
  query PersonUid($id: UUID!) {
    person(where: { id: { eq: $id } }) {
      id
      uid
    }
  }
`);

/**
 * Where another app's "Choose a contact" lands. Choosing a person hands that app the phone contact
 * DAVx5 keeps for them, and closes Philotes.
 */
export default function PickContactPage() {
  const client = useApolloClient();
  const everyone = usePeople();
  const [search, setSearch] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const people = sortPeople(searchPeople(everyone.people ?? [], search), PeopleSort.Name, SortDirection.Ascending);

  /** Sends the chosen person back, or says why they cannot be. */
  async function choose(id: string): Promise<void> {
    setProblem(null);
    try {
      const { data } = await client.query({ query: PERSON_UID, variables: { id } });
      const uid = data.person?.uid ?? null;
      const isSent = uid !== null && (await finishPick(uid));
      if (isSent === false) {
        setProblem('This person has no phone contact yet. Sync DAVx5 and try again.');
      }
    } catch (error) {
      console.error('The contact could not be chosen', error);
      setProblem(messageOf(error) ?? 'The contact could not be chosen.');
    }
  }

  const hasList = everyone.people !== undefined;

  return (
    <PageLayout
      title="Choose a person"
      scroll={false}
      actionSlot={<Button variant="outline" content="Cancel" onPress={() => void finishPick(null)} />}
      headerContentSlot={
        <>
          <SearchInput label="Search people" value={search} onChangeText={setSearch} />
          {problem === null ? null : <Text className="text-negative text-sm">{problem}</Text>}
        </>
      }
      contentSlot={
        hasList ? (
          <FlatList
            className="min-h-0 flex-1"
            data={people}
            keyExtractor={(person) => person.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<EmptyState icon={Users} title="No one matches." />}
            renderItem={({ item }) => <ListItem title={item.displayName} onPress={() => void choose(item.id)} />}
          />
        ) : (
          <QueryState
            query={{
              isPending: everyone.error === undefined,
              isError: everyone.error !== undefined,
              error: everyone.error,
              refetch: () => everyone.refresh(),
            }}
            what="your people"
            count={0}
          />
        )
      }
    />
  );
}
