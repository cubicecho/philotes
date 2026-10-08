import { useQuery } from '@apollo/client';
import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { GitMerge } from '@/components/app-icons';
import { DuplicateGroupCard, type DuplicatePerson } from '@/components/domain/person/duplicate-group';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { QueryState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from '@/components/ui/icons';
import { primaryEmail } from '@/lib/primary-contact';
import { useAllRows } from '@/lib/use-all-rows';

const GET_POTENTIAL_DUPLICATES = graphql(`
  query GetPotentialDuplicates {
    potentialDuplicates {
      matchValue
      matchType
      personIds
    }
  }
`);

const GET_PERSONS_FOR_DEDUPE = graphql(`
  query GetPersonsForDedupe($limit: Int!, $offset: Int!) {
    persons(
      limit: $limit
      offset: $offset
      orderBy: { sortName: { direction: asc, priority: 2 }, id: { direction: asc, priority: 1 } }
    ) {
      id
      displayName
      contactInfos(where: { type: { eq: email } }, limit: 5) {
        id
        type
        value
        isPrimary
      }
    }
  }
`);

/** The duplicates page: the groups of people who share a contact detail, each to merge or dismiss. */
export default function DedupePage() {
  // Read fresh each visit: a detail added on another page can make a new group.
  const duplicates = useQuery(GET_POTENTIAL_DUPLICATES, { fetchPolicy: 'cache-and-network' });
  const people = useAllRows(GET_PERSONS_FOR_DEDUPE, { field: 'persons' });
  // Dismissals last for the visit; nothing is stored.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const personById = new Map<string, DuplicatePerson>(
    (people.data?.persons ?? []).map((p) => [p.id, { ...p, email: primaryEmail(p.contactInfos ?? []) }]),
  );
  const groups = (duplicates.data?.potentialDuplicates ?? [])
    .map((group) => ({
      ...group,
      key: `${group.matchType}:${group.matchValue}`,
      persons: group.personIds.flatMap((id) => personById.get(id) ?? []),
    }))
    // A merge elsewhere on the page can leave a group with one person until the refetch lands.
    .filter((group) => group.persons.length > 1 && dismissed.has(group.key) === false);

  const error = duplicates.error ?? people.error;
  const pending = (duplicates.loading && !duplicates.data) || (people.loading && !people.data);
  const refetch = async (): Promise<void> => {
    await Promise.all([duplicates.refetch(), people.refetch()]);
  };

  const backLink = (
    <Link href="/persons" asChild>
      <Button variant="link" size="xs" iconSlot={<ArrowLeft />} content="Back to People" />
    </Link>
  );

  const showsQueryState = pending || error !== undefined;

  return (
    <PageLayout
      title="Find Duplicates"
      description="People who share an email, phone number or other contact detail."
      iconSlot={<GitMerge />}
      breadcrumbsSlot={backLink}
      contentSlot={
        showsQueryState ? (
          <QueryState
            query={{ isPending: pending, isError: error !== undefined, error, refetch }}
            what="possible duplicates"
            count={groups.length}
          />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={GitMerge}
            title="No duplicates found"
            description="Nobody in your people shares a contact detail with anyone else."
          />
        ) : (
          <View className="gap-4">
            {groups.map((group) => (
              <DuplicateGroupCard
                key={group.key}
                matchValue={group.matchValue}
                matchType={group.matchType}
                persons={group.persons}
                onMerged={refetch}
                onDismiss={() => setDismissed((prev) => new Set(prev).add(group.key))}
              />
            ))}
          </View>
        )
      }
    />
  );
}
