import { type ApolloError, useMutation, useQuery } from '@apollo/client';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { ContactTypeEnum, ImportantDatesMilestoneTypeEnum } from '@/__generated__/graphql';
import { ActionButton } from '@/components/action-button';
import {
  BookUser,
  CalendarPlus,
  MapPin,
  MessageSquare,
  NotebookPen,
  SquareCheck,
  UserRoundPlus,
  Users,
} from '@/components/app-icons';
import { ConfirmButton } from '@/components/confirm-button';
import { AddressList } from '@/components/domain/address/list';
import { ContactInfoList } from '@/components/domain/contact-info/list';
import { PersonContactActions } from '@/components/domain/person/contact-actions';
import { PersonForm, type PersonFormValue } from '@/components/domain/person/form';
import { ImportantDateForm, type ImportantDateFormValue } from '@/components/domain/person/important-date-form';
import { ImportantDateRow } from '@/components/domain/person/important-date-row';
import { PersonInteractions } from '@/components/domain/person/interactions';
import { PersonIntroductions } from '@/components/domain/person/introductions';
import { PersonLabels } from '@/components/domain/person/labels';
import { PersonMentionedIn } from '@/components/domain/person/mentioned-in';
import { PersonNotes } from '@/components/domain/person/notes';
import { GET_PERSON_INTERACTIONS, GET_PERSON_NOTES } from '@/components/domain/person/person-queries';
import { PersonProfileSummary } from '@/components/domain/person/profile-summary';
import { PersonRelationships } from '@/components/domain/person/relationships';
import { TaskList } from '@/components/domain/task/list';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { QueryError } from '@/components/query-state';
import { Section } from '@/components/section';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormDialog } from '@/components/ui/form-dialog';
import { ArrowLeft, Clock, Pencil, Trash2 } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/spinner';
import { useAvatarUpload } from '@/hooks/use-avatar-upload';
import { PAGE_SIZE_DEFAULTS } from '@/lib/defaults';
import { invalidateQueryFields } from '@/lib/invalidate';
import { fullName } from '@/lib/person-name';
import { useAllRows } from '@/lib/use-all-rows';
import type { SlotNode } from '@/lib/utils';

const GET_PERSON_DETAIL = graphql(`
  query GetPersonDetail($id: UUID!) {
    person(where: { id: { eq: $id } }) {
      id
      firstName
      lastName
      email
      avatarPath
      contactFrequency
      howWeMet
      firstMetDate
      createdAt
      updatedAt
      labels(limit: 50) {
        id
        label
        color
      }
      importantDates(limit: 100) {
        id
        name
        description
        date
        recurrence
        milestoneType
        labels(limit: 10) {
          id
          label
          color
        }
      }
      mentionedInNotes(limit: 50) {
        id
        body
        person {
          id
          firstName
          lastName
        }
      }
      relationships {
        id
        type
        relatedPersonId
        relatedPersonFirstName
        relatedPersonLastName
      }
      tasks(limit: 200) {
        id
        title
        notes
        dueAt
        completedAt
        createdAt
      }
      contactInfos(limit: 50) {
        id
        type
        value
        label
        isPrimary
      }
      addresses(limit: 20) {
        id
        type
        label
        line1
        line2
        city
        state
        postalCode
        country
        isPrimary
      }
    }
  }
`);

const GET_ALL_PERSONS = graphql(`
  query GetAllPersonsForDetail($limit: Int!, $offset: Int!) {
    persons(
      limit: $limit
      offset: $offset
      orderBy: { createdAt: { direction: asc, priority: 1 }, id: { direction: asc, priority: 2 } }
    ) {
      id
      firstName
      lastName
      email
      avatarPath
      labels(limit: 20) {
        id
        label
        color
      }
    }
  }
`);

const GET_ALL_LABELS = graphql(`
  query GetAllLabelsForDetail($limit: Int!, $offset: Int!) {
    labels(limit: $limit, offset: $offset, orderBy: { label: { direction: asc, priority: 1 }, id: { direction: asc, priority: 2 } }) {
      id
      label
      color
    }
  }
`);

const DELETE_IMPORTANT_DATE = graphql(`
  mutation DeleteImportantDate($id: UUID!) {
    deleteImportantDate(where: { id: { eq: $id } }) {
      id
    }
  }
`);

