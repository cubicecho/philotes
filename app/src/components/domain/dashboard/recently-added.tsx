import { useRouter } from 'expo-router';
import { UserPlus } from '@/components/app-icons';
import { Avatar } from '@/components/domain/person/avatar';
import { ListItem } from '@/components/list-item';
import { fullName } from '@/lib/person-name';
import { relativeTime } from '@/lib/relative-time';
import { Widget } from './widget';

/** A person as the recently-added card shows them. */
export type RecentPerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarPath?: string | null;
  createdAt: Date;
};

/** The dashboard card of the newest people, each with how long ago they were added. */
export function RecentlyAdded({ persons }: { persons: RecentPerson[] }) {
  const router = useRouter();

  return (
    <Widget
      iconSlot={<UserPlus />}
      title="Recently Added"
      actionHref="/persons"
      emptyTitle="No one new yet"
      contentSlot={persons.map((p) => (
        <ListItem
          key={p.id}
          leadingSlot={<Avatar firstName={p.firstName} lastName={p.lastName} avatarPath={p.avatarPath} size="sm" />}
          title={fullName(p)}
          meta={relativeTime(p.createdAt)}
          onPress={() => router.push(`/persons/${p.id}`)}
        />
      ))}
    />
  );
}
