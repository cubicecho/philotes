import { Link } from '@tanstack/react-router';
import { Avatar } from '@/components/ui/avatar.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    .filter((p) => p.id !== currentPersonId && !linkedPersonIds.has(p.id))
    .map((p) => {
      const sharedLabels = p.labels.filter((l) => currentLabelIds.has(l.id));
      return { person: p, sharedLabels, overlapCount: sharedLabels.length };
    })
    .filter((s) => s.overlapCount > 0)
    .sort((a, b) => b.overlapCount - a.overlapCount)
    .slice(0, 5);
}

// ---------------------------------------------------------------------------
// Label chip (read-only)
// ---------------------------------------------------------------------------

interface SharedLabelChipProps {
  label: string;
  color: string;
}

function SharedLabelChip({ label, color }: SharedLabelChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
      <span
        className="inline-block h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Suggestion row
// ---------------------------------------------------------------------------

interface SuggestionRowProps {
  suggestion: SuggestedPerson;
}

function SuggestionRow({ suggestion }: SuggestionRowProps) {
  const { person, sharedLabels } = suggestion;
  return (
    <div className="flex items-start gap-3 rounded-md border border-border px-3 py-2 text-sm">
      <Avatar firstName={person.firstName} lastName={person.lastName} avatarPath={person.avatarPath} size="sm" />
      <div className="min-w-0 flex-1">
        <Link to="/persons/$id" params={{ id: person.id }} className="font-medium hover:underline">
          {person.firstName} {person.lastName}
        </Link>
        {person.email && <p className="text-muted-foreground text-xs mt-0.5">{person.email}</p>}
        {sharedLabels.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {sharedLabels.map((l) => (
              <SharedLabelChip key={l.id} label={l.label} color={l.color} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PersonIntroductions({
  currentPersonId,
  currentPersonLabels,
  allPersons,
  linkedPersonIds,
}: PersonIntroductionsProps) {
  const suggestions = computeSuggestions(currentPersonId, currentPersonLabels, allPersons, linkedPersonIds);

  if (suggestions.length === 0) {
    return <p className="text-muted-foreground text-sm">No label-based suggestions yet.</p>;
  }

  return (
    <div className="space-y-2">
      {suggestions.map((s) => (
        <SuggestionRow key={s.person.id} suggestion={s} />
      ))}
    </div>
  );
}
