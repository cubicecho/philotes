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
import { personName } from '@/lib/person-name';
import { DAYS_PER_MONTH, DAYS_PER_WEEK, WEEKS_PER_MONTH } from '@/lib/time';
import { Widget } from './widget';

/** A person the dashboard suggests getting back in touch with. */
export type ReachOutPerson = {
  id: string;
  /** The person's name as the server worked it out. Empty when they have none. */
  displayName: string;
  avatarPath?: string | null;
  /** e.g. "3 weeks overdue" or "No contact in over a year" */
  statusLabel: string;
  /** Dormant entries render quieter than overdue ones. */
  isDormant: boolean;
};

/** Logs an interaction with no note on the `other` channel: the quick log records that contact happened, not how. */
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

/**
 * How long contact with a person has been overdue, in the largest unit that fits.
 *
 * @param days - Whole days past the day contact was due; 0 is due today.
 * @returns The label, such as `3 weeks overdue`; `Due today` for 0.
 */
export function formatOverdueLabel(days: number): string {
  if (days === 0) {
    return 'Due today';
  }
  if (days === 1) {
    return '1 day overdue';
  }
  if (days < DAYS_PER_WEEK) {
    return `${days} days overdue`;
  }
  const weeks = Math.floor(days / DAYS_PER_WEEK);
  if (weeks === 1) {
    return '1 week overdue';
  }
  if (weeks < WEEKS_PER_MONTH) {
    return `${weeks} weeks overdue`;
  }
  const months = Math.floor(days / DAYS_PER_MONTH);
  if (months === 1) {
    return '1 month overdue';
  }
  return `${months} months overdue`;
}

interface ReachOutProps {
  /** The people to list, in the order given. */
  persons: ReachOutPerson[];
  /** Called after a quick-log succeeds so the page can refetch. */
  onLogged?: () => void;
}

/** The dashboard card of people due for contact, each with a button that logs a contact made just now. */
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
      description="people waiting to hear from you"
      actionHref="/persons?sortField=lastContacted&sortDir=asc"
      emptyTitle="You're all caught up here"
      contentSlot={persons.map((p) => (
        <ListItem
          key={p.id}
          leadingSlot={<Avatar name={personName(p)} avatarPath={p.avatarPath} size="sm" />}
          title={personName(p)}
          // Dormant entries keep the row's own muted line; overdue ones are called out.
          description={p.isDormant ? p.statusLabel : <Text className="text-warning text-xs">{p.statusLabel}</Text>}
          onPress={() => router.push(`/persons/${p.id}`)}
          actionSlot={
            loggedIds.has(p.id) ? (
              <View className="flex-row items-center gap-1">
                <Check className="size-3.5 text-positive" />
                <Text className="text-positive text-xs">Logged</Text>
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
