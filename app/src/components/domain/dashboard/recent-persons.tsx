import { useQuery } from '@apollo/client';
import { Link } from 'expo-router';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql.js';
import { Avatar } from '@/components/ui/avatar.js';
import { Card, CardContent } from '@/components/ui/card.js';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination.js';
import { Spinner } from '@/components/ui/spinner.tsx';

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const GET_RECENT_PERSONS = graphql(`
  query GetRecentPersons {
    persons(orderBy: { createdAt: { direction: desc, priority: 1 } }) {
      id
      firstName
      lastName
      email
      avatarPath
      createdAt
    }
  }
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

function formatRelativeTime(created: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  const months = Math.floor(diffDays / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecentPersons() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const { data, loading, error } = useQuery(GET_RECENT_PERSONS);

  const allPersons = data?.persons ?? [];
  const pageItems = allPersons.slice(page * pageSize, (page + 1) * pageSize);
  const isFirstPage = page === 0;
  const isLastPage = pageItems.length < pageSize;

  function handlePageSizeChange(nextSize: number) {
    setPageSize(nextSize);
    setPage(0);
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-base">Recently Added</h2>
        </div>

        {loading && <Spinner />}
        {error && <p className="text-sm text-destructive">Failed to load recent contacts.</p>}

        {!loading && !error && allPersons.length === 0 && (
          <p className="text-sm text-muted-foreground">No contacts added yet.</p>
        )}

        {pageItems.length > 0 && (
          <ul className="space-y-2">
            {pageItems.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <Avatar firstName={p.firstName} lastName={p.lastName} avatarPath={p.avatarPath} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/persons/`} className="font-medium hover:underline">
                    {p.firstName} {p.lastName}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}

        {(allPersons.length > 0 || page > 0) && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <label htmlFor="recent-persons-page-size" className="text-xs text-muted-foreground">
                Per page
              </label>
              <select
                id="recent-persons-page-size"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <Pagination className="w-auto mx-0 justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => p - 1)}
                    className={isFirstPage ? 'pointer-events-none opacity-50' : ''}
                    aria-disabled={isFirstPage}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => p + 1)}
                    className={isLastPage ? 'pointer-events-none opacity-50' : ''}
                    aria-disabled={isLastPage}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
