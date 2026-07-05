import { useMutation } from '@apollo/client';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { graphql } from '@/__generated__/gql';
import { setToken } from '@/lib/auth';

const VERIFY_MAGIC_LINK = graphql(`
  mutation VerifyMagicLink($token: String!) {
    verifyMagicLink(token: $token) {
      token
      userId
    }
  }
`);

export default function VerifyPage() {
  const router = useRouter();

  const [verify, { error }] = useMutation(VERIFY_MAGIC_LINK, {
    onCompleted(data) {
      setToken(data.verifyMagicLink.token);
      router.replace('/');
    },
  });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (token) {
      verify({ variables: { token } });
    }
  }, [verify]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm p-8">
          <p className="font-medium text-destructive">
            {error.message.includes('expired')
              ? 'This link has expired. Please request a new one.'
              : 'Invalid magic link.'}
          </p>
          <a href="/login" className="mt-4 block text-sm underline text-muted-foreground">
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Signing you in…</p>
    </div>
  );
}
