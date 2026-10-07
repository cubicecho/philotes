import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { SquareCheck } from '@/components/app-icons';
import { ListItem } from '@/components/list-item';
import { Widget } from './widget';

export type OpenTask = {
  id: string;
  title: string;
  dueAt: Date | null;
  personId: string;
  personFirstName: string;
  personLastName: string;
  isOverdue: boolean;
};

function dueLabel(task: OpenTask): string {
  if (!task.dueAt) {
    return '';
  }
  const formatted = task.dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return task.isOverdue ? `Overdue · ${formatted}` : formatted;
}

export function OpenTasks({ tasks }: { tasks: OpenTask[] }) {
  const router = useRouter();

  return (
    <Widget
      iconSlot={<SquareCheck />}
      title="Open Tasks"
      subtitle="due this week or overdue"
      emptyMessage="No tasks due"
      contentSlot={tasks.map((t) => (
        <ListItem
          key={t.id}
          title={t.title}
          description={`${t.personFirstName} ${t.personLastName}`}
          meta={t.isOverdue ? <Text className="font-medium text-negative text-xs">{dueLabel(t)}</Text> : dueLabel(t)}
          onPress={() => router.push(`/persons/${t.personId}`)}
        />
      ))}
    />
  );
}
