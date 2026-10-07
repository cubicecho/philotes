import { useMutation } from '@apollo/client';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { graphql } from '@/__generated__/gql';
import { MessageSquarePlus, Users } from '@/components/app-icons';
import { Avatar } from '@/components/domain/person/avatar';
import { ListItem } from '@/components/list-item';
import { Button } from '@/components/ui/button';
import { Check } from '@/components/ui/icons';
import { fullName } from '@/lib/person-name';
import { Widget } from './widget';

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
  mutation QuickLogInteraction($personId: UUID!, $occurredAt: DateTime!) {
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
  if (days === 0) {
    return 'Due today';
  }
  if (days === 1) {
    return '1 day overdue';
  }
  if (days < 7) {
    return `${days} days overdue`;
  }
  const weeks = Math.floor(days / 7);
  if (weeks === 1) {
    return '1 week overdue';
  }
  if (weeks < 4) {
    return `${weeks} weeks overdue`;
  }
  const months = Math.floor(days / 30);
  if (months === 1) {
    return '1 month overdue';
  }
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
  const router = useRouter();
  const [quickLog] = useMutation(QUICK_LOG_INTERACTION);
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());
  const [loggingId, setLoggingId] = useState<string | null>(null);

  const handleQuickLog = async (personId: string) => {
    setLoggingId(personId);
    try {
      await quickLog({ variables: { personId, occurredAt: new Date() } });
      setLoggedIds((prev) => new Set(prev).add(personId));
      onLogged?.();
    } finally {
      setLoggingId(null);
    }
  };

  return (
    <Widget
      iconSlot={<Users />}
      title="Reach Out"
      subtitle="people waiting to hear from you"
      viewAllHref="/persons?sortField=lastContacted&sortDir=asc"
      emptyMessage="You're all caught up here"
      contentSlot={persons.map((p) => (
        <ListItem
          key={p.id}
          leadingSlot={<Avatar firstName={p.firstName} lastName={p.lastName} avatarPath={p.avatarPath} size="sm" />}
          title={fullName(p)}
          // Dormant entries keep the row's own muted line; overdue ones are called out.
          description={p.isDormant ? p.statusLabel : <Text className="text-warning text-xs">{p.statusLabel}</Text>}
          onPress={() => router.push(`/persons/${p.id}`)}
          actionSlot={
            loggedIds.has(p.id) ? (
              <View className="flex-row items-center gap-1">
                <Check className="size-3.5 text-primary" />
                <Text className="text-primary text-xs">Logged</Text>
              </View>
            ) : (
              <Button
                size="xs"
                variant="outline"
                iconSlot={<MessageSquarePlus />}
                content="Log contact"
                accessibilityHint="Log that you reached out just now"
                loading={loggingId === p.id}
                onPress={() => handleQuickLog(p.id)}
              />
            )
          }
        />
      ))}
    />
  );
}
