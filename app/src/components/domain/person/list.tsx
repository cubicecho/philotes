import { Link } from 'expo-router';
import { GitMerge, Mail, MessageSquarePlus, Phone, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { QuickLogModal } from '@/components/domain/person/quick-log';
import { ListLayout } from '@/components/layouts/list';
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
} from '@/components/ui/alert-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LabelChip } from '@/components/ui/label-chip';
import { relativeTime } from '@/lib/relative-time';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PersonContactInfo {
  id: string;
  type: string;
  value: string;
  isPrimary?: boolean | null;
}

export interface PersonRowData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  avatarPath?: string | null;
  labels: Array<{ id: string; label: string; color: string }>;
  lastContactedAt?: Date | null;
  contactInfos: PersonContactInfo[];
}

type SortField = 'name' | 'lastContacted';
type SortDir = 'asc' | 'desc';
type SortOption = `${SortField}-${SortDir}`;

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'lastContacted-asc', label: 'Last contacted (oldest first)' },
  { value: 'lastContacted-desc', label: 'Last contacted (recent first)' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function primaryPhone(infos: PersonContactInfo[]): string | null {
  const phones = infos.filter((i) => i.type === 'phone' || i.type === 'mobile');
  if (phones.length === 0) return null;
  return (phones.find((p) => p.isPrimary) ?? phones[0]).value;
}

function groupLetter(person: PersonRowData): string {
  const basis = person.lastName || person.firstName;
  const first = basis.charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

// ---------------------------------------------------------------------------
// PersonRow — one compact, fully tappable row
// ---------------------------------------------------------------------------

interface PersonRowProps {
  person: PersonRowData;
  onClickDelete?: (id: string) => void;
  onQuickLog?: () => void;
  /** Label IDs currently active as filters — highlighted when matched. */
  activeLabelIds: Set<string>;
}

function PersonRow({ person, onClickDelete, onQuickLog, activeLabelIds }: PersonRowProps) {
  const [logOpen, setLogOpen] = useState(false);
  const phone = primaryPhone(person.contactInfos);

  return (
    <div className="group flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-muted/60 transition-colors">
      <Link href={`/persons/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3 text-foreground">
        <Avatar firstName={person.firstName} lastName={person.lastName} avatarPath={person.avatarPath} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">
            {person.firstName} {person.lastName}
          </p>
          <p className="truncate text-muted-foreground text-xs">
            {person.lastContactedAt ? `Last contact: ${relativeTime(person.lastContactedAt)}` : (person.email ?? '')}
          </p>
        </div>
        {person.labels.length > 0 && (
          <div className="hidden sm:flex flex-wrap justify-end gap-1 max-w-[40%]">
            {person.labels.map((l) => (
              <LabelChip key={l.id} label={l.label} color={l.color} active={activeLabelIds.has(l.id)} />
            ))}
          </div>
        )}
      </Link>

      {/* Quick actions */}
      <div className="flex shrink-0 items-center gap-0.5">
        {onQuickLog && (
          <Button
            variant="ghost"
            size="icon"
            title="Log interaction"
            className="h-9 w-9 text-muted-foreground hover:text-primary"
            onClick={() => setLogOpen(true)}
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        )}
        {phone && (
          <Button variant="ghost" size="icon" asChild className="h-9 w-9 text-muted-foreground hover:text-primary">
            <a href={`tel:${phone}`} aria-label={`Call ${person.firstName}`}>
              <Phone className="h-4 w-4" />
            </a>
          </Button>
        )}
        {person.email && (
          <Button variant="ghost" size="icon" asChild className="h-9 w-9 text-muted-foreground hover:text-primary">
            <a href={`mailto:${person.email}`} aria-label={`Email ${person.firstName}`}>
              <Mail className="h-4 w-4" />
            </a>
          </Button>
        )}
        {onClickDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground/50 hover:text-destructive"
                aria-label={`Delete ${person.firstName} ${person.lastName}`}
              >
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
        )}
        {onQuickLog && (
          <QuickLogModal
            personId={person.id}
            personName={`${person.firstName} ${person.lastName}`}
            open={logOpen}
            onClose={() => setLogOpen(false)}
            onLogged={onQuickLog}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PersonList — pure display component
// ---------------------------------------------------------------------------

export interface PersonListProps {
  persons: PersonRowData[];
  /** All labels in the workspace (not just the visible page). */
  allLabels: Array<{ id: string; label: string; color: string }>;
  activeLabelIds: string[];
  onToggleLabel: (id: string) => void;
  q: string;
  onSearchChange: (q: string) => void;
  loading?: boolean;
  sortValue: string;
  onSortChange: (value: string) => void;
  /** Group rows under sticky letter headers (name sort only). */
  grouped: boolean;
  onClickAdd?: () => void;
  onClickDelete?: (id: string) => void;
  onQuickLog?: () => void;
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
  grouped,
  onClickAdd,
  onClickDelete,
  onQuickLog,
}: PersonListProps) {
  const activeLabelSet = new Set(activeLabelIds);
  const hasFilters = q.trim().length > 0 || activeLabelIds.length > 0;

  const handleClearFilters = () => {
    onSearchChange('');
    for (const id of activeLabelIds) {
      onToggleLabel(id);
    }
  };

  // Group under letters (list arrives sorted by name from the caller).
  const groups: Array<{ letter: string; rows: PersonRowData[] }> = [];
  if (grouped) {
    for (const person of persons) {
      const letter = groupLetter(person);
      const last = groups[groups.length - 1];
      if (last && last.letter === letter) {
        last.rows.push(person);
      } else {
        groups.push({ letter, rows: [person] });
      }
    }
  }

  const emptyState = hasFilters ? (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <p>No people match the current filters.</p>
      <button type="button" onClick={handleClearFilters} className="mt-2 text-primary hover:underline">
        Clear filters
      </button>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Users className="h-10 w-10 text-muted-foreground/50" />
      <div>
        <p className="font-medium">No people yet</p>
        <p className="text-sm text-muted-foreground mt-1">Add someone, or import your existing contacts.</p>
      </div>
      <div className="flex gap-2 mt-2">
        {onClickAdd && (
          <Button onClick={onClickAdd}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Person
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link href="/settings" className="text-foreground">
            Import contacts
          </Link>
        </Button>
      </div>
    </div>
  );

  return (
    <ListLayout
      spacing={false}
      header={
        <div className="space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <h1 className="font-bold text-2xl tracking-tight">People</h1>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild className="hidden md:inline-flex">
                <Link href="/persons/dedupe">
                  <GitMerge className="mr-1.5 h-4 w-4" />
                  Dedupe
                </Link>
              </Button>
              {onClickAdd && (
                <Button onClick={onClickAdd} className="hidden md:inline-flex">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Person
                </Button>
              )}
            </div>
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
              aria-label="Sort people"
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
              {allLabels.map((l) => (
                <LabelChip
                  key={l.id}
                  label={l.label}
                  color={l.color}
                  active={activeLabelSet.has(l.id)}
                  onClick={() => onToggleLabel(l.id)}
                  onRemove={activeLabelSet.has(l.id) ? () => onToggleLabel(l.id) : undefined}
                />
              ))}
              {hasFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      }
      body={
        <div className={`transition-opacity${loading ? ' opacity-60' : ''}`}>
          {persons.length === 0 ? (
            emptyState
          ) : grouped ? (
            groups.map((group) => (
              <div key={group.letter}>
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-2 py-1 text-xs font-semibold text-primary">
                  {group.letter}
                </div>
                <div className="divide-y divide-border/60">
                  {group.rows.map((p) => (
                    <PersonRow
                      key={p.id}
                      person={p}
                      onClickDelete={onClickDelete}
                      onQuickLog={onQuickLog}
                      activeLabelIds={activeLabelSet}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="divide-y divide-border/60">
              {persons.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  onClickDelete={onClickDelete}
                  onQuickLog={onQuickLog}
                  activeLabelIds={activeLabelSet}
                />
              ))}
            </div>
          )}
        </div>
      }
      footer={
        persons.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {persons.length} {persons.length === 1 ? 'person' : 'people'}
          </p>
        ) : undefined
      }
    />
  );
}
