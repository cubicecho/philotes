import { gql, useMutation } from '@apollo/client';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MY_CREATE_API_KEY = gql`
  mutation MyCreateApiKey($input: CreateApiKeyInput!) {
    myCreateApiKey(input: $input) {
      apiKey {
        id
        name
        keyPrefix
        createdAt
      }
      token
    }
  }
`;

const EXPIRY_OPTIONS = [
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
  { label: '1 year', value: '365' },
  { label: 'No expiry', value: '' },
] as const;

type Phase = { phase: 'form' } | { phase: 'reveal'; token: string };

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function copyToClipboard(text: string, onDone: () => void) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(onDone).catch(() => {
      legacyCopy(text);
      onDone();
    });
  } else {
    legacyCopy(text);
    onDone();
  }
}

function legacyCopy(text: string) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    copyToClipboard(value, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} type="button">
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      {label && <span className="ml-1.5">{copied ? 'Copied!' : label}</span>}
    </Button>
  );
}

export function CreateApiKeyDialog({ open, onOpenChange, onCreated }: CreateApiKeyDialogProps) {
  const [state, setState] = useState<Phase>({ phase: 'form' });
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [nameError, setNameError] = useState('');

  const [createApiKey, { loading }] = useMutation<{
    myCreateApiKey: { apiKey: { id: string; name: string; keyPrefix: string }; token: string };
  }>(MY_CREATE_API_KEY);

  function handleClose(value: boolean) {
    if (!value) {
      if (state.phase === 'reveal') onCreated();
      setState({ phase: 'form' });
      setName('');
      setExpiry('');
      setNameError('');
    }
    onOpenChange(value);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }

    let expiresAt: string | undefined;
    if (expiry) {
      const d = new Date();
      d.setDate(d.getDate() + Number(expiry));
      const pad = (n: number) => n.toString().padStart(2, '0');
      expiresAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;
    }

    const result = await createApiKey({ variables: { input: { name: name.trim(), expiresAt } } });
    const token = result.data?.myCreateApiKey?.token;
    if (token) setState({ phase: 'reveal', token });
  }

  const icalUrl =
    state.phase === 'reveal'
      ? `${window.location.origin}/ical?key=${state.token}`
      : '';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {state.phase === 'form' ? (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Generate API Key</DialogTitle>
              <DialogDescription>
                Create an API key to subscribe to your important dates calendar in any calendar
                app. The full token is shown only once.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="api-key-name">Name</Label>
                <Input
                  id="api-key-name"
                  placeholder="e.g. Google Calendar"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError('');
                  }}
                  maxLength={60}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key-expiry">Expiry</Label>
                <select
                  id="api-key-expiry"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {EXPIRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Generating…' : 'Generate Key'}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>API Key Generated</DialogTitle>
              <DialogDescription>
                Copy the calendar URL below and paste it into your calendar app. The token will
                not be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                  Store your token securely — it will not be shown again.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Calendar Subscription URL
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs font-mono">
                    {icalUrl}
                  </code>
                  <CopyButton value={icalUrl} label="Copy URL" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste this URL into Google Calendar → "Other calendars" → "From URL", or Apple
                  Calendar → File → New Calendar Subscription.
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Raw Token
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs font-mono">
                    {state.token}
                  </code>
                  <CopyButton value={state.token} />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleClose(false)}>Done</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
