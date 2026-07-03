import { useQuery } from '@apollo/client';
import { graphql } from '@/__generated__/gql';
import type { UpcomingDate } from '@/components/domain/dashboard/coming-up';
import { ComingUp } from '@/components/domain/dashboard/coming-up';
import { DontLoseTouch } from '@/components/domain/dashboard/dont-lose-touch';
import type { ReviewPerson } from '@/components/domain/dashboard/dormant-tie';
import { DormantTie } from '@/components/domain/dashboard/dormant-tie';
import { DormantTies } from '@/components/domain/dashboard/dormant-ties';
import type { OpenTask } from '@/components/domain/dashboard/open-tasks';
import { OpenTasks } from '@/components/domain/dashboard/open-tasks';
import type { OverduePerson } from '@/components/domain/dashboard/reach-out';
import { ReachOut } from '@/components/domain/dashboard/reach-out';
import { RecentPersons } from '@/components/domain/dashboard/recent-persons';
import { UpcomingDates } from '@/components/domain/dashboard/upcoming-dates';
import { ListLayout } from '@/components/layouts/list';
import { Spinner } from '@/components/ui/spinner.tsx';
import { computeOverdueByDays } from '@/lib/contact-frequency';

// ---------------------------------------------------------------------------
// GraphQL
// ---------------------------------------------------------------------------

