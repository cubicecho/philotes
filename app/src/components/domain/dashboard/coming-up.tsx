import { useRouter } from 'expo-router';
import { CalendarDays } from '@/components/app-icons';
import { ListItem } from '@/components/list-item';
import { Badge } from '@/components/ui/badge';
import { Widget } from './widget';

/** An important date coming up, with the person it belongs to. */
export type UpcomingDate = {
  id: string;
  name: string;
  /** Whole days from today; 0 is today. */
  daysUntil: number;
  personId: string;
  personFirstName: string;
  personLastName: string;
};

/**
 * How far off a date is, in the words its badge shows.
 *
 * @param days - Whole days from today.
 * @returns `Today`, `Tomorrow` or `In N days`.
 */
function daysLabel(days: number): string {
  if (days === 0) {
    return 'Today';
  }
  if (days === 1) {
    return 'Tomorrow';
  }
  return `In ${days} days`;
}

/** The dashboard card of the important dates that fall in the next `windowDays` days, each opening its person. */
export function ComingUp({ dates, windowDays }: { dates: UpcomingDate[]; windowDays: number }) {
  const router = useRouter();

  return (
    <Widget
      iconSlot={<CalendarDays />}
      title="Coming Up"
      description={`next ${windowDays} days`}
      emptyTitle="Nothing on the calendar"
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
