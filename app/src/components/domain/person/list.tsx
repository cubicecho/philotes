import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import { ActionButton } from '@/components/action-button';
import { GitMerge, Mail, MessageSquarePlus, Phone, UserPlus, Users } from '@/components/app-icons';
import { ConfirmButton } from '@/components/confirm-button';
import { LabelChip } from '@/components/domain/label/label-chip';
import { Avatar } from '@/components/domain/person/avatar';
import { QuickLogDialog } from '@/components/domain/person/quick-log';
import { ListItem } from '@/components/list-item';
import { OptionSelect } from '@/components/option-select';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { Button } from '@/components/ui/button';
import { Search, Trash2, X } from '@/components/ui/icons';
import { SearchInput } from '@/components/ui/search-input';
import { fullName } from '@/lib/person-name';
import { type ContactValue, primaryEmail, primaryPhone } from '@/lib/primary-contact';
import { relativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';

/** One of a person's contact values, as far as the list needs it. */
export interface PersonContactInfo extends ContactValue {
  id: string;
}

/** A person as a row of the list shows them. */
export interface PersonRowData {
  id: string;
  firstName: string;
  lastName: string;
  avatarPath?: string | null;
  labels: Array<{ id: string; label: string; color: string }>;
  /** When they were last contacted; `null` or left out when never. */
  lastContactedAt?: Date | null;
  contactInfos: PersonContactInfo[];
}

/** What the list can be sorted by. */
type SortField = 'name' | 'lastContacted';
/** Which way a sort runs. */
type SortDir = 'asc' | 'desc';
/** A sort as the select's value: field, hyphen, direction. */
type SortOption = `${SortField}-${SortDir}`;

/** The sorts offered, as select options. */
const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'lastContacted-asc', label: 'Last contacted (oldest first)' },
  { value: 'lastContacted-desc', label: 'Last contacted (recent first)' },
];

/**
 * The letter a person is grouped under in the name-sorted list.
 *
 * @param person - The person.
 * @returns The first letter of the last name, or of the first name when there is none; `#` when it is not A–Z.
 */
function groupLetter(person: PersonRowData): string {
  const basis = person.lastName || person.firstName;
  const first = basis.charAt(0).toUpperCase();
  const isLetter = /[A-Z]/.test(first);
  return isLetter ? first : '#';
}

// Sticky under the page header on the web; on device the letter scrolls with its rows.
const LETTER_HEADER = Platform.select({ web: 'sticky top-0 z-10', default: '' });

interface PersonRowProps {
  person: PersonRowData;
  /** Whether the row is set off from the one above it. */
  divided: boolean;
  /** Called with the person's id once the delete is confirmed; no delete button is drawn without it. */
  onDeletePress?: (id: string) => void;
  /** Called when the row's log button is pressed; the button is not drawn without it. */
  onLogPress?: (person: PersonRowData) => void;
  /** The labels being filtered by; the row's matching chips are drawn selected. */
  activeLabelIds: Set<string>;
}

/**
 * One person: avatar, name, last contact (or email when never contacted), labels, and log, call, email and delete
 * buttons.
 */
function PersonRow({ person, divided, onDeletePress, onLogPress, activeLabelIds }: PersonRowProps) {
  const router = useRouter();
  const phone = primaryPhone(person.contactInfos);
  const email = primaryEmail(person.contactInfos);

  return (
    <ListItem
      className={divided ? 'rounded-none border-foreground/10 border-t' : undefined}
      onPress={() => router.push(`/persons/${person.id}`)}
      leadingSlot={
        <Avatar firstName={person.firstName} lastName={person.lastName} avatarPath={person.avatarPath} size="md" />
      }
      title={fullName(person)}
      description={person.lastContactedAt ? `Last contact: ${relativeTime(person.lastContactedAt)}` : (email ?? '')}
      meta={
        person.labels.length > 0 ? (
          <View className="hidden max-w-64 flex-row flex-wrap justify-end gap-1 sm:flex">
            {person.labels.map((l) => (
              <LabelChip key={l.id} label={l.label} color={l.color} selected={activeLabelIds.has(l.id)} />
            ))}
          </View>
        ) : undefined
      }
      actionSlot={
        <>
          {onLogPress && (
            <ActionButton
              variant="ghost"
              size="icon-sm"
              label={`Log interaction with ${person.firstName}`}
              iconSlot={<MessageSquarePlus />}
              onPress={() => onLogPress(person)}
            />
          )}
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
          {onDeletePress && (
            <ConfirmButton
              variant="ghost"
              size="icon-sm"
              label={`Delete ${fullName(person)}`}
              iconSlot={<Trash2 />}
              title={`Delete ${fullName(person)}?`}
              description={`This will permanently delete ${person.firstName} and all their associated data. This cannot be undone.`}
              onConfirm={() => onDeletePress(person.id)}
            />
          )}
        </>
      }
    />
  );
}

