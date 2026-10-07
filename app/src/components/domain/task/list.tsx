import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { useAppForm } from '@/components/app-form';
import { ConfirmButton } from '@/components/confirm-button';
import { ListItem } from '@/components/list-item';
import { EmptyState } from '@/components/page';
import { SectionHeading } from '@/components/section-heading';
import { Checkbox } from '@/components/ui/checkbox';
import { Form } from '@/components/ui/form';
import { FormDialog, FormDialogFooter } from '@/components/ui/form-dialog';
import { Trash2 } from '@/components/ui/icons';

export const TASK_LIST = graphql(`
  fragment Person_Tasks on Person {
    id
    tasks {
      id
      title
      notes
      dueAt
      completedAt
      createdAt
    }
  }
`);

const CREATE_TASK = graphql(`
  mutation CreateTask(
    $personId: UUID!
    $title: String!
    $notes: String
    $dueAt: DateTime
  ) {
    createTask(
      values: {
        personId: $personId
        title: $title
        notes: $notes
        dueAt: $dueAt
      }
    ) {
      id
      personId
      title
      notes
      dueAt
      completedAt
      createdAt
    }
  }
`);

const UPDATE_TASK = graphql(`
  mutation UpdateTask($id: UUID!, $completedAt: DateTime) {
    updateTask(
      set: { completedAt: $completedAt }
      where: { id: { eq: $id } }
    ) {
      id
      completedAt
    }
  }
`);

const DELETE_TASK = graphql(`
  mutation DeleteTask($id: UUID!) {
    deleteTask(where: { id: { eq: $id } }) {
      id
    }
  }
`);

export interface TaskData {
  id: string;
  title: string;
  notes: string | null | undefined;
  dueAt: Date | null | undefined;
  completedAt: Date | null | undefined;
  createdAt: Date | null | undefined;
}

export interface TaskListProps {
  personId: string;
  tasks: TaskData[];
  onAdd: () => void;
  onDelete: () => void;
  onUpdate: () => void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
}

function formatDueDate(dueAt: Date): string {
  return dueAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface TaskRowProps {
  task: TaskData;
  onDelete: () => void;
  onUpdate: () => void;
}

function TaskRow({ task, onDelete, onUpdate }: TaskRowProps) {
  const [updateTask] = useMutation(UPDATE_TASK);
  const [deleteTask] = useMutation(DELETE_TASK);

  const isCompleted = task.completedAt != null;

  const handleToggle = async () => {
    const completedAt = isCompleted ? null : new Date();
    await updateTask({ variables: { id: task.id, completedAt } });
    onUpdate();
  };

  const handleDelete = async () => {
    await deleteTask({ variables: { id: task.id } });
    onDelete();
  };

  const details = [task.notes, task.dueAt ? `Due: ${formatDueDate(task.dueAt)}` : null].filter(Boolean).join('\n');

  return (
    <ListItem
      className="rounded-md border border-foreground/10"
      leadingSlot={
        <Checkbox
          checked={isCompleted}
          onCheckedChange={handleToggle}
          accessibilityLabel={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        />
      }
      title={task.title}
      titleClassName={isCompleted ? 'font-normal text-foreground/60 line-through' : undefined}
      description={details || undefined}
      actionSlot={
        <ConfirmButton
          variant="ghost"
          size="icon-sm"
          label="Delete task"
          iconSlot={<Trash2 />}
          title="Delete this task?"
          description={`"${task.title}" is removed whether or not it is done. It cannot be brought back.`}
          onConfirm={handleDelete}
        />
      }
    />
  );
}

interface AddTaskFormProps {
  personId: string;
  onAdded: () => void;
  onCancel: () => void;
}

interface AddTaskFields {
  title: string;
  notes: string;
  dueAt: Date | null;
}

function AddTaskForm({ personId, onAdded, onCancel }: AddTaskFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [createTask] = useMutation(CREATE_TASK);

  const defaultValues: AddTaskFields = { title: '', notes: '', dueAt: null };

  const form = useAppForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await createTask({
          variables: {
            personId,
            title: value.title,
            notes: value.notes || null,
            // Omitted rather than null: the server stores an explicit null DateTime as the epoch.
            dueAt: value.dueAt ?? undefined,
          },
        });
        form.reset();
        onAdded();
      } catch (err: unknown) {
        if (err instanceof Error) {
          setFormError(err.message);
        } else {
          setFormError('An unexpected error occurred.');
        }
      }
    },
  });

  return (
    <form.AppForm>
      <Form className="gap-4">
        <form.AppField name="title">{(field) => <field.InputField label="Title" />}</form.AppField>
        <form.AppField name="notes">{(field) => <field.InputField label="Notes" />}</form.AppField>
        <form.AppField name="dueAt">
          {(field) => <field.DateTimeField label="Due Date" mode="datetime" clearable />}
        </form.AppField>
        <FormDialogFooter onCancel={onCancel} error={formError}>
          <form.SubmitButton createLabel="Add Task" savingLabel="Adding..." />
        </FormDialogFooter>
      </Form>
    </form.AppForm>
  );
}

export function TaskList({
  personId,
  tasks,
  onAdd,
  onDelete,
  onUpdate,
  createOpen,
  onCreateOpenChange,
}: TaskListProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const addDialogOpen = createOpen ?? internalOpen;
  const setAddDialogOpen = onCreateOpenChange ?? setInternalOpen;

  const openTasks = tasks.filter((t) => t.completedAt == null);
  const doneTasks = tasks.filter((t) => t.completedAt != null);
  const hasNoTasks = openTasks.length === 0 && doneTasks.length === 0;

  return (
    <View className="gap-4">
      {hasNoTasks && <EmptyState compact title="No tasks yet." />}

      {openTasks.length > 0 && (
        <View className="gap-2">
          <SectionHeading variant="overline" level={3}>
            Open
          </SectionHeading>
          {openTasks.map((task) => (
            <TaskRow key={task.id} task={task} onDelete={onDelete} onUpdate={onUpdate} />
          ))}
        </View>
      )}

      {doneTasks.length > 0 && (
        <View className="gap-2">
          <SectionHeading variant="overline" level={3}>
            Done
          </SectionHeading>
          {doneTasks.map((task) => (
            <TaskRow key={task.id} task={task} onDelete={onDelete} onUpdate={onUpdate} />
          ))}
        </View>
      )}

      <FormDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} title="Add Task">
        <AddTaskForm
          personId={personId}
          onAdded={() => {
            setAddDialogOpen(false);
            onAdd();
          }}
          onCancel={() => setAddDialogOpen(false)}
        />
      </FormDialog>
    </View>
  );
}