const GET_WEEKLY_REVIEW = graphql(`
  query WeeklyReview {
    persons {
      id
      firstName
      lastName
      avatarPath
      contactFrequency
      createdAt
      importantDates {
        id
        name
        date
        recurrence
      }
      tasks {
        id
        title
        dueAt
        completedAt
        personId
      }
      interactions(
        orderBy: { occurredAt: { direction: desc, priority: 1 } }
        limit: 1
      ) {
        occurredAt
      }
    }
  }
`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FullReviewPerson = ReviewPerson & {
  contactFrequency?: string | null;
  createdAt: Date;
  importantDates: Array<{
    id: string;
    name: string;
    date: Date;
    recurrence?: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    dueAt?: Date | null;
    completedAt?: Date | null;
    personId: string;
  }>;
  interactions: Array<{
    occurredAt: Date;
  }>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_OVERDUE_SHOWN = 5;
const UPCOMING_WINDOW_DAYS = 14;
const DORMANT_THRESHOLD_DAYS = 365;

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntilNextOccurrence(storedDate: Date, recurrence: string | null | undefined): number | null {
  const t = todayMidnight();
  const month = storedDate.getMonth();
  const day = storedDate.getDate();

  if (!recurrence) {
    const stored = new Date(storedDate.getFullYear(), month, day);
    const diff = daysBetween(t, stored);
    return diff >= 0 ? diff : null;
  }

  if (recurrence === 'yearly') {
    const thisYear = new Date(t.getFullYear(), month, day);
    const diff = daysBetween(t, thisYear);
    if (diff >= 0) return diff;
    return daysBetween(t, new Date(t.getFullYear() + 1, month, day));
  }

  if (recurrence === 'monthly') {
    const thisMonth = new Date(t.getFullYear(), t.getMonth(), day);
    const diff = daysBetween(t, thisMonth);
    if (diff >= 0) return diff;
    return daysBetween(t, new Date(t.getFullYear(), t.getMonth() + 1, day));
  }

  if (recurrence === 'weekly') {
    const targetDow = storedDate.getDay();
    const todayDow = t.getDay();
    return (targetDow - todayDow + 7) % 7;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Derived data computations
// ---------------------------------------------------------------------------

function computeOverdueContacts(persons: FullReviewPerson[]): OverduePerson[] {
  return persons
    .filter((p) => Boolean(p.contactFrequency))
    .map((p) => ({
      ...p,
      lastContactedAt: p.interactions[0]?.occurredAt ?? null,
      overdueByDays: computeOverdueByDays(p.contactFrequency ?? '', p.interactions[0]?.occurredAt ?? null),
    }))
    .filter((p) => p.overdueByDays >= 0)
    .sort((a, b) => b.overdueByDays - a.overdueByDays)
    .slice(0, MAX_OVERDUE_SHOWN);
}

function computeUpcomingDates(persons: FullReviewPerson[]): UpcomingDate[] {
  const results: UpcomingDate[] = [];

  for (const person of persons) {
    for (const importantDate of person.importantDates) {
      const daysUntil = daysUntilNextOccurrence(importantDate.date, importantDate.recurrence);
      if (daysUntil === null || daysUntil > UPCOMING_WINDOW_DAYS) continue;
      results.push({
        id: importantDate.id,
        name: importantDate.name,
        daysUntil,
        personId: person.id,
        personFirstName: person.firstName,
        personLastName: person.lastName,
      });
    }
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

function computeOpenTasks(persons: FullReviewPerson[]): OpenTask[] {
  const now = Date.now();
  const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
  const results: OpenTask[] = [];

  for (const person of persons) {
    for (const task of person.tasks) {
      if (task.completedAt) continue;

      const dueAt = task.dueAt ? task.dueAt.getTime() : null;
      const isOverdue = dueAt !== null && dueAt < now;
      const isDueThisWeek = dueAt !== null && dueAt <= sevenDaysFromNow;

      if (!isOverdue && !isDueThisWeek) continue;

      results.push({
        id: task.id,
        title: task.title,
        dueAt: task.dueAt ?? null,
        personId: person.id,
        personFirstName: person.firstName,
        personLastName: person.lastName,
        isOverdue,
      });
    }
  }

  return results.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    const aTime = a.dueAt ? a.dueAt.getTime() : 0;
    const bTime = b.dueAt ? b.dueAt.getTime() : 0;
    return aTime - bTime;
  });
}

function computeMostDormantPerson(persons: FullReviewPerson[]): (ReviewPerson & { daysSinceContact: number }) | null {
  const candidates = persons
    .map((p) => ({
      ...p,
      daysSinceContact: p.interactions[0]?.occurredAt
        ? Math.floor((Date.now() - p.interactions[0].occurredAt.getTime()) / (1000 * 60 * 60 * 24))
        : Number.POSITIVE_INFINITY,
    }))
    .filter((p) => p.daysSinceContact >= DORMANT_THRESHOLD_DAYS);

  if (candidates.length === 0) return null;

  return candidates.reduce((most, current) => (current.daysSinceContact > most.daysSinceContact ? current : most));
}

// ---------------------------------------------------------------------------
// Dashboard modules
//
// To add a new module:
//   1. Create a self-contained component in app/src/components/domain/dashboard/
//   2. Import it here and add it to the MODULES array below.
//   3. Choose a span: "half" fills one column, "full" spans both columns.
// ---------------------------------------------------------------------------

type DashboardModule = {
  id: string;
  span: 'half' | 'full';
  component: React.ReactNode;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { data, loading, error } = useQuery(GET_WEEKLY_REVIEW);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive text-sm">Error loading dashboard data: {error.message}</p>;
  }

  const persons = (data?.persons ?? []) as FullReviewPerson[];

  const overdueContacts = computeOverdueContacts(persons);
  const upcomingDates = computeUpcomingDates(persons);
  const openTasks = computeOpenTasks(persons);
  const dormantPerson = computeMostDormantPerson(persons);

  const MODULES: DashboardModule[] = [
    { id: 'recent-persons', span: 'half', component: <RecentPersons /> },
    { id: 'dont-lose-touch', span: 'half', component: <DontLoseTouch /> },
    { id: 'dormant-ties', span: 'half', component: <DormantTies /> },
    { id: 'upcoming-dates', span: 'half', component: <UpcomingDates /> },
    { id: 'reach-out', span: 'half', component: <ReachOut persons={overdueContacts} /> },
    { id: 'coming-up', span: 'half', component: <ComingUp dates={upcomingDates} /> },
    { id: 'open-tasks', span: 'half', component: <OpenTasks tasks={openTasks} /> },
    { id: 'dormant-tie', span: 'half', component: <DormantTie person={dormantPerson} /> },
  ];

  return (
    <ListLayout
      header={<h1 className="font-bold text-2xl pt-3">Dashboard</h1>}
      spacing={false}
      body={
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {MODULES.map(({ id, span, component }) => (
            <div key={id} className={span === 'full' ? 'md:col-span-2' : ''}>
              {component}
            </div>
          ))}
        </div>
      }
    />
  );
}
