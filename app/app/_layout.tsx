import { ApolloClient, ApolloProvider, from, HttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { clearToken, getToken } from '@/lib/auth';
import '../global.css';
import '../src/index.css';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

const httpLink = new HttpLink({ uri: `${API_URL}/graphql` });

const authLink = setContext((_, { headers }) => {
  const token = getToken();
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

const errorLink = onError(({ graphQLErrors }) => {
  if (graphQLErrors?.some((e) => e.extensions?.['code'] === 'UNAUTHENTICATED')) {
    clearToken();
    if (Platform.OS === 'web') window.location.replace('/login');
  }
});

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: from([errorLink, authLink, httpLink]),
});

export default function RootLayout() {
  return (
    <ApolloProvider client={client}>
      <Stack screenOptions={{ headerShown: false }} />
    </ApolloProvider>
  );
}
