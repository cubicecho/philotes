import { useRouter } from 'expo-router';
import { CalendarDays } from '@/components/app-icons';
import { ListItem } from '@/components/list-item';
import { Badge } from '@/components/ui/badge';
import { Widget } from './widget';

export type UpcomingDate = {
  id: string;
  name: string;
  daysUntil: number;
  personId: string;
  personFirstName: string;
  personLastName: string;
};

function daysLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

export function ComingUp({ dates, windowDays }: { dates: UpcomingDate[]; windowDays: number }) {
  const router = useRouter();

  return (
    <Widget
      iconSlot={<CalendarDays />}
      title="Coming Up"
      subtitle={`next ${windowDays} days`}
      emptyMessage="Nothing on the calendar"
      contentSlot={dates.map((d) => (
        <ListItem
          key={d.id}
          title={d.name}
          description={`${d.personFirstName} ${d.personLastName}`}
          meta={<Badge variant={d.daysUntil <= 1 ? 'info' : 'secondary'}>{daysLabel(d.daysUntil)}</Badge>}
          onPress={() => router.push(`/persons/${d.personId}`)}
        />
      ))}
    />
  );
}
