import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { ImportantDatesMilestoneTypeEnum } from '@/__generated__/graphql';
import { CalendarPlus } from '@/components/app-icons';
import {
  CREATE_IMPORTANT_DATE,
  DELETE_IMPORTANT_DATE,
  type DetailLabel,
  GET_PERSON_DETAIL,
  type PersonDetail,
  type PersonStub,
} from '@/components/domain/person/detail-queries';
import { ImportantDateForm, type ImportantDateFormValue } from '@/components/domain/person/important-date-form';
import { ImportantDateRow } from '@/components/domain/person/important-date-row';
import { SectionAdd } from '@/components/domain/person/section-add';
import { EmptyState } from '@/components/page';
import { Section } from '@/components/section';
import { FormDialog } from '@/components/ui/form-dialog';
import { localIsoDate } from '@/lib/local-date';
import { personName } from '@/lib/person-name';

/** Every milestone an important date can mark. */
const MILESTONE_TYPES = Object.values(ImportantDatesMilestoneTypeEnum);

export interface ImportantDatesSectionProps {
  /** The person whose dates these are. */
  person: PersonDetail;
  /** Every label of the caller's, for tagging a date. */
  allLabels: DetailLabel[];
  /** Everyone in the caller's contacts, for tagging the other people a date involves. */
  allPersons: PersonStub[];
  /** Called after a date is edited, or its tags or tagged people change. */
  onChanged: () => void;
}

/** The important dates card on a person's page, with the dialog that adds one. */
export function ImportantDatesSection({ person, allLabels, allPersons, onChanged }: ImportantDatesSectionProps) {
  const refetchQueries = [{ query: GET_PERSON_DETAIL, variables: { id: person.id } }];
  const [deleteImportantDate] = useMutation(DELETE_IMPORTANT_DATE, { refetchQueries });
  const [createImportantDate] = useMutation(CREATE_IMPORTANT_DATE, { refetchQueries });
  const [dialogOpen, setDialogOpen] = useState(false);
  const taggablePersons = allPersons.filter((p) => p.id !== person.id);

  const handleDelete = async (dateId: string) => {
    await deleteImportantDate({ variables: { id: dateId } });
  };

  const handleCreate = async (values: ImportantDateFormValue): Promise<void> => {
    // The form carries the milestone as text, and its picker only offers the enum's members.
    const milestoneType = MILESTONE_TYPES.find((known) => known === values.milestoneType) ?? null;
    await createImportantDate({
      variables: {
        personId: person.id,
        name: values.name,
        date: values.date,
        kind: values.kind,
        hasYear: values.hasYear,
        description: values.description ?? null,
        recurrence: values.recurrence ?? null,
        milestoneType,
      },
    });
    setDialogOpen(false);
  };

  return (
    <>
      <Section
        surface="card"
        title="Important Dates"
        contentClassName="gap-2"
        actionSlot={<SectionAdd iconSlot={<CalendarPlus />} onPress={() => setDialogOpen(true)} />}
        contentSlot={
          person.importantDates.length === 0 ? (
            <EmptyState compact title="No important dates yet." />
          ) : (
            person.importantDates.map((d) => (
              <ImportantDateRow
                key={d.id}
                id={d.id}
                personId={person.id}
                name={d.name}
                date={d.date instanceof Date ? localIsoDate(d.date) : d.date}
                kind={d.kind}
                hasYear={d.hasYear}
                description={d.description}
                recurrence={d.recurrence}
                milestoneType={d.milestoneType}
                tags={d.labels ?? []}
                allTags={allLabels}
                taggedPersons={d.taggedPersons ?? []}
                taggablePersons={taggablePersons}
                onDelete={handleDelete}
                onEdit={onChanged}
                onTagChanged={onChanged}
              />
            ))
          )
        }
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add Important Date"
        description={`Record a memorable date for ${personName(person)}.`}
      >
        <ImportantDateForm onSubmit={handleCreate} onCancel={() => setDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
