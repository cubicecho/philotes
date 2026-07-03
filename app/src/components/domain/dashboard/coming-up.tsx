import { Link } from 'expo-router';
import { CalendarDays } from 'lucide-react';
import { AllCaughtUp, Widget } from './widget';

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
  return (
    <Widget icon={<CalendarDays />} title="Coming Up" subtitle={`next ${windowDays} days`}>
      {dates.length === 0 ? (
        <AllCaughtUp message="Nothing on the calendar" />
      ) : (
        <ul className="space-y-1">
          {dates.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <Link
                  href={`/persons/${d.personId}`}
                  className="block truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {d.personFirstName} {d.personLastName}
                </Link>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  d.daysUntil <= 1 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                {daysLabel(d.daysUntil)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}
