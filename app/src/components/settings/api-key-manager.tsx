import { gql, useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { Text } from 'react-native';
import { ListItem } from '@/components/list-item';
import { EmptyState } from '@/components/page';
import { QueryState } from '@/components/query-state';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Plus } from '@/components/ui/icons';
import { formatDate } from '@/lib/format';
import { relativeTime } from '@/lib/relative-time';
import { CreateApiKeyDialog } from './create-api-key-dialog';

const MY_API_KEYS = gql`
  query MyApiKeys {
    myApiKeys {
      id
      name
      keyPrefix
      lastUsedAt
      expiresAt
      createdAt
    }
  }
`;

const MY_REVOKE_API_KEY = gql`
  mutation MyRevokeApiKey($id: ID!) {
    myRevokeApiKey(id: $id)
  }
`;

interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** What stands in for a date the key does not have. */
const NO_DATE = '—';

function keyDetails(key: ApiKeyRecord): string {
  return [
    `Last used: ${key.lastUsedAt ? relativeTime(new Date(key.lastUsedAt)) : 'never'}`,
    key.expiresAt ? `Expires: ${formatDate(key.expiresAt) || NO_DATE}` : null,
    `Created: ${formatDate(key.createdAt) || NO_DATE}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function ApiKeyManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, loading, error, refetch } = useQuery<{ myApiKeys: ApiKeyRecord[] }>(MY_API_KEYS);
  const [revokeApiKey, { loading: revoking }] = useMutation(MY_REVOKE_API_KEY, {
    refetchQueries: ['MyApiKeys'],
  });

  const keys = data?.myApiKeys ?? [];
  // Only the first load: a refetch after a key is made or revoked keeps the list on screen.
  const pending = loading && !data;

  return (
    <>
      <Section
        surface="card"
        title="API Keys / Calendar Access"
        description="Generate a key to subscribe your important dates (birthdays, anniversaries, etc.) into any calendar app via a private URL at /ical?key=…"
        actionSlot={
          <Button
            size="sm"
            variant="outline"
            iconSlot={<Plus />}
            content="Generate Key"
            onPress={() => setDialogOpen(true)}
          />
        }
        contentSlot={
          pending || error || keys.length === 0 ? (
            <QueryState
              compact
              query={{ isPending: pending, isError: error !== undefined, error, refetch }}
              what="your API keys"
              count={keys.length}
              emptySlot={
                <EmptyState compact title="No keys yet. Generate one to get your calendar subscription URL." />
              }
            />
          ) : (
            keys.map((key) => (
              <ListItem
                key={key.id}
                className="rounded-lg border border-border"
                title={key.name}
                description={keyDetails(key)}
                meta={<Text className="font-mono text-muted-foreground text-xs">{`phlt_${key.keyPrefix}…`}</Text>}
                actionSlot={
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={revoking}
                    content="Revoke"
                    onPress={() => revokeApiKey({ variables: { id: key.id } })}
                  />
                }
              />
            ))
          )
        }
      />

      <CreateApiKeyDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => refetch()} />
    </>
  );
}
