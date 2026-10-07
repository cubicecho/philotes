import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { LabelChip } from '@/components/domain/label/label-chip';
import { Avatar } from '@/components/domain/person/avatar';
import { EmptyState } from '@/components/page';
import { INTRODUCTION_DEFAULTS } from '@/lib/defaults';
import { personName } from '@/lib/person-name';

/** A person and the labels they carry, as a candidate for an introduction. */
export interface PersonWithLabels {
  id: string;
  /** The person's name as the server worked it out. Empty when they have none. */
  displayName: string;
  email: string | null;
  avatarPath?: string | null;
  labels: Array<{ id: string; label: string; color: string }>;
}

export interface PersonIntroductionsProps {
  /** The person the suggestions are for. */
  currentPersonId: string;
  currentPersonLabels: Array<{ id: string; label: string; color: string }>;
  /** Everyone who could be suggested. */
  allPersons: PersonWithLabels[];
  /** The people already related to this person, who are not suggested. */
  linkedPersonIds: Set<string>;
}

/** A person worth introducing, with the labels they share with the current person. */
interface SuggestedPerson {
  person: PersonWithLabels;
  sharedLabels: Array<{ id: string; label: string; color: string }>;
  /** How many labels are shared. */
  overlapCount: number;
}

/**
 * The people who share a label with the current person and are not yet related to them.
 *
 * @param currentPersonId - The person the suggestions are for; they are never suggested to themselves.
 * @param currentPersonLabels - That person's labels.
 * @param allPersons - Everyone who could be suggested.
 * @param linkedPersonIds - The people already related to that person, who are left out.
 * @returns The matches, most shared labels first, capped at `INTRODUCTION_DEFAULTS.maxSuggestions`.
 */
function computeSuggestions(
  currentPersonId: string,
  currentPersonLabels: Array<{ id: string; label: string; color: string }>,
  allPersons: PersonWithLabels[],
  linkedPersonIds: Set<string>,
): SuggestedPerson[] {
  const currentLabelIds = new Set(currentPersonLabels.map((l) => l.id));

  return allPersons
    .filter((p) => {
      const isOther = p.id !== currentPersonId;
      const isUnlinked = linkedPersonIds.has(p.id) === false;
      return isOther && isUnlinked;
    })
    .map((p) => {
      const sharedLabels = p.labels.filter((l) => currentLabelIds.has(l.id));
      return { person: p, sharedLabels, overlapCount: sharedLabels.length };
    })
    .filter((s) => s.overlapCount > 0)
    .sort((a, b) => b.overlapCount - a.overlapCount)
    .slice(0, INTRODUCTION_DEFAULTS.maxSuggestions);
}

interface SuggestionRowProps {
  suggestion: SuggestedPerson;
}

/** One suggested person: their avatar, their name linking to their page, and the labels shared. */
function SuggestionRow({ suggestion }: SuggestionRowProps) {
  const { person, sharedLabels } = suggestion;
  const name = person.displayName || person.email || personName(person);
  return (
    <View className="flex-row items-start gap-3 rounded-md border border-foreground/10 px-3 py-2">
      <Avatar name={name} avatarPath={person.avatarPath} size="sm" />
      <View className="min-w-0 flex-1 gap-1">
        <Link href={`/persons/${person.id}`} className="font-medium text-foreground text-sm">
          {name}
        </Link>
        {person.email ? <Text className="text-foreground/60 text-xs">{person.email}</Text> : null}
        {sharedLabels.length > 0 ? (
          <View className="flex-row flex-wrap gap-1">
            {sharedLabels.map((l) => (
              <LabelChip key={l.id} label={l.label} color={l.color} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** People this person might be introduced to, picked by the labels they share. */
export function PersonIntroductions({
  currentPersonId,
  currentPersonLabels,
  allPersons,
  linkedPersonIds,
}: PersonIntroductionsProps) {
  const suggestions = computeSuggestions(currentPersonId, currentPersonLabels, allPersons, linkedPersonIds);

  if (suggestions.length === 0) {
    return <EmptyState compact title="No label-based suggestions yet." />;
  }

  return (
    <View className="gap-2">
      {suggestions.map((s) => (
        <SuggestionRow key={s.person.id} suggestion={s} />
      ))}
    </View>
  );
}
