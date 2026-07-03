import { useMutation, useQuery } from '@apollo/client';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Activity,
  ArrowLeft,
  BookUser,
  CalendarPlus,
  Camera,
  CheckSquare,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  NotebookPen,
  Pencil,
  Phone,
  Trash2,
  UserRoundPlus,
} from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { graphql } from '@/__generated__/gql';
import type { ImportantDatesMilestoneTypeEnum } from '@/__generated__/graphql';
import { ActivityList } from '@/components/domain/activity/list';
import { AddressList } from '@/components/domain/address/list';
import { ContactInfoList, contactHref } from '@/components/domain/contact-info/list';
import { PersonForm, type PersonFormValue } from '@/components/domain/person/form';
import {
  ImportantDateForm,
  type ImportantDateFormValue,
  MILESTONE_TYPE_OPTIONS,
  RECURRENCE_OPTIONS,
} from '@/components/domain/person/important-date-form';
import { ImportantDateTags } from '@/components/domain/person/important-date-tags';
import { PersonInteractions } from '@/components/domain/person/interactions';
import { PersonIntroductions } from '@/components/domain/person/introductions';
import { PersonLabels } from '@/components/domain/person/labels';
import { PersonNotes } from '@/components/domain/person/notes';
import { PersonRelationships } from '@/components/domain/person/relationships';
import { TaskList } from '@/components/domain/task/list';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner.tsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getToken } from '@/lib/auth';

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const GET_PERSON_DETAIL = graphql(`
  query GetPersonDetail($id: String!) {
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
      labels {
        id
        label
        color
      }
      importantDates {
        id
        name
        description
        date
        recurrence
        milestoneType
        labels {
          id
          label
          color
        }
      }
      notes {
        id
        body
        labels {
          id
          label
          color
        }
        mentions {
          id
          firstName
          lastName
        }
      }
      mentionedInNotes {
        id
        body
        person {
          id
          firstName
          lastName
        }
      }
      interactions(orderBy: { occurredAt: { direction: desc, priority: 1 } }) {
        id
        personId
        channel
        occurredAt
        sentiment
        note
        labels {
          id
          label
          color
        }
      }
      relationships {
        id
        type
        relatedPersonId
        relatedPersonFirstName
        relatedPersonLastName
      }
      activities {
        id
        title
        description
        location
        occurredAt
      }
      ...Person_ActivityList
      tasks {
        id
        title
        notes
        dueAt
        completedAt
        createdAt
      }
      contactInfos {
        id
        type
        value
        label
        isPrimary
      }
      addresses {
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
  query GetAllPersonsForDetail {
    persons {
      id
      firstName
      lastName
      email
      avatarPath
      labels {
        id
        label
        color
      }
    }
  }
`);

const GET_ALL_LABELS = graphql(`
  query GetAllLabelsForDetail {
    labels {
      id
      label
      color
    }
  }
`);

const DELETE_IMPORTANT_DATE = graphql(`
  mutation DeleteImportantDate($id: String!) {
    deleteImportantDates(where: { id: { eq: $id } }) {
      id
    }
  }
`);

