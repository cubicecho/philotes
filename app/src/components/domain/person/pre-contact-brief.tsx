import { Text, View } from 'react-native';
import { CardLayout } from '@/components/card-layout';
import { ChannelIcon } from '@/components/domain/person/channel-icon';
import { EmptyState } from '@/components/page';
import { SectionHeading } from '@/components/section-heading';
import { Separator } from '@/components/ui/separator';
import { PRE_CONTACT_BRIEF_DEFAULTS } from '@/lib/defaults';
import { relativeTime } from '@/lib/relative-time';
import { MS_PER_DAY } from '@/lib/time';
import { cn } from '@/lib/utils';
import { InteractionChannel } from '@/lib/vocabulary';

interface Interaction {
  id: string;
  occurredAt: Date;
  channel: string;
  sentiment: string | null;
  note: string | null;
}

interface Note {
  id: string;
  body: string;
}

interface Task {
  id: string;
  title: string;
  dueAt: Date | null;
  completedAt: Date | null;
}

interface ImportantDate {
  id: string;
  name: string;
  date: Date;
}

const BRIEF = PRE_CONTACT_BRIEF_DEFAULTS;

export interface PreContactBriefProps {
  person: {
    firstName: string;
    lastName: string;
    contactFrequency: string | null;
    interactions: Interaction[];
    notes: Note[];
    tasks: Task[];
    importantDates: ImportantDate[];
  };
}

function daysUntil(date: Date): number {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.ceil(diffMs / MS_PER_DAY);
}

/** Format relative due date for a task. */
function dueDateLabel(dueAt: Date | null): string | null {
  if (!dueAt) {
    return null;
  }
  const days = daysUntil(dueAt);
  if (days < 0) {
    return `overdue ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  }
  if (days === 0) {
    return 'due today';
  }
  if (days === 1) {
    return 'due tomorrow';
  }
  return `due in ${days} days`;
}

/**
 * Returns the next occurrence of a month+day date, when it falls inside the brief's window.
 * Handles annual recurrence by projecting the stored date to the current year
 * (or next year if this year's occurrence has already passed).
 */
function nextOccurrenceInWindow(stored: Date): number | null {
  const month = stored.getUTCMonth();
  const day = stored.getUTCDate();

  const now = new Date();
  const thisYear = new Date(Date.UTC(now.getUTCFullYear(), month, day));
  const nextYear = new Date(Date.UTC(now.getUTCFullYear() + 1, month, day));

  const candidate = thisYear >= now ? thisYear : nextYear;
  const diff = Math.ceil((candidate.getTime() - now.getTime()) / MS_PER_DAY);

  return diff <= BRIEF.upcomingWindowDays ? diff : null;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}…`;
}

/** How the brief words each channel. `video` is no longer offered, but older interactions may hold it. */
const CHANNEL_LABELS: Record<string, string> = {
  [InteractionChannel.Call]: 'Phone call',
  [InteractionChannel.Text]: 'Text',
  [InteractionChannel.Email]: 'Email',
  [InteractionChannel.InPerson]: 'In person',
  video: 'Video call',
};

function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

export function PreContactBrief({ person }: PreContactBriefProps) {
  const sortedInteractions = [...person.interactions].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const lastInteraction = sortedInteractions[0] ?? null;

  const recentNotes = person.notes.slice(0, BRIEF.maxNotes);

  const openTasks = person.tasks.filter((t) => t.completedAt === null).slice(0, BRIEF.maxTasks);

  const upcomingDates = person.importantDates
    .map((d) => ({ date: d, daysAway: nextOccurrenceInWindow(d.date) }))
    .filter((entry): entry is { date: ImportantDate; daysAway: number } => entry.daysAway !== null)
    .sort((a, b) => a.daysAway - b.daysAway);

  return (
    <CardLayout
      title="Before You Reach Out"
      contentClassName="gap-4"
      contentSlot={
        <>
          <View className="gap-1.5">
            <SectionHeading variant="overline">Last Interaction</SectionHeading>
            {lastInteraction ? (
              <View className="gap-1">
                <View className="flex-row items-center gap-2">
                  <ChannelIcon channel={lastInteraction.channel} className="h-4 w-4 shrink-0 text-foreground/60" />
                  <Text className="shrink text-foreground text-sm">
                    {channelLabel(lastInteraction.channel)}{' '}
                    <Text className="text-foreground/60">· {relativeTime(lastInteraction.occurredAt)}</Text>
                  </Text>
                </View>
                {lastInteraction.note ? (
                  <Text className="pl-6 text-foreground/60 text-xs">
                    {truncate(lastInteraction.note, BRIEF.interactionNoteExcerptLength)}
                  </Text>
                ) : null}
              </View>
            ) : (
              <EmptyState compact title="No interactions logged yet." />
            )}
          </View>

          {recentNotes.length > 0 ? (
            <>
              <Separator />
              <View className="gap-1.5">
                <SectionHeading variant="overline">Recent Notes</SectionHeading>
                <View role="list" className="gap-1">
                  {recentNotes.map((note) => (
                    <View key={note.id} role="listitem" className="flex-row gap-1.5">
                      <View className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
                      <Text className="shrink text-foreground/60 text-sm">
                        {truncate(note.body, BRIEF.noteExcerptLength)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : null}

          {openTasks.length > 0 ? (
            <>
              <Separator />
              <View className="gap-1.5">
                <SectionHeading variant="overline">Open Tasks</SectionHeading>
                <View role="list" className="gap-1.5">
                  {openTasks.map((task) => {
                    const due = dueDateLabel(task.dueAt);
                    const isOverdue = due?.startsWith('overdue');
                    return (
                      <View key={task.id} role="listitem" className="flex-row items-baseline gap-2">
                        <Text className="shrink-0 text-foreground/60 text-sm">·</Text>
                        <Text className="flex-1 text-foreground text-sm">{task.title}</Text>
                        {due ? (
                          <Text className={cn('shrink-0 text-xs', isOverdue ? 'text-negative' : 'text-foreground/60')}>
                            {due}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          ) : null}

          {upcomingDates.length > 0 ? (
            <>
              <Separator />
              <View className="gap-1.5">
                <SectionHeading variant="overline">Upcoming Dates</SectionHeading>
                <View role="list" className="gap-1.5">
                  {upcomingDates.map(({ date, daysAway }) => (
                    <View key={date.id} role="listitem" className="flex-row items-center justify-between gap-2">
                      <Text className="shrink text-foreground text-sm">{date.name}</Text>
                      <Text className="shrink-0 text-foreground/60 text-xs">
                        {daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : null}
        </>
      }
    />
  );
}
