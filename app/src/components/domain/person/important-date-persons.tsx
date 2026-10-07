import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql';
import type { PersonStub } from '@/components/domain/person/detail-queries';
import { MultiSelect } from '@/components/multi-select';
import { Alert } from '@/components/ui/alert';
import { personName } from '@/lib/person-name';

const TAG_PERSON_ON_DATE = graphql(`
  mutation TagPersonOnImportantDate($importantDateId: UUID!, $personId: UUID!) {
    createImportantDatePerson(values: { importantDateId: $importantDateId, personId: $personId }) {
      importantDateId
      personId
    }
  }
`);

const UNTAG_PERSON_ON_DATE = graphql(`
  mutation UntagPersonOnImportantDate($importantDateId: UUID!, $personId: UUID!) {
    deleteImportantDatePerson(
      where: { importantDateId: { eq: $importantDateId }, personId: { eq: $personId } }
    ) {
      importantDateId
      personId
    }
  }
`);

export interface ImportantDatePersonsProps {
  importantDateId: string;
  /** The other people the date involves. */
  taggedPersons: PersonStub[];
  /** Everyone who can be tagged: the caller's contacts, without the person the date belongs to. */
  candidates: PersonStub[];
  /** Called after a person is tagged or untagged. */
  onChanged: () => void;
}

/** The other people an important date involves, as a picker: each a removable chip, the rest searchable. */
export function ImportantDatePersons({
  importantDateId,
  taggedPersons,
  candidates,
  onChanged,
}: ImportantDatePersonsProps) {
  const [tagPerson] = useMutation(TAG_PERSON_ON_DATE);
  const [untagPerson] = useMutation(UNTAG_PERSON_ON_DATE);
  const [error, setError] = useState<string | null>(null);

  const taggedIds = taggedPersons.map((p) => p.id);

  const handleChange = async (nextIds: string[]) => {
    const added = nextIds.filter((id) => taggedIds.includes(id) === false);
    const removed = taggedIds.filter((id) => nextIds.includes(id) === false);
    setError(null);
    try {
      for (const personId of added) {
        await tagPerson({ variables: { importantDateId, personId } });
      }
      for (const personId of removed) {
        await untagPerson({ variables: { importantDateId, personId } });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    }
    onChanged();
  };

  return (
    <>
      <MultiSelect
        // A tagged person stays an option even when the contacts list has not loaded them yet.
        options={[...taggedPersons, ...candidates.filter((p) => taggedIds.includes(p.id) === false)].map((p) => ({
          value: p.id,
          label: personName(p),
        }))}
        value={taggedIds}
        onValueChange={handleChange}
        placeholder="Tag people..."
        searchLabel="Search people"
        popoverLabel="People on this date"
        emptyMessage="No one else to tag."
      />
      {error ? <Alert variant="destructive" title={error} /> : null}
    </>
  );
}
