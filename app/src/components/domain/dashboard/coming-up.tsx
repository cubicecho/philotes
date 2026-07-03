import { Link } from 'expo-router';
import { CalendarCheck } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UpcomingDate = {
  id: string;
  name: string;
  daysUntil: number;
  personId: string;
  personFirstName: string;
  personLastName: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

export function formatDaysUntil(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function AllCaughtUp({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground italic py-1">{message} ✓</p>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComingUp({ dates }: { dates: UpcomingDate[] }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const pagedDates = dates.slice(page * pageSize, (page + 1) * pageSize);
  const isFirstPage = page === 0;
  const isLastPage = pagedDates.length < pageSize;

  function handlePageSizeChange(nextSize: number) {
    setPageSize(nextSize);
    setPage(0);
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-base">Coming Up</h2>
        </div>
        <p className="text-xs text-muted-foreground">Important dates in the next 14 days</p>
        {dates.length === 0 ? (
          <AllCaughtUp message="No upcoming dates this fortnight" />
        ) : (
          <ul className="space-y-2">
            {pagedDates.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.name}</p>
                  <Link href={`/persons/${d.personId}`} className="text-xs text-muted-foreground hover:underline">
                    {d.personFirstName} {d.personLastName}
                  </Link>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    d.daysUntil === 0
                      ? 'bg-destructive/10 text-destructive'
                      : d.daysUntil <= 3
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {formatDaysUntil(d.daysUntil)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(dates.length > 0 || page > 0) && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <label htmlFor="coming-up-page-size" className="text-xs text-muted-foreground">
                Per page
              </label>
              <select
                id="coming-up-page-size"
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
