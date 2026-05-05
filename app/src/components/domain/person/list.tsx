import { useFragment } from '@apollo/client';
import { Link } from '@tanstack/react-router';
import { Search, Trash2, UserPlus, X } from 'lucide-react';
import { graphql } from '@/__generated__/gql.js';
import type { Person_ListFragment } from '@/__generated__/graphql.ts';
import { PERSON_RELATIONSHIPS } from '@/components/domain/person/relationships.js';
import { ListLayout } from '@/components/layouts/list.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog.js';
import { Avatar } from '@/components/ui/avatar.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent } from '@/components/ui/card.js';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination.js';
import { Spinner } from '@/components/ui/spinner.tsx';

const PERSON_LIST = graphql(`
  fragment Person_List on Person {
    id
    firstName
    lastName
    email
    avatarPath
    createdAt
    updatedAt
    labels {
      id
      label
      color
    }
    importantDates {
      id
      name
      description
      date
    }
    ...Person_Relationships
  }
`);

export { PERSON_LIST, PERSON_RELATIONSHIPS };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilterablePersonRow {
  ref: Person_ListFragment;
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  avatarPath?: string | null;
  labels: Array<{ id: string; label: string; color: string }>;
  lastContactedAt?: Date | null;
}

type SortField = 'name' | 'lastContacted';
type SortDir = 'asc' | 'desc';
type SortOption = `${SortField}-${SortDir}`;

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'lastContacted-asc', label: 'Last Contacted (oldest first)' },
  { value: 'lastContacted-desc', label: 'Last Contacted (recent first)' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

// ---------------------------------------------------------------------------
// PersonRow
// ---------------------------------------------------------------------------

interface PersonRowProps {
  person: Person_ListFragment;
  onClickDelete: (id: string) => void;
  /** Label IDs currently active as filters — highlighted when matched. */
  activeLabelIds: Set<string>;
  lastContactedAt?: Date | null;
}

function relativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function PersonRow({ person: from, onClickDelete, activeLabelIds, lastContactedAt }: PersonRowProps) {
  const { data: person, complete } = useFragment({
    fragment: PERSON_LIST,
    fragmentName: 'Person_List',
    from,
  });

  if (!complete) {
    return <Spinner />;
  }

  return (
    <Card>
      <CardContent className="flex items-start gap-3 justify-between p-4">
        <Avatar firstName={person.firstName} lastName={person.lastName} avatarPath={person.avatarPath} size="md" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">
            <Link to="/persons/$id" params={{ id: person.id }} className="hover:underline">
              {person.firstName} {person.lastName}
            </Link>
          </p>
          <p className="text-muted-foreground text-sm">{person.email}</p>
          {lastContactedAt && (
            <p className="text-muted-foreground text-xs">Last contact: {relativeTime(lastContactedAt)}</p>
          )}
          {person.labels.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {person.labels.map((l) => (
                <span
                  key={l.id}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                    activeLabelIds.size > 0 && activeLabelIds.has(l.id)
                      ? 'border-foreground bg-foreground/10 font-medium'
                      : ''
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: l.color }}
                    aria-hidden="true"
                  />
                  {l.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-2 shrink-0 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {person.firstName} {person.lastName}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {person.firstName} and all their associated data. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onClickDelete(person.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// PersonList — pure display component
// All filtering, sorting, pagination logic lives in the parent route.
// ---------------------------------------------------------------------------

export interface PersonListProps {
  persons: FilterablePersonRow[];
  // Label filter UI
  allLabels: Array<{ id: string; label: string; color: string }>;
  activeLabelIds: string[];
  onToggleLabel: (id: string) => void;
  // Search UI
  q: string;
  onSearchChange: (q: string) => void;
  /** Whether a new query is in-flight; adds a subtle fade instead of unmounting. */
  loading?: boolean;
  // Sort UI
  sortValue: string; // e.g. "name-asc"
  onSortChange: (value: string) => void;
  // Pagination UI
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
  onPageSizeChange: (size: number) => void;
  // Actions
  onClickAdd?: () => void;
  onClickDelete?: (id: string) => void;
}

export function PersonList({
  persons,
  allLabels,
  activeLabelIds,
  onToggleLabel,
  q,
  onSearchChange,
  loading = false,
  sortValue,
  onSortChange,
  page,
  pageSize: _pageSize,
  hasNextPage,
  onNextPage,
  onPrevPage,
  onPageSizeChange,
  onClickAdd,
  onClickDelete,
}: PersonListProps) {
  const activeLabelSet = new Set(activeLabelIds);
  const isFirstPage = page === 0;
  const hasFilters = q.trim().length > 0 || activeLabelIds.length > 0;

  const handleClearFilters = () => {
    onSearchChange('');
    // Clear labels by toggling each active one off — simpler than a dedicated prop
    for (const id of activeLabelIds) {
      onToggleLabel(id);
    }
  };

  return (
    <ListLayout
      header={
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-3xl">Persons</h1>
            {onClickAdd && (
              <Button onClick={onClickAdd}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Person
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                placeholder="Search by name or email…"
                value={q}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <select
              value={sortValue}
              onChange={(e) => onSortChange(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
              aria-label="Sort persons"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {allLabels.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Filter:</span>
              {allLabels.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onToggleLabel(l.id)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    activeLabelSet.has(l.id) ? 'border-foreground bg-foreground text-background' : 'hover:bg-muted'
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: l.color }}
                    aria-hidden="true"
                  />
                  {l.label}
                  {activeLabelSet.has(l.id) && <X className="h-2.5 w-2.5 ml-0.5" />}
                </button>
              ))}
              {hasFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      }
      body={
        <div className={`space-y-3 transition-opacity${loading ? ' opacity-60' : ''}`}>
          <p className="text-xs text-muted-foreground">
            {persons.length} person{persons.length !== 1 ? 's' : ''}
          </p>

          {persons.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {hasFilters ? 'No persons match the current filters.' : 'No persons yet.'}
            </p>
          ) : (
            <div className="grid gap-4">
              {persons.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p.ref}
                  onClickDelete={onClickDelete ?? (() => undefined)}
                  activeLabelIds={activeLabelSet}
                  lastContactedAt={p.lastContactedAt}
                />
              ))}
            </div>
          )}
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="persons-page-size" className="text-xs text-muted-foreground">
              Per page
            </label>
            <select
              id="persons-page-size"
              value={_pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
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
                  onClick={onPrevPage}
                  className={isFirstPage ? 'pointer-events-none opacity-50' : ''}
                  aria-disabled={isFirstPage}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={onNextPage}
                  className={!hasNextPage ? 'pointer-events-none opacity-50' : ''}
                  aria-disabled={!hasNextPage}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      }
    />
  );
}
