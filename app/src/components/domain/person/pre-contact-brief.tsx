import { Mail, MessageSquare, MoreHorizontal, Phone, Users, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { relativeTime } from '@/lib/relative-time';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntil(date: Date): number {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/** Format relative due date for a task. */
function dueDateLabel(dueAt: Date | null): string | null {
  if (!dueAt) return null;
  const days = daysUntil(dueAt);
  if (days < 0) return `overdue ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days} days`;
}

/**
 * Returns the next occurrence of a month+day date within the next 60 days.
 * Handles annual recurrence by projecting the stored date to the current year
 * (or next year if this year's occurrence has already passed).
 */
function nextOccurrenceWithin60Days(stored: Date): number | null {
  const month = stored.getUTCMonth();
  const day = stored.getUTCDate();

  const now = new Date();
  const thisYear = new Date(Date.UTC(now.getUTCFullYear(), month, day));
  const nextYear = new Date(Date.UTC(now.getUTCFullYear() + 1, month, day));

  const candidate = thisYear >= now ? thisYear : nextYear;
  const diff = Math.ceil((candidate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return diff <= 60 ? diff : null;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type ChannelIconProps = {
  channel: string;
  className?: string;
};

function ChannelIcon({ channel, className }: ChannelIconProps) {
  switch (channel) {
    case 'call':
      return <Phone className={className} />;
    case 'text':
      return <MessageSquare className={className} />;
    case 'email':
      return <Mail className={className} />;
    case 'video':
      return <Video className={className} />;
    case 'in-person':
      return <Users className={className} />;
    default:
      return <MoreHorizontal className={className} />;
  }
}

function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    call: 'Phone call',
    text: 'Text',
    email: 'Email',
    video: 'Video call',
    'in-person': 'In person',
  };
  return labels[channel] ?? channel;
}

function SectionDivider() {
  return <hr className="border-t border-border" />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PreContactBrief({ person }: PreContactBriefProps) {
  const sortedInteractions = [...person.interactions].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const lastInteraction = sortedInteractions[0] ?? null;

  const recentNotes = person.notes.slice(0, 3);

  const openTasks = person.tasks.filter((t) => t.completedAt === null).slice(0, 3);

  const upcomingDates = person.importantDates
    .map((d) => ({ date: d, daysAway: nextOccurrenceWithin60Days(d.date) }))
    .filter((entry): entry is { date: ImportantDate; daysAway: number } => entry.daysAway !== null)
    .sort((a, b) => a.daysAway - b.daysAway);

  const hasNotes = recentNotes.length > 0;
  const hasTasks = openTasks.length > 0;
  const hasDates = upcomingDates.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Before You Reach Out</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Last interaction */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Last Interaction</p>
          {lastInteraction ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <ChannelIcon channel={lastInteraction.channel} className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {channelLabel(lastInteraction.channel)}{' '}
                  <span className="text-muted-foreground">· {relativeTime(lastInteraction.occurredAt)}</span>
                </span>
              </div>
              {lastInteraction.note && (
                <p className="text-muted-foreground text-xs pl-6">{truncate(lastInteraction.note, 100)}</p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No interactions logged yet</p>
          )}
        </div>

        {/* Recent notes */}
        {hasNotes && (
          <>
            <SectionDivider />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Recent Notes</p>
              <ul className="space-y-1">
                {recentNotes.map((note) => (
                  <li key={note.id} className="flex gap-1.5 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                    <span className="text-muted-foreground">{truncate(note.body, 80)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Open tasks */}
        {hasTasks && (
          <>
            <SectionDivider />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Open Tasks</p>
              <ul className="space-y-1.5">
                {openTasks.map((task) => {
                  const due = dueDateLabel(task.dueAt);
                  const isOverdue = due?.startsWith('overdue');
                  return (
                    <li key={task.id} className="flex items-baseline gap-2 text-sm">
                      <span className="shrink-0 text-muted-foreground">·</span>
                      <span className="flex-1">{task.title}</span>
                      {due && (
                        <span
                          className={`shrink-0 text-xs ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}
                        >
                          {due}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        {/* Upcoming dates */}
        {hasDates && (
          <>
            <SectionDivider />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">Upcoming Dates</p>
              <ul className="space-y-1.5">
                {upcomingDates.map(({ date, daysAway }) => (
                  <li key={date.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>{date.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
