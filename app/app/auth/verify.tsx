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

const VERIFY_MAGIC_LINK = graphql(`
  mutation VerifyMagicLink($token: String!) {
    verifyMagicLink(token: $token) {
      token
    }
  }
`);

export default function VerifyPage() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  // A link's token is spent on first use, so a re-run effect must not send it twice.
  const started = useRef(false);

  const [verify, { error }] = useMutation(VERIFY_MAGIC_LINK, {
    onCompleted(data) {
      setToken(data.verifyMagicLink.token);
      router.replace('/');
    },
    onError() {
      // Rendered from `error` below.
    },
  });

  useEffect(() => {
    if (started.current || !token) {
      return;
    }
    started.current = true;
    verify({ variables: { token } });
  }, [token, verify]);

  return (
    <View role="main" className="min-h-full flex-1 items-center justify-center bg-background p-4">
      {error ? (
        <EmptyState
          icon={CircleAlert}
          level={1}
          title="This sign-in link is invalid or has expired. Request a new one."
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
