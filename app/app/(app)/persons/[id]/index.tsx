import { type ApolloError, useMutation, useQuery } from '@apollo/client';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Users } from '@/components/app-icons';
import { ConfirmButton } from '@/components/confirm-button';
import { PersonContactActions } from '@/components/domain/person/contact-actions';
import { PersonActivityColumn } from '@/components/domain/person/detail-activity-column';
import { PersonContactColumn } from '@/components/domain/person/detail-contact-column';
import {
  DELETE_PERSON,
  GET_ALL_LABELS,
  GET_ALL_PERSONS,
  GET_PERSON_DETAIL,
} from '@/components/domain/person/detail-queries';
import { EditPersonDialog } from '@/components/domain/person/edit-person-dialog';
import { KeptPersonSummary, useKeptPerson } from '@/components/domain/person/kept-summary';
import { PersonLabels } from '@/components/domain/person/labels';
import { GET_PERSON_INTERACTIONS, GET_PERSON_NOTES } from '@/components/domain/person/person-queries';
import { PersonProfileSummary } from '@/components/domain/person/profile-summary';
import { EmptyState } from '@/components/page';
import { PageLayout } from '@/components/page-layout';
import { QueryError } from '@/components/query-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Clock, Pencil, Trash2 } from '@/components/ui/icons';
import { Spinner } from '@/components/ui/spinner';
import { useAvatarUpload } from '@/hooks/use-avatar-upload';
import { PAGE_SIZE_DEFAULTS } from '@/lib/defaults';
import { invalidateQueryFields } from '@/lib/invalidate';
import { personName } from '@/lib/person-name';
import { primaryEmail, primaryPhone } from '@/lib/primary-contact';
import { useAllRows } from '@/lib/use-all-rows';

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

/** One person's page: the profile, and a section for each thing recorded about them. */
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

  const [deletePerson, { loading: deleting }] = useMutation(DELETE_PERSON, {
    update: (cache) => invalidateQueryFields(cache, ['persons']),
  });

  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const avatarUpload = useAvatarUpload(id, refetch);

  const person = data?.person;
  const keptPerson = useKeptPerson(id);

  // Only the first load replaces the page: a refetch behind an open dialog must not unmount it.
  if (!person) {
    const pending = loading && !error;
    // The page was never opened on this device and cannot be fetched: the list's row stands in.
    if (error && keptPerson) {
      return (
        <PageLayout
          title={keptPerson.displayName}
          breadcrumbsSlot={backLink}
          contentSlot={<KeptPersonSummary person={keptPerson} />}
        />
      );
    }
    return (
      <PageLayout
        title="Person"
        loading={pending}
        breadcrumbsSlot={backLink}
        contentSlot={<PersonPlaceholder error={error} pending={pending} onRetry={() => refetch()} />}
      />
    );
  }

  const name = personName(person);
  const reload = () => {
    refetch();
    void notesQuery.refetch();
    void interactionsQuery.refetch();
  };

  const allPersonStubs = (allPersonsData?.persons ?? []).map((p) => ({
    id: p.id,
    displayName: p.displayName,
  }));

  const allPersonsWithLabels = (allPersonsData?.persons ?? []).map((p) => ({
    id: p.id,
    displayName: p.displayName,
    email: primaryEmail(p.contactInfos ?? []),
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

  const handleDeletePerson = async (): Promise<void> => {
    await deletePerson({ variables: { id } });
    router.push('/persons');
  };

  const phone = primaryPhone(person.contactInfos ?? []);
  const email = primaryEmail(person.contactInfos ?? []);

  return (
    <>
      <PageLayout
        title={name}
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
              label={`Delete ${name}`}
              variant="ghost"
              size="icon-sm"
              iconSlot={<Trash2 />}
              disabled={deleting}
              title={`Delete ${name}?`}
              description={`This will permanently delete ${name} and all their associated data including interactions, notes, tasks, and contact information. This cannot be undone.`}
              onConfirm={handleDeletePerson}
            />
          </>
        }
        contentSlot={
          <View className="gap-6 py-4">
            {avatarUpload.error ? <Alert variant="destructive" title={avatarUpload.error} /> : null}
            <PersonProfileSummary
              name={name}
              nickname={person.nickname}
              work={[person.jobTitle, person.department, person.organization]}
              about={person.about}
              email={email}
              avatarPath={person.avatarPath}
              contactFrequency={person.contactFrequency}
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
            <PersonContactActions phone={phone} email={email} onLogInteraction={() => setInteractionDialogOpen(true)} />

            <View className="gap-6 lg:flex-row lg:items-start">
              <PersonContactColumn
                person={person}
                allPersons={allPersonStubs}
                allPersonsWithLabels={allPersonsWithLabels}
                onChanged={reload}
              />
              <PersonActivityColumn
                person={person}
                notes={notesQuery.data?.notes ?? []}
                interactions={interactionsQuery.data?.interactions ?? []}
                allLabels={allLabels}
                allPersons={allPersonStubs}
                onChanged={reload}
                interactionDialogOpen={interactionDialogOpen}
                onInteractionDialogOpenChange={setInteractionDialogOpen}
              />
            </View>
          </View>
        }
      />

      <EditPersonDialog
        person={person}
        allLabels={allLabels}
        open={editPersonOpen}
        onOpenChange={setEditPersonOpen}
        onSaved={() => refetch()}
      />
    </>
  );
}
