import { useMutation } from '@apollo/client';
import { CheckSquare, Square, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql';
import { useAppForm } from '@/components/domain/person/form.tsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FieldGroup } from '@/components/ui/field';
import { FormError } from '@/components/ui/form-field.tsx';

// ---------------------------------------------------------------------------
// Fragment
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const CREATE_TASK = graphql(`
  mutation CreateTask(
    $personId: String!
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
  mutation UpdateTask($id: String!, $completedAt: DateTime) {
    updateTasks(
      set: { completedAt: $completedAt }
      where: { id: { eq: $id } }
    ) {
      id
      completedAt
    }
  }
`);

const DELETE_TASK = graphql(`
  mutation DeleteTask($id: String!) {
    deleteTasks(where: { id: { eq: $id } }) {
      id
    }
  }
`);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDueDate(dueAt: Date): string {
  return dueAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------

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

  return (
    <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
      <button
        type="button"
        onClick={handleToggle}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {isCompleted ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4" />}
      </button>

      <div className="min-w-0 flex-1">
        <p className={isCompleted ? 'line-through text-muted-foreground' : 'font-medium'}>{task.title}</p>
        {task.notes && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{task.notes}</p>}
        {task.dueAt && <p className="text-xs text-muted-foreground mt-0.5">Due: {formatDueDate(task.dueAt)}</p>}
      </div>

      <button
        type="button"
        onClick={handleDelete}
        className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
        aria-label="Delete task"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add task form
// ---------------------------------------------------------------------------

interface AddTaskFormProps {
  personId: string;
  onAdded: () => void;
  onCancel: () => void;
}

function AddTaskForm({ personId, onAdded, onCancel }: AddTaskFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [createTask] = useMutation(CREATE_TASK);

  const form = useAppForm({
    defaultValues: {
      title: '',
      notes: '',
      dueAt: '',
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await createTask({
          variables: {
            personId,
            title: value.title,
            notes: value.notes || null,
            dueAt: value.dueAt ? new Date(value.dueAt) : null,
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-4">
        <form.AppField name="title">{(field) => <field.TextField label="Title" />}</form.AppField>
        <form.AppField name="notes">{(field) => <field.TextField label="Notes" />}</form.AppField>
        <form.AppField name="dueAt">
          {(field) => <field.TextField label="Due Date" type="datetime-local" />}
        </form.AppField>
        <FormError formError={formError} />
      </FieldGroup>
      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex gap-2 mt-4">
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Task'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

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

  return (
    <div className="space-y-4">
      {/* Open tasks */}
      {openTasks.length === 0 && doneTasks.length === 0 && (
        <p className="text-muted-foreground text-sm">No tasks yet.</p>
      )}

      {openTasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Open</h3>
          {openTasks.map((task) => (
            <TaskRow key={task.id} task={task} onDelete={onDelete} onUpdate={onUpdate} />
          ))}
        </div>
      )}

      {/* Done tasks */}
      {doneTasks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Done</h3>
          {doneTasks.map((task) => (
            <TaskRow key={task.id} task={task} onDelete={onDelete} onUpdate={onUpdate} />
          ))}
        </div>
      )}

      {/* Add Task dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <AddTaskForm
            personId={personId}
            onAdded={() => {
              setAddDialogOpen(false);
              onAdd();
            }}
            onCancel={() => setAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
