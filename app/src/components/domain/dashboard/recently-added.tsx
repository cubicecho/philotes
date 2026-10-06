import { useRouter } from 'expo-router';
import { UserPlus } from '@/components/app-icons';
import { Avatar } from '@/components/domain/person/avatar';
import { ListItem } from '@/components/list-item';
import { relativeTime } from '@/lib/relative-time';
import { Widget } from './widget';

export type RecentPerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarPath?: string | null;
  createdAt: Date;
};

export function RecentlyAdded({ persons }: { persons: RecentPerson[] }) {
  const router = useRouter();

  return (
    <Widget
      iconSlot={<UserPlus />}
      title="Recently Added"
      viewAllHref="/persons"
      emptyMessage="No one new yet"
      contentSlot={persons.map((p) => (
        <ListItem
          key={p.id}
          leadingSlot={<Avatar firstName={p.firstName} lastName={p.lastName} avatarPath={p.avatarPath} size="sm" />}
          title={`${p.firstName} ${p.lastName}`}
          meta={relativeTime(p.createdAt)}
          onPress={() => router.push(`/persons/${p.id}`)}
        />
      ))}
    />
  );
}
