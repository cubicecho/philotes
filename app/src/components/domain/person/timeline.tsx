import { Text, View } from 'react-native';
import { ImportantDatesMilestoneTypeEnum as Milestone } from '@/__generated__/graphql';
import { LabelChip } from '@/components/domain/label/label-chip';
import { ChannelIcon } from '@/components/domain/person/channel-icon';
import { sentimentEmoji } from '@/components/domain/person/interaction-form';
import { EmptyState } from '@/components/page';
import { SectionHeading } from '@/components/section-heading';
import { formatDate } from '@/lib/format';
import { relativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';
import { InteractionChannel } from '@/lib/vocabulary';

type TimelineLabel = { id: string; label: string; color: string };

export interface TimelineInteraction {
  id: string;
  channel: string;
  occurredAt: Date;
  sentiment: string | null | undefined;
  note: string | null | undefined;
  labels: TimelineLabel[];
}

export interface TimelineImportantDate {
  id: string;
  date: Date;
  name: string;
  milestoneType: string | null | undefined;
  labels: TimelineLabel[];
}

export interface PersonTimelineProps {
  interactions: TimelineInteraction[];
  importantDates: TimelineImportantDate[];
}

type TimelineItem =
  | { id: string; type: 'interaction'; date: Date; data: TimelineInteraction }
  | { id: string; type: 'importantDate'; date: Date; data: TimelineImportantDate };

/** The emoji that stands for each milestone on the timeline. */
const MILESTONE_EMOJI: Record<string, string> = {
  [Milestone.NewJob]: '💼',
  [Milestone.Promotion]: '🏆',
  [Milestone.Moved]: '📦',
  [Milestone.NewBaby]: '👶',
  [Milestone.Married]: '💍',
  [Milestone.Divorced]: '📃',
  [Milestone.Retired]: '🌅',
  [Milestone.HealthEvent]: '🏥',
  [Milestone.Graduation]: '🎓',
  [Milestone.Loss]: '🕊️',
  [Milestone.Other]: '🎉',
} satisfies Record<Milestone, string>;

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function monthYearKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function EntryLabels({ labels }: { labels: TimelineLabel[] }) {
  if (labels.length === 0) {
    return null;
  }
  return (
    <View className="mt-1 flex-row flex-wrap gap-1">
      {labels.map((l) => (
        <LabelChip key={l.id} label={l.label} color={l.color} />
      ))}
    </View>
  );
}

function InteractionEntry({ item }: { item: TimelineInteraction }) {
  const emoji = sentimentEmoji(item.sentiment);
  const channel = item.channel === InteractionChannel.InPerson ? 'In Person' : item.channel;
  return (
    <View className="min-w-0 flex-row items-start gap-2">
      <ChannelIcon channel={item.channel} className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60" />
      <View className="min-w-0 flex-1">
        <Text className="font-medium text-foreground text-sm capitalize">
          {emoji ? `${channel} ${emoji}` : channel}
        </Text>
        {item.note ? (
          <Text numberOfLines={3} className="mt-0.5 text-foreground/60 text-sm">
            {item.note}
          </Text>
        ) : null}
        <EntryLabels labels={item.labels} />
      </View>
    </View>
  );
}

function ImportantDateEntry({ item }: { item: TimelineImportantDate }) {
  const emoji = item.milestoneType ? (MILESTONE_EMOJI[item.milestoneType] ?? '📅') : '📅';
  return (
    <View className="min-w-0 flex-row items-start gap-2">
      <Text className="shrink-0 text-foreground text-lg leading-none">{emoji}</Text>
      <View className="min-w-0 flex-1">
        <Text className="font-medium text-foreground text-sm">{item.name}</Text>
        <EntryLabels labels={item.labels} />
      </View>
    </View>
  );
}

export function PersonTimeline({ interactions, importantDates }: PersonTimelineProps) {
  const items: TimelineItem[] = [
    ...interactions.map((i): TimelineItem => ({ id: `i-${i.id}`, type: 'interaction', date: i.occurredAt, data: i })),
    ...importantDates.map((d): TimelineItem => ({ id: `d-${d.id}`, type: 'importantDate', date: d.date, data: d })),
  ];

  // Newest first
  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  if (items.length === 0) {
    return <EmptyState compact title="No timeline events yet." />;
  }

  // Group by month-year
  const groups: Array<{ key: string; heading: string; items: TimelineItem[] }> = [];
  for (const item of items) {
    const key = monthYearKey(item.date);
    const last = groups[groups.length - 1];
    const isSameMonth = last !== undefined && last.key === key;
    if (isSameMonth) {
      last.items.push(item);
    } else {
      groups.push({ key, heading: formatMonthYear(item.date), items: [item] });
    }
  }

  return (
    <View className="gap-6">
      {groups.map((group) => (
        <View key={group.key} className="gap-3">
          <SectionHeading variant="overline" level={2}>
            {group.heading}
          </SectionHeading>

          {/* The rail is this view's left border; each entry's dot sits on it. */}
          <View className="ml-4 border-foreground/10 border-l">
            {group.items.map((item, index) => {
              const isLastItem = index === group.items.length - 1;
              return (
                <View key={item.id} className={cn('relative pl-6', isLastItem === false && 'pb-5')}>
                  <View className="absolute top-1 -left-[5px] h-2.5 w-2.5 rounded-full border-2 border-background bg-foreground/60" />

                  <View className="mb-1 flex-row items-baseline gap-2">
                    <Text className="font-medium text-foreground/60 text-xs">{formatDate(item.date)}</Text>
                    <Text className="text-foreground/60 text-xs">·</Text>
                    <Text className="text-foreground/60 text-xs">{relativeTime(item.date)}</Text>
                  </View>

                  {item.type === 'interaction' ? (
                    <InteractionEntry item={item.data} />
                  ) : (
                    <ImportantDateEntry item={item.data} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}
