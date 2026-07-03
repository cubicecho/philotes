import { Link } from 'expo-router';
import { UserPlus } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { relativeTime } from '@/lib/relative-time';
import { AllCaughtUp, Widget } from './widget';

export type RecentPerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarPath?: string | null;
  createdAt: Date;
};

export function RecentlyAdded({ persons }: { persons: RecentPerson[] }) {
  return (
    <Widget icon={<UserPlus />} title="Recently Added" viewAllHref="/persons">
      {persons.length === 0 ? (
        <AllCaughtUp message="No one new yet" />
      ) : (
        <ul className="space-y-1">
          {persons.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
              <Avatar firstName={p.firstName} lastName={p.lastName} avatarPath={p.avatarPath} size="sm" />
              <Link href={`/persons/${p.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline">
                {p.firstName} {p.lastName}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(p.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}
