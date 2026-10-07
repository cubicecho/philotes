import { useRouter } from 'expo-router';
import { graphql } from '@/__generated__/gql';
import { Users } from '@/components/app-icons';
import { NetworkGraph } from '@/components/domain/network/graph';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { QueryState } from '@/components/query-state';
import { useAllRows } from '@/lib/use-all-rows';

const GET_NETWORK_DATA = graphql(`
  query GetNetworkData($limit: Int!, $offset: Int!) {
    persons(
      limit: $limit
      offset: $offset
      orderBy: { createdAt: { direction: asc, priority: 1 }, id: { direction: asc, priority: 2 } }
    ) {
      id
      firstName
      lastName
      email
      avatarPath
      labels(limit: 20) {
        id
        label
        color
      }
      relationshipsFrom(limit: 50) {
        id
        toPersonId
        type
      }
    }
  }
`);

/** A person here carries up to 50 relationships, so a page is smaller than the default to stay inside the server's cost limit. */
const NETWORK_PAGE_SIZE = 40;

export default function NetworkPage() {
  const router = useRouter();
  const { data, loading, error, refetch } = useAllRows(GET_NETWORK_DATA, {
    field: 'persons',
    pageSize: NETWORK_PAGE_SIZE,
  });

  const persons = data?.persons ?? [];
  const pending = loading && !data;

  return (
    // The graph pans and zooms inside its own box, so the page does not scroll around it.
    <PageLayout
      title="Network"
      width="full"
      scroll={false}
      contentClassName="flex-1"
      contentSlot={
        pending || error ? (
          <QueryState
            query={{ isPending: pending, isError: error !== undefined, error, refetch }}
            what="your network"
            count={persons.length}
          />
        ) : persons.length === 0 ? (
          <EmptyState icon={Users} title="No contacts yet." />
        ) : (
          <NetworkGraph persons={persons} onOpenPerson={(id) => router.push(`/persons/${id}`)} />
        )
      }
    />
  );
}
