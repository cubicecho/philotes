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

const GET_DORMANT_TIES_PERSONS = graphql(`
  query DormantTiesPersons {
    persons(orderBy: { firstName: { direction: asc, priority: 1 } }) {
      id
      firstName
      lastName
      avatarPath
      createdAt
      interactions(
        orderBy: { occurredAt: { direction: desc, priority: 1 } }
        limit: 1
      ) {
        occurredAt
      }
    }
  }
`);

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const DORMANT_THRESHOLD_DAYS = 365;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
}

function lastContactLabel(dayCount: number): string {
  if (dayCount < 30) return `${dayCount} days ago`;
  if (dayCount < 365) {
    const months = Math.floor(dayCount / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(dayCount / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DormantTies() {
  const { data, loading, error } = useQuery(GET_DORMANT_TIES_PERSONS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const dormant = (data?.persons ?? [])
    .map((p) => {
      const lastInteractionAt = p.interactions?.[0]?.occurredAt ?? null;
      const referenceDate = lastInteractionAt ?? p.createdAt;
      const daysDormant = referenceDate ? daysSince(referenceDate) : 0;
      return { ...p, lastInteractionAt, daysDormant };
    })
    .filter((p) => p.daysDormant >= DORMANT_THRESHOLD_DAYS)
    .sort((a, b) => b.daysDormant - a.daysDormant);

  const pageItems = dormant.slice(page * pageSize, (page + 1) * pageSize);
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
          <div>
            <h2 className="font-semibold text-base">Dormant Ties</h2>
            <p className="text-xs text-muted-foreground">
              People you&apos;ve lost touch with — reconnecting is easier than you think
            </p>
          </div>
        </div>

        {loading && <Spinner />}
        {error && <p className="text-sm text-destructive">Failed to load contacts.</p>}

        {!loading && !error && dormant.length === 0 && (
          <p className="text-sm text-muted-foreground">You&apos;re staying in touch with everyone — great work!</p>
        )}

        {pageItems.length > 0 && (
          <ul className="space-y-2">
            {pageItems.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <Avatar firstName={p.firstName} lastName={p.lastName} avatarPath={p.avatarPath} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/persons/${p.id}`} className="font-medium hover:underline">
                    {p.firstName} {p.lastName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {p.lastInteractionAt ? `Last contact: ${lastContactLabel(p.daysDormant)}` : 'Never logged'}
                  </p>
                </div>
                <Link
                  href={`/persons/${p.id}`}
                  className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1"
                  aria-label={`Reconnect with ${p.firstName}`}
                >
                  Reconnect
                </Link>
              </li>
            ))}
          </ul>
        )}

        {(dormant.length > 0 || page > 0) && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <label htmlFor="dormant-ties-page-size" className="text-xs text-muted-foreground">
                Per page
              </label>
              <select
                id="dormant-ties-page-size"
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