const CREATE_IMPORTANT_DATE = graphql(`
  mutation CreateImportantDate(
    $name: String!
    $date: String!
    $personId: String!
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

const UPDATE_IMPORTANT_DATE = graphql(`
  mutation UpdateImportantDate(
    $id: String!
    $name: String!
    $date: String!
    $description: String
    $recurrence: String
    $milestoneType: ImportantDatesMilestoneTypeEnum
  ) {
    updateImportantDates(
      set: {
        name: $name
        date: $date
        description: $description
        recurrence: $recurrence
        milestoneType: $milestoneType
      }
      where: { id: { eq: $id } }
    ) {
      id
      name
      date
      description
      recurrence
      milestoneType
    }
  }
`);

const UPDATE_PERSON = graphql(`
  mutation UpdatePerson(
    $id: String!
    $firstName: String!
    $lastName: String!
    $email: String!
  ) {
    updatePersons(
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
    $personId: String!
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
  mutation AttachLabelToPersonEdit($personId: String!, $labelId: String!) {
    createPersonLabel(values: { personId: $personId, labelId: $labelId }) {
      personId
      labelId
    }
  }
`);

const DETACH_LABEL_FROM_PERSON = graphql(`
  mutation DetachLabelFromPersonEdit($personId: String!, $labelId: String!) {
    deletePersonLabels(
      where: { personId: { eq: $personId }, labelId: { eq: $labelId } }
    ) {
      personId
      labelId
    }
  }
`);

const DELETE_PERSON = graphql(`
  mutation DeletePerson($id: String!) {
    deletePersons(where: { id: { eq: $id } }) {
      id
    }
  }
`);

// ---------------------------------------------------------------------------
// Important date row
// ---------------------------------------------------------------------------

interface ImportantDateRowProps {
  id: string;
  personId: string;
  name: string;
  date: string;
  description: string | null | undefined;
  recurrence: string | null | undefined;
  milestoneType: string | null | undefined;
  tags: Array<{ id: string; label: string; color: string }>;
  allTags: Array<{ id: string; label: string; color: string }>;
  onDelete: (id: string) => void;
  onEdit: () => void;
  onTagChanged: () => void;
}

function ImportantDateRow({
  id,
  personId,
  name,
  date,
  description,
  recurrence,
  milestoneType,
  tags,
  allTags,
  onDelete,
  onEdit,
  onTagChanged,
}: ImportantDateRowProps) {
  const recurrenceLabel = RECURRENCE_OPTIONS.find((o) => o.value === recurrence)?.label;
  const milestoneLabel = MILESTONE_TYPE_OPTIONS.find((o) => o.value === milestoneType)?.label;
  const [editOpen, setEditOpen] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [updateImportantDate] = useMutation(UPDATE_IMPORTANT_DATE, {
    refetchQueries: [],
  });

  const handleEdit = async (values: ImportantDateFormValue) => {
    await updateImportantDate({
      variables: {
        id,
        name: values.name,
        date: values.date,
        description: values.description ?? null,
        recurrence: values.recurrence ?? null,
        milestoneType: (values.milestoneType as ImportantDatesMilestoneTypeEnum | null) ?? null,
      },
    });
    setEditOpen(false);
    onEdit();
  };

  return (
    <>
      <div className="rounded-md border border-border px-3 py-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link href={`/persons/${personId}/dates/${id}`} className="font-medium text-foreground hover:underline">
              {name}
            </Link>
            {description && <span className="ml-2 text-muted-foreground text-xs">{description}</span>}
            <div className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1.5">
              <span>{new Date(date).toLocaleDateString()}</span>
              {recurrenceLabel && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs">{recurrenceLabel}</span>
              )}
              {milestoneLabel && (
                <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-xs font-medium">
                  {milestoneLabel}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 text-muted-foreground/60">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:text-foreground transition-colors"
              aria-label="Edit important date"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(id)}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:text-destructive transition-colors"
              aria-label="Remove important date"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <ImportantDateTags
          importantDateId={id}
          tags={tags}
          allTags={allTags}
          showAdd={showAddTag}
          onShowAdd={setShowAddTag}
          onChanged={onTagChanged}
        />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Important Date</DialogTitle>
          </DialogHeader>
          <ImportantDateForm
            initialValues={{
              name,
              date: date,
              description: description ?? undefined,
              recurrence: recurrence ?? undefined,
              milestoneType: milestoneType ?? undefined,
            }}
            onSubmit={handleEdit}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Section — one auto-height content card with a quiet heading
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

function Section({ title, action, children }: SectionProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** Small ghost icon+text button used as a section's add action. */
function SectionAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick} className="h-7 px-2 text-xs text-muted-foreground">
      {icon}
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PersonDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, loading, error, refetch } = useQuery(GET_PERSON_DETAIL, {
    variables: { id },
    fetchPolicy: 'cache-and-network',
  });
  const { data: allPersonsData } = useQuery(GET_ALL_PERSONS);
  const { data: allLabelsData } = useQuery(GET_ALL_LABELS);

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
  const [deletePerson, { loading: deleting }] = useMutation(DELETE_PERSON);

  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [contactInfoDialogOpen, setContactInfoDialogOpen] = useState(false);
  const [showAddLabel, setShowAddLabel] = useState(false);
  const [showAddRelationship, setShowAddRelationship] = useState(false);
  const [editPersonOpen, setEditPersonOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    await fetch(`/avatars/${id}`, {
      method: 'POST',
      body: formData,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    // Reset input so the same file can be re-selected
    if (avatarInputRef.current) avatarInputRef.current.value = '';
    refetch();
  };

  if (loading) return <Spinner />;
  if (error) return <p>Error loading person: {error.message}</p>;

  const person = data?.person;
  if (!person) return <p className="text-muted-foreground">Person not found.</p>;

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

  const handleEditDate = () => {
    refetch();
  };

  const handleTagChanged = () => {
    refetch();
  };

  const handleDeleteRelationship = () => {
    refetch();
  };

  const handleAddRelationship = () => {
    refetch();
  };

  const handleEditRelationship = () => {
    refetch();
  };

  const handleDeleteLabel = () => {
    refetch();
  };

  const handleAddLabel = () => {
    refetch();
  };

  const handleCreateDate = async (values: ImportantDateFormValue): Promise<void> => {
    await createImportantDate({
      variables: {
        personId: id,
        name: values.name,
        date: values.date,
        description: values.description ?? null,
        recurrence: values.recurrence ?? null,
        milestoneType: (values.milestoneType as ImportantDatesMilestoneTypeEnum | null) ?? null,
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
      if (!nextLabelIds.has(labelId)) {
        await detachLabel({ variables: { personId: id, labelId } });
      }
    }
    for (const labelId of nextLabelIds) {
      if (!currentLabelIds.has(labelId)) {
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

  const allPersonsLinked =
    allPersonStubs.filter((p) => p.id !== person.id && !person.relationships.some((r) => r.relatedPersonId === p.id))
      .length === 0;

  const phones = (person.contactInfos ?? []).filter((ci) => ci.type === 'phone' || ci.type === 'mobile');
  const primaryPhone = (phones.find((p) => p.isPrimary) ?? phones[0])?.value ?? null;
  const phoneHref = primaryPhone ? contactHref('phone', primaryPhone) : null;
  const smsHref = primaryPhone ? `sms:${primaryPhone.replace(/[^\d+]/g, '')}` : null;

  return (
    <TooltipProvider>
      <div className="h-full overflow-y-auto min-h-0 pr-2">
        <div className="space-y-6 py-4">
          {/* Back link + sub-nav */}
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/persons"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              All People
            </Link>
            <Link
              href={`/persons/${id}/timeline`}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Clock className="h-4 w-4" />
              Timeline
            </Link>
          </div>

          {/* Profile header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              {/* Avatar with upload affordance (badge stays visible for touch) */}
              <div className="relative group shrink-0">
                <Avatar
                  firstName={person.firstName}
                  lastName={person.lastName}
                  avatarPath={person.avatarPath}
                  size="lg"
                />
                <label
                  htmlFor="avatar-upload"
                  className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-background bg-secondary text-secondary-foreground shadow-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
                  aria-label="Upload photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="sr-only"
                  ref={avatarInputRef}
                  onChange={handleAvatarUpload}
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <h1 className="font-bold text-2xl md:text-3xl tracking-tight leading-tight">
                  {person.firstName} {person.lastName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {person.email && (
                    <a href={`mailto:${person.email}`} className="hover:text-foreground hover:underline">
                      {person.email}
                    </a>
                  )}
                  {person.contactFrequency && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                      {person.contactFrequency}
                    </span>
                  )}
                </div>
                <PersonLabels
                  person={person}
                  allLabels={allLabels}
                  onDelete={handleDeleteLabel}
                  onAdd={handleAddLabel}
                  showAdd={showAddLabel}
                  onShowAdd={setShowAddLabel}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditPersonOpen(true)}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground/60 hover:text-destructive"
                    disabled={deleting}
                    aria-label={`Delete ${person.firstName} ${person.lastName}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete {person.firstName} {person.lastName}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete {person.firstName} and all their associated data including
                      interactions, notes, tasks, and contact information. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeletePerson}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Communication actions — the reason you opened this page */}
          <div className="flex flex-wrap gap-2">
            {phoneHref && (
              <Button size="sm" asChild>
                <a href={phoneHref}>
                  <Phone className="mr-1.5 h-4 w-4" />
                  Call
                </a>
              </Button>
            )}
            {smsHref && (
              <Button size="sm" variant={phoneHref ? 'outline' : 'default'} asChild>
                <a href={smsHref}>
                  <MessageSquare className="mr-1.5 h-4 w-4" />
                  Text
                </a>
              </Button>
            )}
            {person.email && (
              <Button size="sm" variant={phoneHref || smsHref ? 'outline' : 'default'} asChild>
                <a href={`mailto:${person.email}`}>
                  <Mail className="mr-1.5 h-4 w-4" />
                  Email
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setInteractionDialogOpen(true)}>
              <MessageSquare className="mr-1.5 h-4 w-4" />
              Log Interaction
            </Button>
          </div>

          {/* 2-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* LEFT COLUMN */}
            <div className="space-y-6">
              {/* How We Met */}
              {person.howWeMet && (
                <Section title="How We Met">
                  <p className="text-sm text-muted-foreground">{person.howWeMet}</p>
                  {person.firstMetDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      First met:{' '}
                      {new Date(person.firstMetDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </Section>
              )}

              {/* Contact Info */}
              <Section
                title="Contact Info"
                action={
                  <SectionAction
                    icon={<BookUser className="mr-1 h-3.5 w-3.5" />}
                    label="Add"
                    onClick={() => setContactInfoDialogOpen(true)}
                  />
                }
              >
                <ContactInfoList
                  person={person}
                  onAdd={() => refetch()}
                  onDelete={() => refetch()}
                  createOpen={contactInfoDialogOpen}
                  onCreateOpenChange={setContactInfoDialogOpen}
                />
              </Section>

              {/* Addresses */}
              <Section
                title="Addresses"
                action={
                  <SectionAction
                    icon={<MapPin className="mr-1 h-3.5 w-3.5" />}
                    label="Add"
                    onClick={() => setAddressDialogOpen(true)}
                  />
                }
              >
                <AddressList
                  fragmentRef={person}
                  onAdd={() => refetch()}
                  onDelete={() => refetch()}
                  createOpen={addressDialogOpen}
                  onCreateOpenChange={setAddressDialogOpen}
                />
              </Section>

              {/* Relationships */}
              <Section
                title="Relationships"
                action={
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={allPersonsLinked ? 0 : undefined}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowAddRelationship(true)}
                          disabled={allPersonsLinked}
                          className="h-7 px-2 text-xs text-muted-foreground"
                        >
                          <UserRoundPlus className="mr-1 h-3.5 w-3.5" />
                          Add
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {allPersonsLinked && <TooltipContent>Everyone is already linked</TooltipContent>}
                  </Tooltip>
                }
              >
                <PersonRelationships
                  person={person}
                  allPersons={allPersonStubs}
                  onDelete={handleDeleteRelationship}
                  onAdd={handleAddRelationship}
                  onEdit={handleEditRelationship}
                  showAdd={showAddRelationship}
                  onShowAdd={setShowAddRelationship}
                />
              </Section>

              {/* Suggested Introductions */}
              <Section title="Suggested Introductions">
                <div className="max-h-80 overflow-y-auto space-y-2">
                  <PersonIntroductions
                    currentPersonId={person.id}
                    currentPersonLabels={person.labels}
                    allPersons={allPersonsWithLabels}
                    linkedPersonIds={new Set(person.relationships.map((r) => r.relatedPersonId))}
                  />
                </div>
              </Section>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              {/* Notes */}
              <Section
                title="Notes"
                action={
                  <SectionAction
                    icon={<NotebookPen className="mr-1 h-3.5 w-3.5" />}
                    label="Add"
                    onClick={() => setNoteDialogOpen(true)}
                  />
                }
              >
                <PersonNotes
                  personId={person.id}
                  notes={(person.notes ?? []).map((n) => ({
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
                  onChanged={() => refetch()}
                  createOpen={noteDialogOpen}
                  onCreateOpenChange={setNoteDialogOpen}
                />
              </Section>

              {/* Interactions */}
              <Section
                title="Interactions"
                action={
                  <SectionAction
                    icon={<MessageSquare className="mr-1 h-3.5 w-3.5" />}
                    label="Log"
                    onClick={() => setInteractionDialogOpen(true)}
                  />
                }
              >
                <PersonInteractions
                  personId={person.id}
                  interactions={(person.interactions ?? []).map((i) => ({
                    id: i.id,
                    personId: i.personId,
                    channel: i.channel,
                    occurredAt: i.occurredAt,
                    sentiment: i.sentiment,
                    note: i.note,
                    labels: i.labels ?? [],
                  }))}
                  allTags={allLabels}
                  onChanged={() => refetch()}
                  createOpen={interactionDialogOpen}
                  onCreateOpenChange={setInteractionDialogOpen}
                />
              </Section>

              {/* Important Dates */}
              <Section
                title="Important Dates"
                action={
                  <SectionAction
                    icon={<CalendarPlus className="mr-1 h-3.5 w-3.5" />}
                    label="Add"
                    onClick={() => setDateDialogOpen(true)}
                  />
                }
              >
                {person.importantDates.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No important dates yet.</p>
                ) : (
                  <div className="space-y-2">
                    {person.importantDates.map((d) => (
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
                        onEdit={handleEditDate}
                        onTagChanged={handleTagChanged}
                      />
                    ))}
                  </div>
                )}
              </Section>

              {/* Activities */}
              <Section
                title="Activities"
                action={
                  <SectionAction
                    icon={<Activity className="mr-1 h-3.5 w-3.5" />}
                    label="Add"
                    onClick={() => setActivityDialogOpen(true)}
                  />
                }
              >
                <ActivityList
                  person={person}
                  onAdd={() => refetch()}
                  onDelete={() => refetch()}
                  createOpen={activityDialogOpen}
                  onCreateOpenChange={setActivityDialogOpen}
                />
              </Section>

              {/* Tasks */}
              <Section
                title="Tasks"
                action={
                  <SectionAction
                    icon={<CheckSquare className="mr-1 h-3.5 w-3.5" />}
                    label="Add"
                    onClick={() => setTaskDialogOpen(true)}
                  />
                }
              >
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
                  onAdd={() => refetch()}
                  onDelete={() => refetch()}
                  onUpdate={() => refetch()}
                  createOpen={taskDialogOpen}
                  onCreateOpenChange={setTaskDialogOpen}
                />
              </Section>

              {/* Mentioned In */}
              {(person.mentionedInNotes ?? []).length > 0 && (
                <Section title="Mentioned In">
                  <div className="space-y-2">
                    {(person.mentionedInNotes ?? []).map((n) => (
                      <div key={n.id} className="rounded-md border border-border px-3 py-2 text-sm space-y-0.5">
                        <p className="text-sm line-clamp-3">
                          {n.body.length > 120 ? `${n.body.slice(0, 120)}…` : n.body}
                        </p>
                        {n.person && (
                          <p className="text-xs text-muted-foreground">
                            by{' '}
                            <Link href={`/persons/${n.person.id}`} className="text-foreground/80 hover:text-foreground hover:underline">
                              {n.person.firstName} {n.person.lastName}
                            </Link>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </div>

          {/* Add Important Date Dialog */}
          <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Important Date</DialogTitle>
                <DialogDescription>
                  Record a memorable date for {person.firstName} {person.lastName}.
                </DialogDescription>
              </DialogHeader>
              <ImportantDateForm onSubmit={handleCreateDate} onCancel={() => setDateDialogOpen(false)} />
            </DialogContent>
          </Dialog>

          {/* Edit Person Dialog */}
          <Dialog open={editPersonOpen} onOpenChange={setEditPersonOpen}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Edit Person</DialogTitle>
                <DialogDescription>
                  Update details for {person.firstName} {person.lastName}.
                </DialogDescription>
              </DialogHeader>
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
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </TooltipProvider>
  );
}
