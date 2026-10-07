import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { SquareCheck } from '@/components/app-icons';
import { ListItem } from '@/components/list-item';
import { Widget } from './widget';

/** A task not yet done, with the person it belongs to. */
export type OpenTask = {
  id: string;
  title: string;
  /** `null` when the task has no due date. */
  dueAt: Date | null;
  personId: string;
  personFirstName: string;
  personLastName: string;
  isOverdue: boolean;
};

/**
 * A task's due day, flagged when it has passed.
 *
 * @param task - The task.
 * @returns The day as `Mon D`, after `Overdue · ` when the task is overdue; empty when it has no due date.
 */
function dueLabel(task: OpenTask): string {
  if (!task.dueAt) {
    return '';
  }
  const formatted = task.dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return task.isOverdue ? `Overdue · ${formatted}` : formatted;
}

/** The dashboard card of open tasks, each with whose it is and when it is due. */
export function OpenTasks({ tasks }: { tasks: OpenTask[] }) {
  const router = useRouter();

  return (
    <Widget
      iconSlot={<SquareCheck />}
      title="Open Tasks"
      description="due this week or overdue"
      emptyTitle="No tasks due"
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
