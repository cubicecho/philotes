import { useQuery } from '@apollo/client';
import { Link } from 'expo-router';
import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql';
import { Card, CardContent } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner.tsx';

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const GET_UPCOMING_DATES = graphql(`
  query GetUpcomingDates($limit: Int, $offset: Int) {
    upcomingDates(limit: $limit, offset: $offset) {
      id
      name
      description
      date
      recurrence
      daysUntil
      nextDate
      personId
      personFirstName
      personLastName
    }
  }
`);

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const RECURRENCE_LABELS: Record<string, string> = {
  yearly: 'Yearly',
  monthly: 'Monthly',
  weekly: 'Weekly',
};

function formatDaysUntil(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function formatDate(dateStr: string): string {
  const [, monthStr, dayStr] = dateStr.split('-');
  return new Date(2000, Number(monthStr) - 1, Number(dayStr)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatNextDate(dateStr: string): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  return new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const LOOKAHEAD_DAYS = 30;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;

export function UpcomingDates() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const { data, loading, error } = useQuery(GET_UPCOMING_DATES, {
    variables: { limit: pageSize, offset: page * pageSize },
  });

  const items = data?.upcomingDates ?? [];
  const isFirstPage = page === 0;
  const isLastPage = items.length < pageSize;

  function handlePageSizeChange(nextSize: number) {
    setPageSize(nextSize);
    setPage(0);
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-base">Upcoming Dates</h2>
          <span className="ml-auto text-xs text-muted-foreground">Next {LOOKAHEAD_DAYS} days</span>
        </div>

        {loading && <Spinner />}
        {error && <p className="text-sm text-destructive">Failed to load upcoming dates.</p>}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-muted-foreground">No upcoming dates in the next {LOOKAHEAD_DAYS} days.</p>
        )}

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/persons/${d.personId}/dates/${d.id}`}
                    className="font-medium hover:underline"
                  >
                    {d.name}
                  </Link>
                  {d.description && <span className="ml-2 text-xs text-muted-foreground">{d.description}</span>}
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <Link href={`/persons/${d.personId}`} className="hover:underline">
                      {d.personFirstName} {d.personLastName}
                    </Link>
                    <span>·</span>
                    {d.recurrence ? (
                      <>
                        <span title={`Original: ${formatDate(d.date)}`}>{formatNextDate(d.nextDate)}</span>
                        {RECURRENCE_LABELS[d.recurrence] && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">
                            {RECURRENCE_LABELS[d.recurrence]}
                          </span>
                        )}
                      </>
                    ) : (
                      <span>{formatDate(d.date)}</span>
                    )}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    d.daysUntil === 0
                      ? 'bg-destructive/10 text-destructive'
                      : d.daysUntil <= 7
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {formatDaysUntil(d.daysUntil)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {(items.length > 0 || page > 0) && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <label htmlFor="upcoming-page-size" className="text-xs text-muted-foreground">
                Per page
              </label>
              <select
                id="upcoming-page-size"
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