export interface PersonListProps {
  /** The rows to draw, already filtered and sorted by the owner. */
  persons: PersonRowData[];
  /** All labels in the workspace (not just the visible page). */
  allLabels: Array<{ id: string; label: string; color: string }>;
  /** The ids of the labels being filtered by. */
  activeLabelIds: string[];
  /** Called with a label's id to turn its filter on or off. */
  onToggleLabel: (id: string) => void;
  /** The search text. */
  q: string;
  onSearchChange: (q: string) => void;
  loading?: boolean;
  /** The chosen sort, one of the `SortOption` values. */
  sortValue: string;
  onSortChange: (value: string) => void;
  /** Group rows under sticky letter headers (name sort only). */
  grouped: boolean;
  /** Called when Add Person is pressed; the button is not drawn without it. */
  onAddPress?: () => void;
  /** Called with a person's id once their delete is confirmed; no delete buttons are drawn without it. */
  onDeletePress?: (id: string) => void;
  /** Called after an interaction is logged from a row; no log buttons are drawn without it. */
  onLogged?: () => void;
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
  onAddPress,
  onDeletePress,
  onLogged,
}: PersonListProps) {
  const [loggingPerson, setLoggingPerson] = useState<PersonRowData | null>(null);
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
      const isSameLetter = last !== undefined && last.letter === letter;
      if (isSameLetter) {
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
          {onAddPress && <Button content="Add Person" iconSlot={<UserPlus />} onPress={onAddPress} />}
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
          <PersonRow
            person={p}
            divided={index > 0}
            onDeletePress={onDeletePress}
            onLogPress={onLogged ? setLoggingPerson : undefined}
            activeLabelIds={activeLabelSet}
          />
        </View>
      ))}
    </View>
  );

  const listSlot = grouped
    ? groups.map((group) => (
        <View key={group.letter}>
          <View className={cn('bg-background px-3 py-1', LETTER_HEADER)}>
            <Text className="font-semibold text-foreground text-xs">{group.letter}</Text>
          </View>
          {rows(group.rows)}
        </View>
      ))
    : rows(persons);

  return (
    <>
      {onLogged && <QuickLogDialog person={loggingPerson} onClose={() => setLoggingPerson(null)} onLogged={onLogged} />}
      <PageLayout
        title="People"
        actionSlot={
          <View className="flex-row items-center gap-2">
            <Link href="/persons/dedupe" asChild>
              <Button variant="outline" content="Find duplicates" iconSlot={<GitMerge />} />
            </Link>
            {/* Below `md` the app shell's own bar carries the add button. */}
            {onAddPress && (
              <Button className="hidden md:flex" content="Add Person" iconSlot={<UserPlus />} onPress={onAddPress} />
            )}
          </View>
        }
        headerContentSlot={
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <View className="min-w-0 flex-1">
                <SearchInput
                  label="Search people"
                  placeholder="Search by name, email or phone…"
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
                    selected={activeLabelSet.has(l.id)}
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
          <View className={cn(loading && 'opacity-60')}>{persons.length === 0 ? emptyState : listSlot}</View>
        }
        footerSlot={
          persons.length > 0 ? (
            <Text className="text-foreground/60 text-xs">
              {persons.length} {persons.length === 1 ? 'person' : 'people'}
            </Text>
          ) : undefined
        }
      />
    </>
  );
}
