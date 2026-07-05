import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const REQUEST_MAGIC_LINK = graphql(`
  mutation RequestMagicLink($email: String!) {
    requestMagicLink(email: $email) {
      ok
      magicLink
    }
  }
`);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);

  const [requestLink, { loading, error }] = useMutation(REQUEST_MAGIC_LINK, {
    onCompleted(data) {
      setMagicLink(data.requestMagicLink.magicLink ?? null);
      setSubmitted(true);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    requestLink({ variables: { email } });
  }

  if (submitted && magicLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm p-8">
          <h1 className="text-2xl font-semibold mb-2">Your magic link</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Click the link below to sign in as <strong>{email}</strong>.
          </p>
          <a
            href={magicLink}
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign in →
          </a>
          <p className="mt-6 text-xs text-muted-foreground">
            This link is shown here because the server is running in development mode.
          </p>
        </div>
      </div>
    );
  }

  if (submitted && !magicLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm p-8">
          <h1 className="text-2xl font-semibold mb-2">Check your email</h1>
          <p className="text-sm text-muted-foreground mb-4">
            We sent a magic link to <strong>{email}</strong>. Click it to sign in.
          </p>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setEmail('');
            }}
            className="text-sm underline text-muted-foreground"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 p-6 border rounded-lg shadow-sm bg-card">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted-foreground">Enter your email and we'll send you a magic link.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error.message}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending…' : 'Send magic link'}
          </Button>
        </form>
      </div>
    </div>
  );
}
