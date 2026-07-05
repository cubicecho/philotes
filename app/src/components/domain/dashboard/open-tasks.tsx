import { Link } from 'expo-router';
import { CheckSquare } from 'lucide-react';
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

export type OpenTask = {
  id: string;
  title: string;
  dueAt: Date | null;
  personId: string;
  personFirstName: string;
  personLastName: string;
  isOverdue: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

export function formatDueDate(dueAt: Date | null, isOverdue: boolean): string {
  if (!dueAt) return 'No due date';
  const formatted = dueAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return isOverdue ? `${formatted} (overdue)` : formatted;
}

function AllCaughtUp({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground italic py-1">{message} ✓</p>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OpenTasks({ tasks }: { tasks: OpenTask[] }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const pagedTasks = tasks.slice(page * pageSize, (page + 1) * pageSize);
  const isFirstPage = page === 0;
  const isLastPage = pagedTasks.length < pageSize;

  function handlePageSizeChange(nextSize: number) {
    setPageSize(nextSize);
    setPage(0);
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-base">Open Tasks</h2>
        </div>
        <p className="text-xs text-muted-foreground">Tasks due this week or overdue</p>
        {tasks.length === 0 ? (
          <AllCaughtUp message="No tasks due this week" />
        ) : (
          <ul className="space-y-2">
            {pagedTasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{task.title}</p>
                  <Link
                    href={`/persons/${task.personId}`}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    {task.personFirstName} {task.personLastName}
                  </Link>
                </div>
                <span className={`shrink-0 text-xs ${task.isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {formatDueDate(task.dueAt, task.isOverdue)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {(tasks.length > 0 || page > 0) && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <label htmlFor="open-tasks-page-size" className="text-xs text-muted-foreground">
                Per page
              </label>
              <select
                id="open-tasks-page-size"
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
