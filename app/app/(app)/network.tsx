import { useRouter } from 'expo-router';
import { graphql } from '@/__generated__/gql';
import { Users } from '@/components/app-icons';
import { NetworkGraph } from '@/components/domain/network/graph';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { QueryState } from '@/components/query-state';
import { PAGE_SIZE_DEFAULTS } from '@/lib/defaults';
import { useAllRows } from '@/lib/use-all-rows';

const GET_NETWORK_DATA = graphql(`
  query GetNetworkData($limit: Int!, $offset: Int!) {
    persons(
      limit: $limit
      offset: $offset
      orderBy: { createdAt: { direction: asc, priority: 2 }, id: { direction: asc, priority: 1 } }
    ) {
      id
      displayName
      avatarPath
      contactInfos(where: { type: { eq: email } }, limit: 5) {
        id
        type
        value
        isPrimary
      }
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

/** The network page: every person and their relationships, drawn as a graph. */
export default function NetworkPage() {
  const router = useRouter();
  const { data, loading, error, refetch } = useAllRows(GET_NETWORK_DATA, {
    field: 'persons',
    pageSize: PAGE_SIZE_DEFAULTS.network,
  });

  const persons = data?.persons ?? [];
  const pending = loading && !data;
  // What is already here stays on the page when a refresh fails, as it does with no connection.
  const hasFailedEmpty = error !== undefined && data === undefined;
  const showsQueryState = pending || hasFailedEmpty;
  const graphSlot =
    persons.length === 0 ? (
      <EmptyState icon={Users} title="No contacts yet." />
    ) : (
      <NetworkGraph persons={persons} onOpenPerson={(id) => router.push(`/persons/${id}`)} />
    );

  return (
    // The graph pans and zooms inside its own box, so the page does not scroll around it.
    <PageLayout
      title="Network"
      width="full"
      scroll={false}
      contentClassName="flex-1"
      contentSlot={
        showsQueryState ? (
          <QueryState
            query={{ isPending: pending, isError: error !== undefined, error, refetch }}
            what="your network"
            count={persons.length}
          />
        ) : (
          graphSlot
        )
      }
    />
  );
}
