import { ApolloClient, from, HttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { Platform } from 'react-native';
import { scalarTypePolicies } from '@/__generated__/type-policies';
import { API_URL } from '@/lib/api-url';
import { clearToken, getToken } from '@/lib/auth';

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
  if (graphQLErrors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED')) {
    clearToken();
    if (Platform.OS === 'web') {
      window.location.replace('/login');
    }
  }
});

export const client = new ApolloClient({
  cache: new InMemoryCache({ typePolicies: scalarTypePolicies }),
  link: from([errorLink, authLink, httpLink]),
});