const CREATE_IMPORTANT_DATE = graphql(`
  mutation CreateImportantDate(
    $name: String!
    $date: String!
    $personId: UUID!
    $description: String
    $recurrence: String
    $milestoneType: ImportantDatesMilestoneTypeEnum
  ) {
    createImportantDate(
      values: {
        name: $name
        date: $date
        personId: $personId
        description: $description
        recurrence: $recurrence
        milestoneType: $milestoneType
      }
    ) {
      id
      name
      date
      description
      recurrence
      milestoneType
      personId
    }
  }
`);

const UPDATE_PERSON = graphql(`
  mutation UpdatePerson(
    $id: UUID!
    $firstName: String!
    $lastName: String!
    $email: String!
  ) {
    updatePerson(
      set: {
        firstName: $firstName
        lastName: $lastName
        email: $email
      }
      where: { id: { eq: $id } }
    ) {
      id
      firstName
      lastName
      email
    }
  }
`);

const UPDATE_MY_PERSON_CONTEXT = graphql(`
  mutation UpdateMyPersonContext(
    $personId: UUID!
    $contactFrequency: String
    $howWeMet: String
    $firstMetDate: String
  ) {
    updateMyPersonContext(
      personId: $personId
      contactFrequency: $contactFrequency
      howWeMet: $howWeMet
      firstMetDate: $firstMetDate
    ) {
      personId
      contactFrequency
      howWeMet
      firstMetDate
      avatarPath
    }
  }
`);

const ATTACH_LABEL_TO_PERSON = graphql(`
  mutation AttachLabelToPersonEdit($personId: UUID!, $labelId: UUID!) {
    createPersonLabel(values: { personId: $personId, labelId: $labelId }) {
      personId
      labelId
    }
  }
`);

const DETACH_LABEL_FROM_PERSON = graphql(`
  mutation DetachLabelFromPersonEdit($personId: UUID!, $labelId: UUID!) {
    deletePersonLabel(
      where: { personId: { eq: $personId }, labelId: { eq: $labelId } }
    ) {
      personId
      labelId
    }
  }
`);

const DELETE_PERSON = graphql(`
  mutation DeletePerson($id: UUID!) {
    deletePerson(where: { id: { eq: $id } }) {
      id
    }
  }
`);

/** The quiet add trigger every section header carries. */
function SectionAdd({
  iconSlot,
  onPress,
  content = 'Add',
}: {
  iconSlot: SlotNode;
  onPress: () => void;
  content?: string;
}) {
  return <Button size="xs" variant="ghost" iconSlot={iconSlot} content={content} onPress={onPress} />;
}

/** The contact types that can be called or texted. */
const PHONE_TYPES: ReadonlySet<ContactTypeEnum> = new Set([ContactTypeEnum.Phone, ContactTypeEnum.Mobile]);

/** Every milestone an important date can mark. */
const MILESTONE_TYPES = Object.values(ImportantDatesMilestoneTypeEnum);

const backLink = (
  <Link href="/persons" asChild>
    <Button variant="link" size="xs" iconSlot={<ArrowLeft />} content="All People" />
  </Link>
);

/** What stands in for the page until there is a person: the failure, a spinner, or "not found". */
function PersonPlaceholder({
  error,
  pending,
  onRetry,
}: {
  error: ApolloError | undefined;
  pending: boolean;
  onRetry: () => void;
}) {
  if (error) {
    return <QueryError error={error} onRetry={onRetry} what="this person" />;
  }
  if (pending) {
    return <Spinner />;
  }
  return <EmptyState icon={Users} title="Person not found." />;
}

