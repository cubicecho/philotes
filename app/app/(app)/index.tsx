import { useQuery } from '@apollo/client';
import { graphql } from '@/__generated__/gql';
import type { UpcomingDate } from '@/components/domain/dashboard/coming-up';
import { ComingUp } from '@/components/domain/dashboard/coming-up';
import type { OpenTask } from '@/components/domain/dashboard/open-tasks';
import { OpenTasks } from '@/components/domain/dashboard/open-tasks';
import type { ReachOutPerson } from '@/components/domain/dashboard/reach-out';
import { formatOverdueLabel, ReachOut } from '@/components/domain/dashboard/reach-out';
import type { RecentPerson } from '@/components/domain/dashboard/recently-added';
import { RecentlyAdded } from '@/components/domain/dashboard/recently-added';
import { ListLayout } from '@/components/layouts/list';
import { Spinner } from '@/components/ui/spinner.tsx';
import { computeOverdueByDays } from '@/lib/contact-frequency';

// ---------------------------------------------------------------------------
// GraphQL — one query feeds every widget
// ---------------------------------------------------------------------------

const GET_DASHBOARD = graphql(`
  query Dashboard {
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

type DashboardPerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarPath?: string | null;
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

const WIDGET_LIMIT = 6;
const UPCOMING_WINDOW_DAYS = 30;
const DORMANT_THRESHOLD_DAYS = 365;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ---------------------------------------------------------------------------
// Date utilities
// ---------------------------------------------------------------------------

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
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
// Derived data
// ---------------------------------------------------------------------------

/**
 * One merged "who should I contact" list: people past their check-in window
 * (sorted most-overdue first), then dormant ties (no contact in over a year).
 */
function computeReachOut(persons: DashboardPerson[]): ReachOutPerson[] {
  const overdue = persons
    .filter((p) => Boolean(p.contactFrequency))
    .map((p) => ({
      person: p,
      overdueByDays: computeOverdueByDays(p.contactFrequency ?? '', p.interactions[0]?.occurredAt ?? null),
    }))
    .filter((entry) => entry.overdueByDays >= 0)
    .sort((a, b) => b.overdueByDays - a.overdueByDays)
    .map(({ person, overdueByDays }) => ({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      avatarPath: person.avatarPath,
      statusLabel: formatOverdueLabel(overdueByDays),
      isDormant: false,
    }));

  const overdueIds = new Set(overdue.map((p) => p.id));

  const dormant = persons
    .filter((p) => !overdueIds.has(p.id))
    .map((p) => ({
      person: p,
      daysSince: p.interactions[0]?.occurredAt
        ? Math.floor((Date.now() - p.interactions[0].occurredAt.getTime()) / MS_PER_DAY)
        : null,
    }))
    .filter((entry) => entry.daysSince !== null && entry.daysSince >= DORMANT_THRESHOLD_DAYS)
    .sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0))
    .map(({ person, daysSince }) => ({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      avatarPath: person.avatarPath,
      statusLabel:
        daysSince && daysSince >= 730
          ? `No contact in over ${Math.floor(daysSince / 365)} years`
          : 'No contact in over a year',
      isDormant: true,
    }));

  return [...overdue, ...dormant].slice(0, WIDGET_LIMIT);
}

function computeUpcomingDates(persons: DashboardPerson[]): UpcomingDate[] {
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

  return results.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, WIDGET_LIMIT);
}

function computeOpenTasks(persons: DashboardPerson[]): OpenTask[] {
  const now = Date.now();
  const sevenDaysFromNow = now + 7 * MS_PER_DAY;
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

  return results
    .sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      const aTime = a.dueAt ? a.dueAt.getTime() : 0;
      const bTime = b.dueAt ? b.dueAt.getTime() : 0;
      return aTime - bTime;
    })
    .slice(0, WIDGET_LIMIT);
}

function computeRecentlyAdded(persons: DashboardPerson[]): RecentPerson[] {
  return [...persons]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, WIDGET_LIMIT - 1)
    .map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      avatarPath: p.avatarPath,
      createdAt: p.createdAt,
    }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { data, loading, error, refetch } = useQuery(GET_DASHBOARD);

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

  const persons = (data?.persons ?? []) as DashboardPerson[];

  const reachOut = computeReachOut(persons);
  const upcomingDates = computeUpcomingDates(persons);
  const openTasks = computeOpenTasks(persons);
  const recentlyAdded = computeRecentlyAdded(persons);

  return (
    <ListLayout
      header={<h1 className="font-bold text-2xl tracking-tight pt-3">Dashboard</h1>}
      spacing={false}
      body={
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pb-4">
          <ReachOut persons={reachOut} onLogged={() => refetch()} />
          <ComingUp dates={upcomingDates} windowDays={UPCOMING_WINDOW_DAYS} />
          <OpenTasks tasks={openTasks} />
          <RecentlyAdded persons={recentlyAdded} />
        </div>
      }
    />
  );
}
