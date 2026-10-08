import { useApolloClient } from '@apollo/client';
import { Linking, Text, View } from 'react-native';
import { contactHref } from '@/components/domain/contact-info/list';
import { LabelChip } from '@/components/domain/label/label-chip';
import { Avatar } from '@/components/domain/person/avatar';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PERSON_ROW } from '@/lib/people-sync';

/**
 * Reads what the people list keeps about one person.
 *
 * @param id - The person.
 * @returns Their list row, or null when the list never held them.
 */
export function useKeptPerson(id: string) {
  const { cache } = useApolloClient();
  return cache.readFragment({
    id: cache.identify({ __typename: 'Person', id }),
    fragment: PERSON_ROW,
    fragmentName: 'PersonRow',
  });
}

export interface KeptPersonSummaryProps {
  /** The person, as `useKeptPerson` read them. */
  person: NonNullable<ReturnType<typeof useKeptPerson>>;
}

/**
 * A person's page when the server cannot be reached and their page was never opened on this device:
 * what the people list keeps about them, which is enough to reach them.
 */
export function KeptPersonSummary({ person }: KeptPersonSummaryProps) {
  return (
    <View className="gap-4">
      <Alert
        variant="warning"
        title="Showing what this device kept"
        description="The rest of this page needs the server."
      />
      <View className="flex-row items-center gap-3">
        <Avatar name={person.displayName} avatarPath={person.avatarPath} size="lg" />
        <View className="flex-1">
          <Text className="text-xl font-semibold text-foreground">{person.displayName}</Text>
          {person.organization ? <Text className="text-sm text-foreground/60">{person.organization}</Text> : null}
        </View>
      </View>
      {person.labels.length > 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {person.labels.map((label) => (
            <LabelChip key={label.id} label={label.label} color={label.color} />
          ))}
        </View>
      ) : null}
      <View className="items-start gap-1">
        {person.contactInfos.map((info) => {
          const href = contactHref(info.type, info.value);
          return href === null ? (
            <Text key={info.id} className="text-sm text-foreground">
              {info.value}
            </Text>
          ) : (
            <Button key={info.id} variant="link" size="sm" content={info.value} onPress={() => Linking.openURL(href)} />
          );
        })}
      </View>
    </View>
  );
}
