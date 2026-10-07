import {
  type ApolloError,
  NetworkStatus,
  type OperationVariables,
  type TypedDocumentNode,
  useQuery,
  type WatchQueryFetchPolicy,
} from '@apollo/client';
import { useEffect, useRef, useState } from 'react';

/** The paging variables every document read by `useAllRows` declares. */
export interface PageVariables {
  limit: number;
  offset: number;
}

/** Rows asked for per request. The server's default page, and what the documents' costs are worked out for. */
export const DEFAULT_PAGE_SIZE = 50;

/** The network states in which the first page is being fetched again, so the later pages are stale. */
const FIRST_PAGE_FETCHES: ReadonlySet<NetworkStatus> = new Set([
  NetworkStatus.loading,
  NetworkStatus.setVariables,
  NetworkStatus.refetch,
  NetworkStatus.poll,
]);

/** What `useAllRows` reads. */
export interface AllRowsOptions<TData, TVariables> {
  /** The root list field that pages, as the document names it. */
  field: keyof TData & string;
  /** The document's variables other than `limit` and `offset`. */
  variables?: Omit<TVariables, keyof PageVariables>;
  /** Rows per request. Lower it for a document whose rows are costly. */
  pageSize?: number;
  fetchPolicy?: WatchQueryFetchPolicy;
}

/** What `useAllRows` hands back: the parts of `useQuery`'s result the pages use. */
export interface AllRowsResult<TData> {
  /** Every page fetched so far, joined under the list field. */
  data: TData | undefined;
  /** What the hook showed before the variables last changed. */
  previousData: TData | undefined;
  /** True until the last page has arrived. */
  loading: boolean;
  error: ApolloError | undefined;
  refetch: () => Promise<unknown>;
}

/**
 * Reads the rows of one list field as an array.
 *
 * @param data - A query result, if there is one yet.
 * @param field - The list field.
 * @returns The rows, or an empty array before the first result.
 */
function rowsOf(data: unknown, field: string): unknown[] {
  const isResult = typeof data === 'object' && data !== null;
  if (isResult === false) {
    return [];
  }
  const rows = Object.entries(data).find(([key]) => key === field)?.[1];
  return Array.isArray(rows) ? rows : [];
}

/**
 * Reads a whole list that the server only serves a page at a time. It fetches the first page as
 * `useQuery` would, then the pages after it one by one, joining each to the cached result. The
 * list must be ordered the same way on every request, so give the document an `orderBy`.
 *
 * @param document - A query that takes `$limit` and `$offset` and passes them to the list field.
 * @param options - The list field, the other variables, and the page size.
 * @returns The joined result, and `loading` until the last page is in.
 */
export function useAllRows<TData, TVariables extends OperationVariables & PageVariables>(
  document: TypedDocumentNode<TData, TVariables>,
  options: AllRowsOptions<TData, TVariables>,
): AllRowsResult<TData> {
  const { field, fetchPolicy } = options;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  // The cast joins the caller's variables to the two the hook owns, which TypeScript cannot prove equals TVariables.
  const variables = { ...options.variables, limit: pageSize, offset: 0 } as TVariables;
  const { data, previousData, error, networkStatus, fetchMore, refetch } = useQuery(document, {
    variables,
    fetchPolicy,
    notifyOnNetworkStatusChange: true,
  });

  /** The failure of a later page, which `useQuery` does not report. Cleared when the first page is fetched again. */
  const [pageError, setPageError] = useState<ApolloError | undefined>(undefined);
  /** Whether a page shorter than `pageSize` has arrived since the first page was last fetched. */
  const hasLastPage = useRef(false);
  const rowCount = rowsOf(data, field).length;
  const isFetchingFirstPage = FIRST_PAGE_FETCHES.has(networkStatus);
  const isFetchingNextPage = networkStatus === NetworkStatus.fetchMore;
  if (isFetchingFirstPage) {
    hasLastPage.current = false;
  }
  const endsOnFullPage = rowCount > 0 && rowCount % pageSize === 0;
  const hasFailed = error !== undefined || pageError !== undefined;
  const isIdle = isFetchingFirstPage === false && isFetchingNextPage === false && hasFailed === false;
  const needsNextPage = isIdle && endsOnFullPage && hasLastPage.current === false;

  useEffect(() => {
    if (needsNextPage === false) {
      return;
    }
    void fetchMore({
      variables: { offset: rowCount },
      updateQuery: (fetched, { fetchMoreResult }) => {
        const nextRows = rowsOf(fetchMoreResult, field);
        hasLastPage.current = nextRows.length < pageSize;
        return { ...fetched, [field]: [...rowsOf(fetched, field), ...nextRows] };
      },
    }).catch((failure: ApolloError) => {
      // Reported, not retried: a list that silently stopped short would read as the whole list.
      setPageError(failure);
    });
  }, [needsNextPage, rowCount, fetchMore, field, pageSize]);

  /**
   * Fetches the list again from its first page.
   *
   * @returns A promise that settles when the first page is in.
   */
  const refetchAll = (): Promise<unknown> => {
    setPageError(undefined);
    return refetch();
  };

  const loading = isFetchingFirstPage || isFetchingNextPage || needsNextPage;
  return { data, previousData, loading, error: error ?? pageError, refetch: refetchAll };
}
