import { gql, useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { Text } from 'react-native';
import { ListItem } from '@/components/list-item';
import { EmptyState } from '@/components/page';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Plus } from '@/components/ui/icons';
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

function formatRelative(dateVal: string | null): string {
  if (!dateVal) return 'never';
  const date = new Date(dateVal);
  if (Number.isNaN(date.getTime())) return 'never';
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatDate(dateVal: string | null): string {
  if (!dateVal) return '—';
  const date = new Date(dateVal);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function keyDetails(key: ApiKeyRecord): string {
  return [
    `Last used: ${formatRelative(key.lastUsedAt)}`,
    key.expiresAt ? `Expires: ${formatDate(key.expiresAt)}` : null,
    `Created: ${formatDate(key.createdAt)}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function ApiKeyManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, refetch } = useQuery<{ myApiKeys: ApiKeyRecord[] }>(MY_API_KEYS);
  const [revokeApiKey, { loading: revoking }] = useMutation(MY_REVOKE_API_KEY, {
    refetchQueries: ['MyApiKeys'],
  });

  const keys = data?.myApiKeys ?? [];

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
          keys.length === 0 ? (
            <EmptyState compact title="No keys yet. Generate one to get your calendar subscription URL." />
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
