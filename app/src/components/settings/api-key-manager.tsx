import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { Text } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { ConfirmButton } from '@/components/confirm-button';
import { ListItem } from '@/components/list-item';
import { EmptyState } from '@/components/page';
import { QueryState } from '@/components/query-state';
import { Section } from '@/components/section';
import { Button } from '@/components/ui/button';
import { Plus } from '@/components/ui/icons';
import { formatDate } from '@/lib/format';
import { relativeTime } from '@/lib/relative-time';
import { CreateApiKeyDialog } from './create-api-key-dialog';

const MY_API_KEYS = graphql(`
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
`);

const MY_REVOKE_API_KEY = graphql(`
  mutation MyRevokeApiKey($id: ID!) {
    myRevokeApiKey(id: $id)
  }
`);

/** An API key as the list shows it. The token itself is never read back. */
interface ApiKeyRecord {
  id: string;
  name: string;
  /** The stored prefix of the token, shown after `phlt_` to tell one key from another. */
  keyPrefix: string;
  /** An ISO timestamp; `null` for a key never used. */
  lastUsedAt: string | null;
  /** An ISO timestamp; `null` for a key that does not expire. */
  expiresAt: string | null;
  createdAt: string;
}

/** What stands in for a date the key does not have. */
const NO_DATE = '—';

/**
 * A key's dates on one line.
 *
 * @param key - The key.
 * @returns When it was last used, when it expires if it does, and when it was made, joined by ` · `.
 */
function keyDetails(key: ApiKeyRecord): string {
  return [
    `Last used: ${key.lastUsedAt ? relativeTime(new Date(key.lastUsedAt)) : 'never'}`,
    key.expiresAt ? `Expires: ${formatDate(key.expiresAt) || NO_DATE}` : null,
    `Created: ${formatDate(key.createdAt) || NO_DATE}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The settings card of the user's API keys: each one revocable, and the dialog that generates another. */
export function ApiKeyManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, loading, error, refetch } = useQuery(MY_API_KEYS);
  const [revokeApiKey, { loading: revoking }] = useMutation(MY_REVOKE_API_KEY, {
    refetchQueries: ['MyApiKeys'],
  });

  const keys = data?.myApiKeys ?? [];
  // Only the first load: a refetch after a key is made or revoked keeps the list on screen.
  const pending = loading && !data;
  const showsQueryState = pending || error !== undefined || keys.length === 0;

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
          showsQueryState ? (
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
                className="rounded-lg border border-foreground/10"
                title={key.name}
                description={keyDetails(key)}
                meta={<Text className="font-mono text-foreground/60 text-xs">{`phlt_${key.keyPrefix}…`}</Text>}
                actionSlot={
                  <ConfirmButton
                    size="sm"
                    variant="destructive"
                    disabled={revoking}
                    label={`Revoke ${key.name}`}
                    content="Revoke"
                    title={`Revoke ${key.name}?`}
                    description="Every calendar subscribed with this key stops updating, and the key cannot be restored. A new key gives a new URL."
                    confirmLabel="Revoke"
                    onConfirm={() => void revokeApiKey({ variables: { id: key.id } })}
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
