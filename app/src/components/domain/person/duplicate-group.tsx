import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { ContactTypeEnum } from '@/__generated__/graphql';
import { GitMerge } from '@/components/app-icons';
import { ConfirmButton } from '@/components/confirm-button';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { invalidateQueryFields } from '@/lib/invalidate';
import { personName } from '@/lib/person-name';

const MERGE_PERSONS = graphql(`
  mutation MergePersons($keepId: UUID!, $mergeId: UUID!) {
    mergePersons(keepId: $keepId, mergeId: $mergeId)
  }
`);

/** What each kind of contact detail is called in a group's heading. */
const MATCH_TYPE_LABELS: Record<ContactTypeEnum, string> = {
  [ContactTypeEnum.Email]: 'email',
  [ContactTypeEnum.Phone]: 'phone',
  [ContactTypeEnum.Fax]: 'fax',
  [ContactTypeEnum.Im]: 'messaging handle',
  [ContactTypeEnum.Linkedin]: 'LinkedIn',
  [ContactTypeEnum.Twitter]: 'Twitter',
  [ContactTypeEnum.Instagram]: 'Instagram',
  [ContactTypeEnum.Website]: 'website',
  [ContactTypeEnum.Other]: 'detail',
};

/** A person as a duplicate group shows them. */
export interface DuplicatePerson {
  id: string;
  /** The person's name as the server worked it out. Empty when they have none. */
  displayName: string;
  email: string | null;
}

interface DuplicateGroupCardProps {
  /** The detail the people share, as the server normalized it. */
  matchValue: string;
  matchType: ContactTypeEnum;
  /** The people who share it, two or more. */
  persons: DuplicatePerson[];
  /** Called after every other person has been merged into the kept one. */
  onMerged: () => void;
  /** Called when the group is said not to be a duplicate. */
  onDismiss: () => void;
}

/** One group of likely duplicates: pick who to keep, then merge the rest into them or dismiss the group. */
export function DuplicateGroupCard({ matchValue, matchType, persons, onMerged, onDismiss }: DuplicateGroupCardProps) {
  const [keepId, setKeepId] = useState(persons[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  // Every list of people is stale once one of them is gone.
  const [mergePersons] = useMutation(MERGE_PERSONS, {
    update: (cache) => invalidateQueryFields(cache, ['persons']),
  });

  const kept = persons.find((person) => person.id === keepId);
  const others = persons.filter((person) => person.id !== keepId);

  const handleMerge = async (): Promise<void> => {
    setError(null);
    setMerging(true);
    try {
      for (const other of others) {
        await mergePersons({ variables: { keepId, mergeId: other.id } });
      }
      onMerged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'The merge failed.');
    } finally {
      setMerging(false);
    }
  };

  return (
    <Section
      surface="card"
      title={`Shared ${MATCH_TYPE_LABELS[matchType]}: ${matchValue}`}
      description="Choose who to keep. The others are merged into them."
      contentSlot={
        <View className="gap-3">
          <RadioGroup aria-label="Person to keep" value={keepId} onValueChange={setKeepId}>
            {persons.map((person) => (
              <RadioGroupItem
                key={person.id}
                value={person.id}
                label={personName(person)}
                description={person.email ?? undefined}
              />
            ))}
          </RadioGroup>
          {error && <Alert variant="destructive" title="Could not merge" description={error} />}
          <View className="flex-row flex-wrap justify-end gap-2">
            <Button variant="outline" content="Not a duplicate" disabled={merging} onPress={onDismiss} />
            {kept && (
              <ConfirmButton
                label={`Merge into ${personName(kept)}`}
                content={`Merge into ${personName(kept)}`}
                tooltip={false}
                iconSlot={<GitMerge />}
                loading={merging}
                title={`Merge into ${personName(kept)}?`}
                description={`${others.map((other) => personName(other)).join(' and ')} will be removed from your people. Their notes, interactions, tasks, dates, contact details and labels move to ${personName(kept)}. This cannot be undone.`}
                confirmLabel="Merge"
                onConfirm={handleMerge}
              />
            )}
          </View>
        </View>
      }
    />
  );
}
