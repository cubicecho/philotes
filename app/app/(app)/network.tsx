import { useQuery } from '@apollo/client';
import { useRouter } from 'expo-router';
import { graphql } from '@/__generated__/gql';
import { Users } from '@/components/app-icons';
import { NetworkGraph } from '@/components/domain/network/graph';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { QueryState } from '@/components/query-state';

const GET_NETWORK_DATA = graphql(`
  query GetNetworkData {
    persons {
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
      relationshipsFrom {
        id
        toPersonId
        type
      }
    }
  }
`);

export default function NetworkPage() {
  const router = useRouter();
  const { data, loading, error, refetch } = useQuery(GET_NETWORK_DATA);

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
