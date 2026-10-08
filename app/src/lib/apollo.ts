import { ApolloClient, from, HttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { scalarTypePolicies } from '@/__generated__/type-policies';
import { graphqlUrl } from '@/lib/api-url';
import { authHeaders, clearToken, isAuthenticated } from '@/lib/auth';
import { keepCache } from '@/lib/cache-store';
// Imported for what it does at import: it restores the server address a device was given.
import '@/lib/server-address';

// The address is read at each request, since a device is told where its server is after this is built.
const httpLink = new HttpLink({ uri: () => graphqlUrl() });

const authLink = setContext((_, { headers }) => ({ headers: { ...headers, ...authHeaders() } }));

/** The sign-in operations, where UNAUTHENTICATED means wrong credentials and the page shows it. */
const SIGN_IN_OPERATIONS = new Set(['SignIn', 'SignUp', 'RequestSignIn', 'VerifyMagicLink']);

const LOGIN_ROUTE = '/login';

/** Leaves for the sign-in page with nothing of the ended session left in memory. */
function openLogin(): void {
  if (Platform.OS === 'web') {
    // A full load, which also drops the cache.
    window.location.replace(LOGIN_ROUTE);
    return;
  }
  router.replace(LOGIN_ROUTE);
  forgetCachedData().catch((error: unknown) => {
    console.error('Could not clear the cache after the session ended', error);
  });
}

const errorLink = onError(({ graphQLErrors, operation }) => {
  const isSignedOut = graphQLErrors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED') ?? false;
  const isSigningIn = SIGN_IN_OPERATIONS.has(operation.operationName);
  const hasExpiredSession = isSignedOut && isSigningIn === false;
  if (hasExpiredSession) {
    clearToken();
    openLogin();
  }
});

const cache = new InMemoryCache({ typePolicies: scalarTypePolicies });

/** The copy of the cache a device keeps between runs. */
const cacheStore = keepCache(cache);

/** The app's Apollo client. It sends the session token, and signs out on UNAUTHENTICATED outside sign-in. */
export const client = new ApolloClient({
  cache,
  link: from([errorLink, authLink, httpLink]),
});

/** Whether the cache has to be filled from the device before the first screen is drawn. */
export const RESTORES_CACHE = cacheStore.isKept;

/**
 * Fills the cache with what the device kept from the last run. Without a session there is nobody the
 * copy could belong to, and it is deleted instead.
 *
 * @returns Once the cache is ready to read. Never rejects.
 */
export async function restoreCachedData(): Promise<void> {
  if (isAuthenticated()) {
    await cacheStore.restore();
    return;
  }
  await cacheStore.forget();
}

/**
 * Drops everything fetched in a session, from memory and from the device. Called wherever a session
 * ends: what was fetched belongs to the user and the server it came from.
 */
export async function forgetCachedData(): Promise<void> {
  await client.clearStore();
  await cacheStore.forget();
}
