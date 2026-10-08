import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import type { DashboardQuery } from '@/__generated__/graphql';
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
import { DASHBOARD_DEFAULTS } from '@/lib/defaults';
import { daysUntilNextOccurrence } from '@/lib/next-occurrence';
import { DAYS_PER_YEAR, MS_PER_DAY } from '@/lib/time';
import { useAllRows } from '@/lib/use-all-rows';

const GET_DASHBOARD = graphql(`
  query Dashboard($limit: Int!, $offset: Int!) {
    persons(
      limit: $limit
      offset: $offset
      orderBy: { createdAt: { direction: asc, priority: 2 }, id: { direction: asc, priority: 1 } }
    ) {
      id
      displayName
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

/** One person as the dashboard query returns them. */
type DashboardPerson = DashboardQuery['persons'][number];

const { widgetLimit, upcomingWindowDays, dormantAfterDays, tasksDueWithinDays } = DASHBOARD_DEFAULTS;

/** From this many days without contact, the dormant label counts the years. */
const TWO_YEARS_IN_DAYS = 2 * DAYS_PER_YEAR;

/**
 * Whether a person last contacted this many days ago counts as a dormant tie.
 *
 * @param daysSince - Days since the last contact, or null when there has been none.
 * @returns True from `dormantAfterDays` on; false for a person never contacted.
 */
function isDormant(daysSince: number | null): boolean {
  return daysSince !== null && daysSince >= dormantAfterDays;
}

/**
 * What the reach-out list says about a dormant tie.
 *
 * @param daysSince - Days since the last contact, or null when there has been none.
 * @returns The label, counting whole years from two years on.
 */
function dormantLabel(daysSince: number | null): string {
  const isOverTwoYears = daysSince !== null && daysSince >= TWO_YEARS_IN_DAYS;
  if (isOverTwoYears) {
    return `No contact in over ${Math.floor(daysSince / DAYS_PER_YEAR)} years`;
  }
  return 'No contact in over a year';
}

/**
 * One merged "who should I contact" list: people past their check-in window
 * (sorted most-overdue first), then dormant ties (no contact in over a year).
 *
 * @param persons - Everyone on the dashboard, each with their latest interaction.
 * @returns The first `widgetLimit` of the list.
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
      displayName: person.displayName,
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
    .filter((entry) => isDormant(entry.daysSince))
    .sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0))
    .map(({ person, daysSince }) => ({
      id: person.id,
      displayName: person.displayName,
      avatarPath: person.avatarPath,
      statusLabel: dormantLabel(daysSince),
      isDormant: true,
    }));

  return [...overdue, ...dormant].slice(0, widgetLimit);
}

/**
 * Lists the important dates that fall inside the upcoming window, soonest first.
 *
 * @param persons - Everyone on the dashboard, each with their important dates.
 * @returns The first `widgetLimit` dates, each with the person it belongs to.
 */
function computeUpcomingDates(persons: DashboardPerson[]): UpcomingDate[] {
  const results: UpcomingDate[] = [];

  for (const person of persons) {
    for (const importantDate of person.importantDates) {
      const daysUntil = daysUntilNextOccurrence(importantDate.date, importantDate.recurrence);
      const isOutsideWindow = daysUntil === null || daysUntil > upcomingWindowDays;
      if (isOutsideWindow) {
        continue;
      }
      results.push({
        id: importantDate.id,
        name: importantDate.name,
        daysUntil,
        personId: person.id,
        personDisplayName: person.displayName,
      });
    }
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, widgetLimit);
}

/**
 * Lists the open tasks that are overdue or fall due within `tasksDueWithinDays` days. A task with no
 * due date is left out.
 *
 * @param persons - Everyone on the dashboard, each with their tasks.
 * @returns The first `widgetLimit` tasks, overdue ones first and then by due date.
 */
function computeOpenTasks(persons: DashboardPerson[]): OpenTask[] {
  const now = Date.now();
  const dueSoonBefore = now + tasksDueWithinDays * MS_PER_DAY;
  const results: OpenTask[] = [];

  for (const person of persons) {
    for (const task of person.tasks) {
      if (task.completedAt) {
        continue;
      }

      const dueAt = task.dueAt ? task.dueAt.getTime() : null;
      const isOverdue = dueAt !== null && dueAt < now;
      const isDueThisWeek = dueAt !== null && dueAt <= dueSoonBefore;

      const isBeyondThisWeek = isOverdue === false && isDueThisWeek === false;
      if (isBeyondThisWeek) {
        continue;
      }

      results.push({
        id: task.id,
        title: task.title,
        dueAt: task.dueAt ?? null,
        personId: person.id,
        personDisplayName: person.displayName,
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
    .slice(0, widgetLimit);
}

/**
 * Lists the people added most recently, newest first.
 *
 * @param persons - Everyone on the dashboard.
 * @returns The first `widgetLimit` people.
 */
function computeRecentlyAdded(persons: DashboardPerson[]): RecentPerson[] {
  return [...persons]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, widgetLimit)
    .map((p) => ({
      id: p.id,
      displayName: p.displayName,
      avatarPath: p.avatarPath,
      createdAt: p.createdAt,
    }));
}

/** Two columns from `md` up; the width sits on the cell because `gap-4` is not part of a percentage. */
const CELL = 'w-full md:w-[calc(50%-0.5rem)]';

/** The dashboard: who to reach out to, what is coming up, open tasks and the people added lately. */
export default function DashboardPage() {
  const { data, loading, error, refetch } = useAllRows(GET_DASHBOARD, { field: 'persons' });

  const persons = data?.persons ?? [];
  const pending = loading && !data;
  const hasFailedFirstLoad = Boolean(error) && !data;

  return (
    <PageLayout
      title="Dashboard"
      contentSlot={
        <View className="py-4">
          <QueryState
            query={{ isPending: pending, isError: hasFailedFirstLoad, error, refetch }}
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
                <ComingUp dates={computeUpcomingDates(persons)} windowDays={upcomingWindowDays} />
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
