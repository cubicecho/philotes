import { Mail, MessageSquare, MoreHorizontal, Phone, Users } from 'lucide-react';
import { relativeTime } from '@/lib/relative-time';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineInteraction {
  id: string;
  channel: string;
  occurredAt: Date;
  sentiment: string | null | undefined;
  note: string | null | undefined;
  labels: Array<{ id: string; label: string; color: string }>;
}

export interface TimelineImportantDate {
  id: string;
  date: Date;
  name: string;
  milestoneType: string | null | undefined;
  labels: Array<{ id: string; label: string; color: string }>;
}

export interface PersonTimelineProps {
  interactions: TimelineInteraction[];
  importantDates: TimelineImportantDate[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TimelineItemType = 'interaction' | 'importantDate';

interface TimelineItem {
  id: string;
  type: TimelineItemType;
  date: Date;
  data: TimelineInteraction | TimelineImportantDate;
}

const SENTIMENT_EMOJI: Record<string, string> = {
  great: '😄',
  good: '🙂',
  neutral: '😐',
  difficult: '😟',
};

const MILESTONE_EMOJI: Record<string, string> = {
  new_job: '💼',
  promotion: '🏆',
  moved: '📦',
  new_baby: '👶',
  married: '💍',
  divorced: '📃',
  retired: '🌅',
  health_event: '🏥',
  graduation: '🎓',
  loss: '🕊️',
  other: '🎉',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function monthYearKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Channel icon (mirrors interactions.tsx without importing from it)
// ---------------------------------------------------------------------------

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  switch (channel) {
    case 'call':
      return <Phone className={className} />;
    case 'text':
      return <MessageSquare className={className} />;
    case 'email':
      return <Mail className={className} />;
    case 'in-person':
      return <Users className={className} />;
    default:
      return <MoreHorizontal className={className} />;
  }
}

// ---------------------------------------------------------------------------
// Individual entry renderers
// ---------------------------------------------------------------------------

function InteractionEntry({ item }: { item: TimelineInteraction }) {
  const emoji = item.sentiment ? (SENTIMENT_EMOJI[item.sentiment] ?? '') : '';
  return (
    <div className="flex items-start gap-2 min-w-0">
      <ChannelIcon channel={item.channel} className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium capitalize">
          {item.channel === 'in-person' ? 'In Person' : item.channel}
          {emoji && <span className="ml-1.5">{emoji}</span>}
        </p>
        {item.note && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-3">{item.note}</p>}
        {item.labels.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.labels.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ImportantDateEntry({ item }: { item: TimelineImportantDate }) {
  const emoji = item.milestoneType ? (MILESTONE_EMOJI[item.milestoneType] ?? '📅') : '📅';
  return (
    <div className="flex items-start gap-2 min-w-0">
      <span className="text-lg leading-none mt-0.5 shrink-0">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.name}</p>
        {item.labels.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.labels.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function PersonTimeline({ interactions, importantDates }: PersonTimelineProps) {
  // Build unified list
  const items: TimelineItem[] = [
    ...interactions.map((i): TimelineItem => ({ id: `i-${i.id}`, type: 'interaction', date: i.occurredAt, data: i })),
    ...importantDates.map((d): TimelineItem => ({ id: `d-${d.id}`, type: 'importantDate', date: d.date, data: d })),
  ];

  // Sort descending by date
  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">No timeline events yet.</p>;
  }

  // Group by month-year
  const groups: Array<{ key: string; heading: string; items: TimelineItem[] }> = [];
  for (const item of items) {
    const key = monthYearKey(item.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, heading: formatMonthYear(item.date), items: [item] });
    }
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key}>
          {/* Month heading */}
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{group.heading}</h3>

          {/* Entries */}
          <div className="relative ml-4 border-l border-border space-y-0">
            {group.items.map((item) => (
              <div key={item.id} className="relative pl-6 pb-5 last:pb-0">
                {/* Timeline dot */}
                <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-muted-foreground" />

                {/* Date label */}
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-xs text-muted-foreground font-medium">{formatDate(item.date)}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{relativeTime(item.date)}</span>
                </div>

                {/* Entry content */}
                {item.type === 'interaction' && <InteractionEntry item={item.data as TimelineInteraction} />}
                {item.type === 'importantDate' && <ImportantDateEntry item={item.data as TimelineImportantDate} />}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
