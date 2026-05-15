import { Link } from 'expo-router';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar.js';
import { Card, CardContent } from '@/components/ui/card.js';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OverduePerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarPath?: string | null;
  overdueByDays: number;
  lastContactedAt: Date | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

export function formatOverdueLabel(days: number): string {
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day overdue';
  if (days < 7) return `${days} days overdue`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week overdue';
  if (weeks < 4) return `${weeks} weeks overdue`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month overdue';
  return `${months} months overdue`;
}

function AllCaughtUp({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground italic py-1">{message} ✓</p>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReachOut({ persons }: { persons: OverduePerson[] }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const pagedPersons = persons.slice(page * pageSize, (page + 1) * pageSize);
  const isFirstPage = page === 0;
  const isLastPage = pagedPersons.length < pageSize;

  function handlePageSizeChange(nextSize: number) {
    setPageSize(nextSize);
    setPage(0);
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-base">Reach Out</h2>
        </div>
        <p className="text-xs text-muted-foreground">Contacts past their check-in window</p>
        {persons.length === 0 ? (
          <AllCaughtUp message="You're all caught up here" />
        ) : (
          <ul className="space-y-2">
            {pagedPersons.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <Avatar firstName={p.firstName} lastName={p.lastName} avatarPath={p.avatarPath} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/persons/`} className="font-medium hover:underline">
                    {p.firstName} {p.lastName}
                  </Link>
                  <p className="text-xs text-amber-600 dark:text-amber-400">{formatOverdueLabel(p.overdueByDays)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {(persons.length > 0 || page > 0) && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <label htmlFor="reach-out-page-size" className="text-xs text-muted-foreground">
                Per page
              </label>
              <select
                id="reach-out-page-size"
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
