import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { LabelChip } from '@/components/domain/label/label-chip';
import { Avatar } from '@/components/domain/person/avatar';
import { EmptyState } from '@/components/page';
import { INTRODUCTION_DEFAULTS } from '@/lib/defaults';

export interface PersonWithLabels {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  avatarPath?: string | null;
  labels: Array<{ id: string; label: string; color: string }>;
}

export interface PersonIntroductionsProps {
  currentPersonId: string;
  currentPersonLabels: Array<{ id: string; label: string; color: string }>;
  allPersons: PersonWithLabels[];
  linkedPersonIds: Set<string>;
}

interface SuggestedPerson {
  person: PersonWithLabels;
  sharedLabels: Array<{ id: string; label: string; color: string }>;
  overlapCount: number;
}

function computeSuggestions(
  currentPersonId: string,
  currentPersonLabels: Array<{ id: string; label: string; color: string }>,
  allPersons: PersonWithLabels[],
  linkedPersonIds: Set<string>,
): SuggestedPerson[] {
  const currentLabelIds = new Set(currentPersonLabels.map((l) => l.id));

  return allPersons
    .filter((p) => p.id !== currentPersonId && linkedPersonIds.has(p.id) === false)
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

function SuggestionRow({ suggestion }: SuggestionRowProps) {
  const { person, sharedLabels } = suggestion;
  return (
    <View className="flex-row items-start gap-3 rounded-md border border-foreground/10 px-3 py-2">
      <Avatar firstName={person.firstName} lastName={person.lastName} avatarPath={person.avatarPath} size="sm" />
      <View className="min-w-0 flex-1 gap-1">
        <Link href={`/persons/${person.id}`} className="font-medium text-foreground text-sm">
          {person.firstName} {person.lastName}
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
