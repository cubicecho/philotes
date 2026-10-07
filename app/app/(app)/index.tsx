import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import type { UpcomingDate } from '@/components/domain/dashboard/coming-up';
import { ComingUp } from '@/components/domain/dashboard/coming-up';
import type { OpenTask } from '@/components/domain/dashboard/open-tasks';
import { OpenTasks } from '@/components/domain/dashboard/open-tasks';
import type { ReachOutPerson } from '@/components/domain/dashboard/reach-out';
import { formatOverdueLabel, ReachOut } from '@/components/domain/dashboard/reach-out';
import type { RecentPerson } from '@/components/domain/dashboard/recently-added';
import { RecentlyAdded } from '@/components/domain/dashboard/recently-added';
import { PageLayout } from '@/components/page-layout';
import { QueryState } from '@/components/query-state';
import { computeOverdueByDays } from '@/lib/contact-frequency';
import { useAllRows } from '@/lib/use-all-rows';

const GET_DASHBOARD = graphql(`
  query Dashboard($limit: Int!, $offset: Int!) {
    persons(
      limit: $limit
      offset: $offset
      orderBy: { createdAt: { direction: asc, priority: 1 }, id: { direction: asc, priority: 2 } }
    ) {
      id
      firstName
      lastName
      avatarPath
      contactFrequency
      createdAt
      importantDates(limit: 20) {
        id
        name
        date
        recurrence
      }
      tasks(where: { completedAt: { isNull: true } }, limit: 20) {
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

const WIDGET_LIMIT = 6;
const UPCOMING_WINDOW_DAYS = 30;
const DORMANT_THRESHOLD_DAYS = 365;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

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
    if (diff >= 0) {
      return diff;
    }
    return daysBetween(t, new Date(t.getFullYear() + 1, month, day));
  }

  if (recurrence === 'monthly') {
    const thisMonth = new Date(t.getFullYear(), t.getMonth(), day);
    const diff = daysBetween(t, thisMonth);
    if (diff >= 0) {
      return diff;
    }
    return daysBetween(t, new Date(t.getFullYear(), t.getMonth() + 1, day));
  }

  if (recurrence === 'weekly') {
    const targetDow = storedDate.getDay();
    const todayDow = t.getDay();
    return (targetDow - todayDow + 7) % 7;
  }

  return null;
}

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
    .filter((p) => overdueIds.has(p.id) === false)
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
      if (daysUntil === null || daysUntil > UPCOMING_WINDOW_DAYS) {
        continue;
      }
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
      if (task.completedAt) {
        continue;
      }

      const dueAt = task.dueAt ? task.dueAt.getTime() : null;
      const isOverdue = dueAt !== null && dueAt < now;
      const isDueThisWeek = dueAt !== null && dueAt <= sevenDaysFromNow;

      const isBeyondThisWeek = isOverdue === false && isDueThisWeek === false;
      if (isBeyondThisWeek) {
        continue;
      }

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
      const isOnlyFirstOverdue = a.isOverdue && b.isOverdue === false;
      if (isOnlyFirstOverdue) {
        return -1;
      }
      const isOnlySecondOverdue = a.isOverdue === false && b.isOverdue;
      if (isOnlySecondOverdue) {
        return 1;
      }
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

/** Two columns from `md` up; the width sits on the cell because `gap-4` is not part of a percentage. */
const CELL = 'w-full md:w-[calc(50%-0.5rem)]';

export default function DashboardPage() {
  const { data, loading, error, refetch } = useAllRows(GET_DASHBOARD, { field: 'persons' });

  const persons = (data?.persons ?? []) as DashboardPerson[];

  return (
    <PageLayout
      title="Dashboard"
      contentSlot={
        <View className="py-4">
          <QueryState
            query={{ isPending: loading && !data, isError: Boolean(error) && !data, error, refetch }}
            what="dashboard data"
            // The widgets say their own "all caught up", so there is no empty rung here.
            count={1}
            rows={4}
          />
          {data ? (
            <View className="flex-row flex-wrap gap-4">
              <View className={CELL}>
                <ReachOut persons={computeReachOut(persons)} onLogged={() => refetch()} />
              </View>
              <View className={CELL}>
                <ComingUp dates={computeUpcomingDates(persons)} windowDays={UPCOMING_WINDOW_DAYS} />
              </View>
              <View className={CELL}>
                <OpenTasks tasks={computeOpenTasks(persons)} />
              </View>
              <View className={CELL}>
                <RecentlyAdded persons={computeRecentlyAdded(persons)} />
              </View>
            </View>
          ) : null}
        </View>
      }
    />
  );
}
