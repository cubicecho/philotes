import { useQuery } from '@apollo/client';
import { Link } from 'expo-router';
import { Bell, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql.js';
import { PersonInteractions } from '@/components/domain/person/interactions.js';
import { Avatar } from '@/components/ui/avatar.js';
import { Card, CardContent } from '@/components/ui/card.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.js';
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

const GET_PERSONS_WITH_FREQUENCY = graphql(`
  query GetPersonsWithFrequency {
    persons {
      id
      firstName
      lastName
      email
      avatarPath
      contactFrequency
      interactions(limit: 1, orderBy: { occurredAt: { direction: desc, priority: 1 } }) {
        occurredAt
      }
    }
  }
`);

const GET_PERSON_INTERACTIONS = graphql(`
  query GetPersonInteractionsForWidget($personId: String!) {
    interactions(
      where: { personId: { eq: $personId } }
      orderBy: { occurredAt: { direction: desc, priority: 1 } }
    ) {
      id
      personId
      channel
      occurredAt
      sentiment
      note
      labels {
        id
        label
        color
      }
    }
  }
`);

const GET_ALL_LABELS_FOR_WIDGET = graphql(`
  query GetAllLabelsForWidget {
    labels {
      id
      label
      color
    }
  }
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

function daysOverdue(contactFrequency: string, lastContactedAt: Date | null | undefined): number {
  const periodDays = FREQUENCY_DAYS[contactFrequency] ?? 30;
  if (!lastContactedAt) {
    // Never contacted — treat as maximally overdue
    return periodDays;
  }
  const daysSince = Math.floor((Date.now() - lastContactedAt.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince - periodDays;
}

function overdueLabel(days: number): string {
  if (days <= 0) return 'Due soon';
  if (days === 1) return '1 day overdue';
  if (days < 7) return `${days} days overdue`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return w === 1 ? '1 week overdue' : `${w} weeks overdue`;
  }
  const m = Math.floor(days / 30);
  return m === 1 ? '1 month overdue' : `${m} months overdue`;
}

// ---------------------------------------------------------------------------
// Log Interaction quick dialog
// ---------------------------------------------------------------------------

interface LogInteractionDialogProps {
  personId: string;
  personName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogged: () => void;
}

function LogInteractionDialog({ personId, personName, open, onOpenChange, onLogged }: LogInteractionDialogProps) {
  const { data: interactionsData } = useQuery(GET_PERSON_INTERACTIONS, {
    variables: { personId },
    skip: !open,
  });
  const { data: labelsData } = useQuery(GET_ALL_LABELS_FOR_WIDGET, {
    skip: !open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Interaction — {personName}</DialogTitle>
        </DialogHeader>
        <PersonInteractions
          personId={personId}
          interactions={(interactionsData?.interactions ?? []).map((i) => ({
            id: i.id,
            personId: i.personId,
            channel: i.channel,
            occurredAt: i.occurredAt,
            sentiment: i.sentiment,
            note: i.note,
            labels: i.labels ?? [],
          }))}
          allTags={(labelsData?.labels ?? []).map((l) => ({
            id: l.id,
            label: l.label,
            color: l.color,
          }))}
          onChanged={onLogged}
          createOpen={open}
          onCreateOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [5, 10, 25] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DontLoseTouch() {
  const { data, loading, error, refetch } = useQuery(GET_PERSONS_WITH_FREQUENCY);
  const [logPersonId, setLogPersonId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  // Filter to persons with a frequency set, compute overdue, sort by most overdue first
  const overdue = (data?.persons ?? [])
    .filter((p) => p.contactFrequency)
    .map((p) => ({
      ...p,
      lastContactedAt: p.interactions?.[0]?.occurredAt ?? null,
      overdueBy: daysOverdue(p.contactFrequency ?? '', p.interactions?.[0]?.occurredAt ?? null),
    }))
    .filter((p) => p.overdueBy >= 0)
    .sort((a, b) => b.overdueBy - a.overdueBy);

  const pageItems = overdue.slice(page * pageSize, (page + 1) * pageSize);
  const isFirstPage = page === 0;
  const isLastPage = pageItems.length < pageSize;

  const logPerson = logPersonId ? overdue.find((p) => p.id === logPersonId) : null;

  function handlePageSizeChange(nextSize: number) {
    setPageSize(nextSize);
    setPage(0);
  }

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-base">Don&apos;t Lose Touch</h2>
          </div>

          {loading && <Spinner />}
          {error && <p className="text-sm text-destructive">Failed to load contacts.</p>}

          {!loading && !error && overdue.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {(data?.persons ?? []).some((p) => p.contactFrequency)
                ? "You're all caught up!"
                : 'Set contact frequency on a person to track touch-points.'}
            </p>
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
                    <p className="text-xs text-destructive">{overdueLabel(p.overdueBy)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogPersonId(p.id)}
                    className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1"
                    aria-label={`Log interaction with ${p.firstName}`}
                  >
                    <MessageSquare className="h-3 w-3" />
                    Log
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(overdue.length > 0 || page > 0) && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <label htmlFor="dont-lose-touch-page-size" className="text-xs text-muted-foreground">
                  Per page
                </label>
                <select
                  id="dont-lose-touch-page-size"
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

      {logPerson && (
        <LogInteractionDialog
          personId={logPerson.id}
          personName={`${logPerson.firstName} ${logPerson.lastName}`}
          open={logPersonId !== null}
          onOpenChange={(open) => {
            if (!open) setLogPersonId(null);
          }}
          onLogged={() => {
            setLogPersonId(null);
            refetch();
          }}
        />
      )}
    </>
  );
}
