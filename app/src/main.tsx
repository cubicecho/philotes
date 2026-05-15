import { ApolloClient, ApolloProvider, from, HttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { scalarTypePolicies } from './__generated__/type-policies.js';
import { clearToken, getToken } from './lib/auth.js';
import { routeTree } from './routeTree.gen';
import './index.css';

const graphqlUri = import.meta.env.DEV
  ? `http://localhost:${import.meta.env.VITE_SERVER_PORT}/graphql`
  : '/graphql';
const httpLink = new HttpLink({ uri: graphqlUri });

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
    window.location.href = '/login';
  }
});

const client = new ApolloClient({
  cache: new InMemoryCache({ typePolicies: scalarTypePolicies }),
  dataMasking: true,
  link: from([errorLink, authLink, httpLink]),
});

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <RouterProvider router={router} />
    </ApolloProvider>
  </React.StrictMode>,
);
