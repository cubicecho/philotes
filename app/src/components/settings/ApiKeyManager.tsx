import { gql, useMutation, useQuery } from '@apollo/client';
import { Key, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateApiKeyDialog } from './CreateApiKeyDialog';

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

export function ApiKeyManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, refetch } = useQuery<{ myApiKeys: ApiKeyRecord[] }>(MY_API_KEYS);
  const [revokeApiKey, { loading: revoking }] = useMutation(MY_REVOKE_API_KEY, {
    refetchQueries: ['MyApiKeys'],
  });

  const keys = data?.myApiKeys ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Keys / Calendar Access
              </CardTitle>
              <CardDescription className="mt-1">
                Generate a key to subscribe your important dates (birthdays, anniversaries, etc.) into any calendar app
                via a private URL at <code className="text-xs">/ical?key=…</code>
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Generate Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No keys yet. Generate one to get your calendar subscription URL.
            </p>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div key={key.id} className="flex items-start justify-between rounded-md border p-3 gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{key.name}</span>
                      <code className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                        phlt_{key.keyPrefix}…
                      </code>
                    </div>
                    <div className="mt-1.5 text-xs text-muted-foreground space-x-3">
                      <span>
                        Last used: <span className="text-foreground">{formatRelative(key.lastUsedAt)}</span>
                      </span>
                      {key.expiresAt ? (
                        <span>
                          Expires: <span className="text-foreground">{formatDate(key.expiresAt)}</span>
                        </span>
                      ) : null}
                      <span>
                        Created: <span className="text-foreground">{formatDate(key.createdAt)}</span>
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={revoking}
                    onClick={() => revokeApiKey({ variables: { id: key.id } })}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateApiKeyDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => refetch()} />
    </>
  );
}
