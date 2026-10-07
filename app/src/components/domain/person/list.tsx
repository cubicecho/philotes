import { Link, useRouter } from 'expo-router';
import { Linking, Platform, Text, View } from 'react-native';
import { ActionButton } from '@/components/action-button';
import { Mail, Phone, UserPlus, Users } from '@/components/app-icons';
import { ConfirmButton } from '@/components/confirm-button';
import { LabelChip } from '@/components/domain/label/label-chip';
import { Avatar } from '@/components/domain/person/avatar';
import { ListItem } from '@/components/list-item';
import { OptionSelect } from '@/components/option-select';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { Button } from '@/components/ui/button';
import { Search, Trash2, X } from '@/components/ui/icons';
import { SearchInput } from '@/components/ui/search-input';
import { fullName } from '@/lib/person-name';
import { relativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';

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
  if (phones.length === 0) {
    return null;
  }
  return (phones.find((p) => p.isPrimary) ?? phones[0]).value;
}

function groupLetter(person: PersonRowData): string {
  const basis = person.lastName || person.firstName;
  const first = basis.charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

// Sticky under the page header on the web; on device the letter scrolls with its rows.
const LETTER_HEADER = Platform.select({ web: 'sticky top-0 z-10', default: '' });

// ---------------------------------------------------------------------------
// PersonRow — one compact row: the middle opens the person, the ends act on them
// ---------------------------------------------------------------------------

interface PersonRowProps {
  person: PersonRowData;
  divided: boolean;
  onClickDelete?: (id: string) => void;
  activeLabelIds: Set<string>;
}

function PersonRow({ person, divided, onClickDelete, activeLabelIds }: PersonRowProps) {
  const router = useRouter();
  const phone = primaryPhone(person.contactInfos);
  const { email } = person;

  return (
    <ListItem
      className={divided ? 'rounded-none border-foreground/10 border-t' : undefined}
      onPress={() => router.push(`/persons/${person.id}`)}
      leadingSlot={
        <Avatar firstName={person.firstName} lastName={person.lastName} avatarPath={person.avatarPath} size="md" />
      }
      title={fullName(person)}
      description={
        person.lastContactedAt ? `Last contact: ${relativeTime(person.lastContactedAt)}` : (person.email ?? '')
      }
      meta={
        person.labels.length > 0 ? (
          <View className="hidden max-w-64 flex-row flex-wrap justify-end gap-1 sm:flex">
            {person.labels.map((l) => (
              <LabelChip key={l.id} label={l.label} color={l.color} active={activeLabelIds.has(l.id)} />
            ))}
          </View>
        ) : undefined
      }
      actionSlot={
        <>
          {phone && (
            <ActionButton
              variant="ghost"
              size="icon-sm"
              label={`Call ${person.firstName}`}
              iconSlot={<Phone />}
              onPress={() => Linking.openURL(`tel:${phone}`)}
            />
          )}
          {email && (
            <ActionButton
              variant="ghost"
              size="icon-sm"
              label={`Email ${person.firstName}`}
              iconSlot={<Mail />}
              onPress={() => Linking.openURL(`mailto:${email}`)}
            />
          )}
          {onClickDelete && (
            <ConfirmButton
              variant="ghost"
              size="icon-sm"
              label={`Delete ${fullName(person)}`}
              iconSlot={<Trash2 />}
              title={`Delete ${fullName(person)}?`}
              description={`This will permanently delete ${person.firstName} and all their associated data. This cannot be undone.`}
              onConfirm={() => onClickDelete(person.id)}
            />
          )}
        </>
      }
    />
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
}

/** The people screen: it is its own `PageLayout`, so a route renders it as the whole page. */
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
    <EmptyState
      icon={Search}
      title="No people match the current filters."
      actionSlot={<Button variant="link" content="Clear filters" onPress={handleClearFilters} />}
    />
  ) : (
    <EmptyState
      icon={Users}
      title="No people yet"
      description="Add someone, or import your existing contacts."
      actionSlot={
        <View className="flex-row flex-wrap justify-center gap-2">
          {onClickAdd && <Button content="Add Person" iconSlot={<UserPlus />} onPress={onClickAdd} />}
          <Link href="/settings" asChild>
            <Button variant="outline" content="Import contacts" />
          </Link>
        </View>
      }
    />
  );

  const rows = (list: PersonRowData[]) => (
    <View role="list">
      {list.map((p, index) => (
        <View key={p.id} role="listitem">
          <PersonRow person={p} divided={index > 0} onClickDelete={onClickDelete} activeLabelIds={activeLabelSet} />
        </View>
      ))}
    </View>
  );

  return (
    <PageLayout
      title="People"
      actionSlot={
        // Below `md` the app shell's own bar carries the add button.
        onClickAdd ? (
          <Button className="hidden md:flex" content="Add Person" iconSlot={<UserPlus />} onPress={onClickAdd} />
        ) : undefined
      }
      headerContentSlot={
        <View className="gap-3">
          <View className="flex-row items-center gap-2">
            <View className="min-w-0 flex-1">
              <SearchInput
                label="Search people"
                placeholder="Search by name or email…"
                value={q}
                onChangeText={onSearchChange}
              />
            </View>
            <View className="shrink-0">
              <OptionSelect
                aria-label="Sort people"
                options={SORT_OPTIONS}
                value={sortValue}
                onValueChange={onSortChange}
              />
            </View>
          </View>
          {allLabels.length > 0 && (
            <View className="flex-row flex-wrap items-center gap-1.5">
              {allLabels.map((l) => (
                <LabelChip
                  key={l.id}
                  label={l.label}
                  color={l.color}
                  active={activeLabelSet.has(l.id)}
                  onPress={() => onToggleLabel(l.id)}
                  onRemove={activeLabelSet.has(l.id) ? () => onToggleLabel(l.id) : undefined}
                />
              ))}
              {hasFilters && (
                <Button variant="ghost" size="xs" content="Clear" iconSlot={<X />} onPress={handleClearFilters} />
              )}
            </View>
          )}
        </View>
      }
      contentSlot={
        <View className={cn(loading && 'opacity-60')}>
          {persons.length === 0
            ? emptyState
            : grouped
              ? groups.map((group) => (
                  <View key={group.letter}>
                    <View className={cn('bg-background px-3 py-1', LETTER_HEADER)}>
                      <Text className="font-semibold text-foreground text-xs">{group.letter}</Text>
                    </View>
                    {rows(group.rows)}
                  </View>
                ))
              : rows(persons)}
        </View>
      }
      footerSlot={
        persons.length > 0 ? (
          <Text className="text-foreground/60 text-xs">
            {persons.length} {persons.length === 1 ? 'person' : 'people'}
          </Text>
        ) : undefined
      }
    />
  );
}
