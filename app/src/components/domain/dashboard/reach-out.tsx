import { useMutation } from '@apollo/client';
import { Link } from 'expo-router';
import { Check, MessageSquarePlus, Users } from 'lucide-react';
import { useState } from 'react';
import { graphql } from '@/__generated__/gql';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { AllCaughtUp, Widget } from './widget';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReachOutPerson = {
  id: string;
  firstName: string;
  lastName: string;
  avatarPath?: string | null;
  /** e.g. "3 weeks overdue" or "No contact in over a year" */
  statusLabel: string;
  /** Dormant entries render quieter than overdue ones. */
  isDormant: boolean;
};

// ---------------------------------------------------------------------------
// Quick log
// ---------------------------------------------------------------------------

const QUICK_LOG_INTERACTION = graphql(`
  mutation ReachOutQuickLog($personId: String!, $occurredAt: DateTime!) {
    createInteraction(
      values: { personId: $personId, channel: "other", occurredAt: $occurredAt }
    ) {
      id
      personId
      occurredAt
    }
  }
`);

export function formatOverdueLabel(days: number): string {
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day overdue';
  if (days < 7) return `${days} days overdue`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week overdue';
  if (weeks < 4) return `${weeks} weeks overdue`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month overdue';
  return `${months} months overdue`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ReachOutProps {
  persons: ReachOutPerson[];
  /** Called after a quick-log succeeds so the page can refetch. */
  onLogged?: () => void;
}

export function ReachOut({ persons, onLogged }: ReachOutProps) {
  const [quickLog] = useMutation(QUICK_LOG_INTERACTION);
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());

  const handleQuickLog = async (personId: string) => {
    await quickLog({ variables: { personId, occurredAt: new Date() } });
    setLoggedIds((prev) => new Set(prev).add(personId));
    onLogged?.();
  };

  return (
    <Widget
      icon={<Users />}
      title="Reach Out"
      subtitle="people waiting to hear from you"
      viewAllHref="/persons?sortField=lastContacted&sortDir=asc"
    >
      {persons.length === 0 ? (
        <AllCaughtUp message="You're all caught up here" />
      ) : (
        <ul className="space-y-1">
          {persons.map((p) => {
            const logged = loggedIds.has(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
                <Avatar firstName={p.firstName} lastName={p.lastName} avatarPath={p.avatarPath} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/persons/${p.id}`}
                    className="block truncate text-sm font-medium text-foreground hover:underline"
                  >
                    {p.firstName} {p.lastName}
                  </Link>
                  <p
                    className={`truncate text-xs ${
                      p.isDormant ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {p.statusLabel}
                  </p>
                </div>
                {logged ? (
                  <span className="inline-flex items-center gap-1 text-xs text-primary">
                    <Check className="h-3.5 w-3.5" />
                    Logged
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => handleQuickLog(p.id)}
                    title="Log that you reached out just now"
                  >
                    <MessageSquarePlus className="mr-1 h-3.5 w-3.5" />
                    Log contact
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Widget>
  );
}
