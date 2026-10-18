import { useMutation } from '@apollo/client';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { EmptyState } from '@/components/page';
import { Button } from '@/components/ui/button';
import { CircleAlert } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/spinner';
import { setToken } from '@/lib/auth';

const VERIFY_ONE_TIME_TOKEN = graphql(`
  mutation VerifyOneTimeToken($token: String!) {
    verifyOneTimeToken(token: $token) {
      token
    }
  }
`);

/**
 * Where a sign-in through the OIDC provider lands. The server's callback opened a session and put a
 * one-time token for it on this URL; this swaps the token for the session, once, and opens the app.
 */
export default function SsoPage() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  // The token is spent on first use, so a re-run effect must not send it twice.
  const started = useRef(false);

  const [verify, { error }] = useMutation(VERIFY_ONE_TIME_TOKEN, {
    onCompleted(data) {
      setToken(data.verifyOneTimeToken.token);
      router.replace('/');
    },
    onError() {
      // Rendered from `error` below.
    },
  });

  useEffect(() => {
    const hasNothingToSend = started.current || !token;
    if (hasNothingToSend) {
      return;
    }
    started.current = true;
    verify({ variables: { token } });
  }, [token, verify]);

  const failed = error !== undefined || !token;

  return (
    <View role="main" className="min-h-full flex-1 items-center justify-center bg-background p-4">
      {failed ? (
        <EmptyState
          icon={CircleAlert}
          level={1}
          title="That sign-in didn't work. A sign-in has to be finished within a few minutes, and only once."
          actionSlot={<Button variant="outline" linkSlot={<Link href="/login" />} content="Back to sign in" />}
        />
      ) : (
        <View className="flex-row items-center gap-2">
          <Spinner label="Signing you in" />
          <Text className="text-foreground/60">Signing you in…</Text>
        </View>
      )}
    </View>
  );
}