export default function PersonDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, loading, error, refetch } = useQuery(GET_PERSON_DETAIL, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
  });
  const { data: allPersonsData } = useAllRows(GET_ALL_PERSONS, { field: 'persons' });
  const { data: allLabelsData } = useAllRows(GET_ALL_LABELS, { field: 'labels' });
  // Notes and interactions grow without bound, so each is its own paged list beside the person.
  const notesQuery = useAllRows(GET_PERSON_NOTES, { field: 'notes', variables: { personId: id } });
  const interactionsQuery = useAllRows(GET_PERSON_INTERACTIONS, {
    field: 'interactions',
    variables: { personId: id },
    pageSize: PAGE_SIZE_DEFAULTS.interactions,
  });

  const [deleteImportantDate] = useMutation(DELETE_IMPORTANT_DATE, {
    refetchQueries: [{ query: GET_PERSON_DETAIL, variables: { id } }],
  });

  const [createImportantDate] = useMutation(CREATE_IMPORTANT_DATE, {
    refetchQueries: [{ query: GET_PERSON_DETAIL, variables: { id } }],
  });

  const [updatePerson] = useMutation(UPDATE_PERSON);
  const [updateMyPersonContext] = useMutation(UPDATE_MY_PERSON_CONTEXT);
  const [attachLabel] = useMutation(ATTACH_LABEL_TO_PERSON);
  const [detachLabel] = useMutation(DETACH_LABEL_FROM_PERSON);
  const [deletePerson, { loading: deleting }] = useMutation(DELETE_PERSON, {
    update: (cache) => invalidateQueryFields(cache, ['persons']),
  });

  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [contactInfoDialogOpen, setContactInfoDialogOpen] = useState(false);
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const avatarUpload = useAvatarUpload(id, refetch);

  const person = data?.person;

  // Only the first load replaces the page: a refetch behind an open dialog must not unmount it.
  if (!person) {
    const pending = loading && !error;
    return (
      <PageLayout
        title="Person"
        loading={pending}
        breadcrumbsSlot={backLink}
        contentSlot={<PersonPlaceholder error={error} pending={pending} onRetry={() => refetch()} />}
      />
    );
  }

  const personName = fullName(person);
  const reload = () => {
    refetch();
    void notesQuery.refetch();
    void interactionsQuery.refetch();
  };

  const allPersonStubs = (allPersonsData?.persons ?? []).map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
  }));

  const allPersonsWithLabels = (allPersonsData?.persons ?? []).map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.email,
    avatarPath: p.avatarPath,
    labels: (p.labels ?? []).map((l) => ({
      id: l.id,
      label: l.label,
      color: l.color,
    })),
  }));

  const allLabels = (allLabelsData?.labels ?? []).map((l) => ({
    id: l.id,
    label: l.label,
    color: l.color,
  }));

  const handleDeleteDate = async (dateId: string) => {
    await deleteImportantDate({ variables: { id: dateId } });
  };

  const handleCreateDate = async (values: ImportantDateFormValue): Promise<void> => {
    // The form carries the milestone as text, and its picker only offers the enum's members.
    const milestoneType = MILESTONE_TYPES.find((known) => known === values.milestoneType) ?? null;
    await createImportantDate({
      variables: {
        personId: id,
        name: values.name,
        date: values.date,
        description: values.description ?? null,
        recurrence: values.recurrence ?? null,
        milestoneType,
      },
    });
    setDateDialogOpen(false);
  };

  const handleEditPerson = async ({ person: fields, labelIds }: PersonFormValue): Promise<void> => {
    await updatePerson({
      variables: {
        id,
        firstName: fields.firstName,
        lastName: fields.lastName,
        email: fields.email,
      },
    });

    await updateMyPersonContext({
      variables: {
        personId: id,
        contactFrequency: fields.contactFrequency || null,
        howWeMet: fields.howWeMet || null,
        firstMetDate: fields.firstMetDate || null,
      },
    });

    // Re-sync labels: detach removed, attach added
    const currentLabelIds = new Set(person.labels.map((l) => l.id));
    const nextLabelIds = new Set(labelIds);
    for (const labelId of currentLabelIds) {
      const isRemoved = nextLabelIds.has(labelId) === false;
      if (isRemoved) {
        await detachLabel({ variables: { personId: id, labelId } });
      }
    }
    for (const labelId of nextLabelIds) {
      const isAdded = currentLabelIds.has(labelId) === false;
      if (isAdded) {
        await attachLabel({ variables: { personId: id, labelId } });
      }
    }

    setEditPersonOpen(false);
    refetch();
  };

  const handleDeletePerson = async (): Promise<void> => {
    await deletePerson({ variables: { id } });
    router.push('/persons');
  };

  const linkedPersonIds = new Set(person.relationships.map((r) => r.relatedPersonId));
  const otherPersonIds = allPersonStubs.map((p) => p.id).filter((otherId) => otherId !== person.id);
  const allPersonsLinked = otherPersonIds.every((otherId) => linkedPersonIds.has(otherId));

  const phones = (person.contactInfos ?? []).filter((ci) => PHONE_TYPES.has(ci.type));
  const primaryPhone = (phones.find((p) => p.isPrimary) ?? phones[0])?.value ?? null;
  const mentionedInNotes = person.mentionedInNotes ?? [];

  const leftColumn = (
    <View className="min-w-0 gap-6 lg:flex-1">
      {person.howWeMet ? (
        <Section
          surface="card"
          title="How We Met"
          contentClassName="gap-1"
          contentSlot={
            <>
              <Text className="text-foreground/60 text-sm">{person.howWeMet}</Text>
              {person.firstMetDate ? (
                <Text className="text-foreground/60 text-xs">
                  First met:{' '}
                  {new Date(person.firstMetDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              ) : null}
            </>
          }
        />
      ) : null}

      <Section
        surface="card"
        title="Contact Info"
        actionSlot={<SectionAdd iconSlot={<BookUser />} onPress={() => setContactInfoDialogOpen(true)} />}
        contentSlot={
          <ContactInfoList
            person={person}
            onAdd={reload}
            onDelete={reload}
            createOpen={contactInfoDialogOpen}
            onCreateOpenChange={setContactInfoDialogOpen}
          />
        }
      />

      <Section
        surface="card"
        title="Addresses"
        actionSlot={<SectionAdd iconSlot={<MapPin />} onPress={() => setAddressDialogOpen(true)} />}
        contentSlot={
          <AddressList
            fragmentRef={person}
            onAdd={reload}
            onDelete={reload}
            createOpen={addressDialogOpen}
            onCreateOpenChange={setAddressDialogOpen}
          />
        }
      />

      <Section
        surface="card"
        title="Relationships"
        actionSlot={
          // Stays focusable when there is nobody left to link, so the reason can be read.
          <ActionButton
            label="Add"
            content="Add"
            size="xs"
            variant="ghost"
            iconSlot={<UserRoundPlus />}
            disabled={allPersonsLinked}
            tooltip={allPersonsLinked}
            hint={allPersonsLinked ? 'Everyone is already linked' : undefined}
            onPress={() => setShowAddRelationship(true)}
          />
        }
        contentSlot={
          <PersonRelationships
            person={person}
            allPersons={allPersonStubs}
            onDelete={reload}
            onAdd={reload}
            onEdit={reload}
            showAdd={showAddRelationship}
            onShowAdd={setShowAddRelationship}
          />
        }
      />

      <Section
        surface="card"
        title="Suggested Introductions"
        contentSlot={
          <ScrollView className="max-h-80" nestedScrollEnabled>
            <PersonIntroductions
              currentPersonId={person.id}
              currentPersonLabels={person.labels}
              allPersons={allPersonsWithLabels}
              linkedPersonIds={linkedPersonIds}
            />
          </ScrollView>
        }
      />
    </View>
  );

  const rightColumn = (
    <View className="min-w-0 gap-6 lg:flex-1">
      <Section
        surface="card"
        title="Notes"
        actionSlot={<SectionAdd iconSlot={<NotebookPen />} onPress={() => setNoteDialogOpen(true)} />}
        contentSlot={
          <PersonNotes
            personId={person.id}
            notes={(notesQuery.data?.notes ?? []).map((n) => ({
              id: n.id,
              body: n.body,
              labels: n.labels ?? [],
              mentions: (n.mentions ?? []).map((m) => ({
                id: m.id,
                firstName: m.firstName,
                lastName: m.lastName,
              })),
            }))}
            allTags={allLabels}
            allPersons={allPersonStubs}
            onChanged={reload}
            createOpen={noteDialogOpen}
            onCreateOpenChange={setNoteDialogOpen}
          />
        }
      />

      <Section
        surface="card"
        title="Interactions"
        actionSlot={
          <SectionAdd iconSlot={<MessageSquare />} content="Log" onPress={() => setInteractionDialogOpen(true)} />
        }
        contentSlot={
          <PersonInteractions
            personId={person.id}
            interactions={(interactionsQuery.data?.interactions ?? []).map((i) => ({
              id: i.id,
              personId: i.personId,
              channel: i.channel,
              occurredAt: i.occurredAt,
              sentiment: i.sentiment,
              note: i.note,
              labels: i.labels ?? [],
            }))}
            allTags={allLabels}
            onChanged={reload}
            createOpen={interactionDialogOpen}
            onCreateOpenChange={setInteractionDialogOpen}
          />
        }
      />

      <Section
        surface="card"
        title="Important Dates"
        contentClassName="gap-2"
        actionSlot={<SectionAdd iconSlot={<CalendarPlus />} onPress={() => setDateDialogOpen(true)} />}
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
                date={d.date instanceof Date ? d.date.toISOString().slice(0, 10) : d.date}
                description={d.description}
                recurrence={d.recurrence}
                milestoneType={d.milestoneType}
                tags={d.labels ?? []}
                allTags={allLabels}
                onDelete={handleDeleteDate}
                onEdit={reload}
                onTagChanged={reload}
              />
            ))
          )
        }
      />

      <Section
        surface="card"
        title="Tasks"
        actionSlot={<SectionAdd iconSlot={<SquareCheck />} onPress={() => setTaskDialogOpen(true)} />}
        contentSlot={
          <TaskList
            personId={person.id}
            tasks={(person.tasks ?? []).map((t) => ({
              id: t.id,
              title: t.title,
              notes: t.notes,
              dueAt: t.dueAt,
              completedAt: t.completedAt,
              createdAt: t.createdAt,
            }))}
            onAdd={reload}
            onDelete={reload}
            onUpdate={reload}
            createOpen={taskDialogOpen}
            onCreateOpenChange={setTaskDialogOpen}
          />
        }
      />

      {mentionedInNotes.length > 0 ? (
        <Section surface="card" title="Mentioned In" contentSlot={<PersonMentionedIn notes={mentionedInNotes} />} />
      ) : null}
    </View>
  );

  return (
    <>
      <PageLayout
        title={personName}
        breadcrumbsSlot={backLink}
        actionSlot={
          <>
            <Link href={`/persons/${id}/timeline`} asChild>
              <Button variant="ghost" size="sm" iconSlot={<Clock />} content="Timeline" />
            </Link>
            <Button
              variant="outline"
              size="sm"
              iconSlot={<Pencil />}
              content="Edit"
              onPress={() => setEditPersonOpen(true)}
            />
            <ConfirmButton
              label={`Delete ${personName}`}
              variant="ghost"
              size="icon-sm"
              iconSlot={<Trash2 />}
              disabled={deleting}
              title={`Delete ${personName}?`}
              description={`This will permanently delete ${person.firstName} and all their associated data including interactions, notes, tasks, and contact information. This cannot be undone.`}
              onConfirm={handleDeletePerson}
            />
          </>
        }
        contentSlot={
          <View className="gap-6 py-4">
            {avatarUpload.error ? <Alert variant="destructive" title={avatarUpload.error} /> : null}
            <PersonProfileSummary
              firstName={person.firstName}
              lastName={person.lastName}
              email={person.email}
              avatarPath={person.avatarPath}
              contactFrequency={person.contactFrequency}
              avatarAccept={avatarUpload.accept}
              onPickAvatar={avatarUpload.upload}
              labelsSlot={
                <PersonLabels
                  person={person}
                  allLabels={allLabels}
                  onDelete={reload}
                  onAdd={reload}
                  showAdd={showAddLabel}
                  onShowAdd={setShowAddLabel}
                />
              }
            />

            {/* Communication actions — the reason you opened this page */}
            <PersonContactActions
              phone={primaryPhone}
              email={person.email}
              onLogInteraction={() => setInteractionDialogOpen(true)}
            />

            <View className="gap-6 lg:flex-row lg:items-start">
              {leftColumn}
              {rightColumn}
            </View>
          </View>
        }
      />

      <FormDialog
        open={dateDialogOpen}
        onOpenChange={setDateDialogOpen}
        title="Add Important Date"
        description={`Record a memorable date for ${personName}.`}
      >
        <ImportantDateForm onSubmit={handleCreateDate} onCancel={() => setDateDialogOpen(false)} />
      </FormDialog>

      <FormDialog
        open={editPersonOpen}
        onOpenChange={setEditPersonOpen}
        title="Edit Person"
        description={`Update details for ${personName}.`}
        className="sm:max-w-xl"
      >
        <PersonForm
          availableLabels={allLabels.map((l) => ({
            id: l.id,
            label: l.label,
            color: l.color,
            __typename: 'Label' as const,
          }))}
          initialValues={{
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            labelIds: person.labels.map((l) => l.id),
            contactFrequency: person.contactFrequency,
            howWeMet: person.howWeMet,
            firstMetDate: person.firstMetDate ?? null,
          }}
          submitLabel="Save Changes"
          onSubmit={handleEditPerson}
          onCancel={() => setEditPersonOpen(false)}
        />
      </FormDialog>
    </>
  );
}
