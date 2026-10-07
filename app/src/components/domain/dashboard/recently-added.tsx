import { useRouter } from 'expo-router';
import { UserPlus } from '@/components/app-icons';
import { Avatar } from '@/components/domain/person/avatar';
import { ListItem } from '@/components/list-item';
import { personName } from '@/lib/person-name';
import { relativeTime } from '@/lib/relative-time';
import { Widget } from './widget';

/** A person as the recently-added card shows them. */
export type RecentPerson = {
  id: string;
  /** The person's name as the server worked it out. Empty when they have none. */
  displayName: string;
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
          leadingSlot={<Avatar name={personName(p)} avatarPath={p.avatarPath} size="sm" />}
          title={personName(p)}
          meta={relativeTime(p.createdAt)}
          onPress={() => router.push(`/persons/${p.id}`)}
        />
      ))}
    />
  );
}
