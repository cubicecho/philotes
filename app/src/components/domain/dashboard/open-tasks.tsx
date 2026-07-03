import { Link } from 'expo-router';
import { CheckSquare } from 'lucide-react';
import { AllCaughtUp, Widget } from './widget';

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
  if (!task.dueAt) return '';
  const formatted = task.dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return task.isOverdue ? `Overdue · ${formatted}` : formatted;
}

export function OpenTasks({ tasks }: { tasks: OpenTask[] }) {
  return (
    <Widget icon={<CheckSquare />} title="Open Tasks" subtitle="due this week or overdue">
      {tasks.length === 0 ? (
        <AllCaughtUp message="No tasks due" />
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.title}</p>
                <Link
                  href={`/persons/${t.personId}`}
                  className="block truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {t.personFirstName} {t.personLastName}
                </Link>
              </div>
              {t.dueAt && (
                <span
                  className={`shrink-0 text-xs ${
                    t.isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {dueLabel(t)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Widget>
  );
}
