import { useMutation, useQuery } from '@apollo/client';
import { Link } from 'expo-router';
import { ArrowLeft, GitMerge } from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

// ── GraphQL ───────────────────────────────────────────────────────────────────

const GET_POTENTIAL_DUPLICATES = graphql(`
  query GetPotentialDuplicates {
    potentialDuplicates {
      matchValue
      matchType
      personIds
    }
  }
`);

const GET_PERSONS_BY_IDS = graphql(`
  query GetPersonsForDedupe {
    persons {
      id
      firstName
      lastName
      email
      avatarPath
      contactInfos {
        id
        type
        value
        isPrimary
      }
      labels {
        id
        label
        color
      }
    }
  }
`);

const MERGE_PERSONS = graphql(`
  mutation MergePersons($primaryId: String!, $duplicateId: String!) {
    mergePersons(primaryId: $primaryId, duplicateId: $duplicateId)
  }
`);

// ── Types ─────────────────────────────────────────────────────────────────────

interface PersonStub {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  avatarPath?: string | null;
  contactInfos: Array<{ id: string; type: string; value: string; isPrimary: boolean }>;
  labels: Array<{ id: string; label: string; color: string }>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PersonCard({
  person,
  isSelected,
  onSelect,
  highlightValue,
}: {
  person: PersonStub;
  isSelected: boolean;
  onSelect: () => void;
  highlightValue: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg border-2 p-4 transition-colors ${
        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <Avatar firstName={person.firstName} lastName={person.lastName} avatarPath={person.avatarPath} size="sm" />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">
            {person.firstName} {person.lastName}
          </p>
          {person.email && <p className="text-xs text-muted-foreground truncate">{person.email}</p>}
        </div>
        {isSelected && <span className="ml-auto text-xs font-semibold text-primary shrink-0">Keep</span>}
      </div>

      {person.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {person.labels.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white"
              style={{ backgroundColor: l.color }}
            >
              {l.label}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-0.5">
        {person.contactInfos.slice(0, 4).map((ci) => (
          <p
            key={ci.id}
            className={`text-xs ${
              ci.value.toLowerCase() === highlightValue.toLowerCase()
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <span className="capitalize">{ci.type}:</span> {ci.value}
          </p>
        ))}
        {person.contactInfos.length > 4 && (
          <p className="text-xs text-muted-foreground">+{person.contactInfos.length - 4} more</p>
        )}
      </div>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DedupePage() {
  const { data: dupData, loading: dupLoading, refetch } = useQuery(GET_POTENTIAL_DUPLICATES);
  const { data: personsData, loading: personsLoading } = useQuery(GET_PERSONS_BY_IDS);
  const [mergePersons, { loading: merging }] = useMutation(MERGE_PERSONS);

  // primaryId per group (keyed by matchValue)
  const [selections, setSelections] = useState<Record<string, string>>({});
  // groups dismissed by the user this session
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const loading = dupLoading || personsLoading;

  if (loading) return <Spinner />;

  const personMap = new Map<string, PersonStub>((personsData?.persons ?? []).map((p) => [p.id, p as PersonStub]));

  const groups = (dupData?.potentialDuplicates ?? []).filter((g) => !dismissed.has(g.matchValue));

  const handleMerge = async (matchValue: string, personIds: string[]) => {
    const primaryId = selections[matchValue] ?? personIds[0];
    const duplicates = personIds.filter((id) => id !== primaryId);

    for (const duplicateId of duplicates) {
      await mergePersons({ variables: { primaryId, duplicateId } });
    }

    setDismissed((prev) => new Set([...prev, matchValue]));
    refetch();
  };

  return (
    <div className="space-y-6 py-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/persons"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Persons
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GitMerge className="h-6 w-6" />
          Duplicate Contacts
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          These contacts share the same email, phone, or other contact info. Select which one to keep as the primary —
          all notes, interactions, and data will be merged into it.
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No duplicate contacts found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const persons = group.personIds
              .map((id) => personMap.get(id))
              .filter((p): p is PersonStub => p !== undefined);

            if (persons.length < 2) return null;

            const primaryId = selections[group.matchValue] ?? group.personIds[0];

            return (
              <Card key={group.matchValue}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between gap-4">
                    <span>
                      Shared <span className="capitalize">{group.matchType}</span>:{' '}
                      <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">{group.matchValue}</span>
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDismissed((prev) => new Set([...prev, group.matchValue]))}
                      >
                        Not a duplicate
                      </Button>
                      <Button
                        size="sm"
                        disabled={merging}
                        onClick={() => handleMerge(group.matchValue, group.personIds)}
                      >
                        Merge into selected
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${Math.min(persons.length, 3)}, 1fr)` }}
                  >
                    {persons.map((person) => (
                      <PersonCard
                        key={person.id}
                        person={person}
                        isSelected={person.id === primaryId}
                        highlightValue={group.matchValue}
                        onSelect={() =>
                          setSelections((prev) => ({
                            ...prev,
                            [group.matchValue]: person.id,
                          }))
                        }
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
