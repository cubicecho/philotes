import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { EXCERPT_DEFAULTS } from '@/lib/defaults';

export interface MentionedInNote {
  id: string;
  body: string;
  person?: { id: string; firstName: string; lastName: string } | null;
}

export interface PersonMentionedInProps {
  notes: MentionedInNote[];
}

/** Notes on other people that mention this one, each linking back to whose note it is. */
export function PersonMentionedIn({ notes }: PersonMentionedInProps) {
  const { mentionLength } = EXCERPT_DEFAULTS;
  return (
    <View className="gap-2">
      {notes.map((n) => (
        <View key={n.id} className="gap-0.5 rounded-md border border-foreground/10 px-3 py-2">
          <Text numberOfLines={3} className="text-foreground text-sm">
            {n.body.length > mentionLength ? `${n.body.slice(0, mentionLength)}…` : n.body}
          </Text>
          {n.person ? (
            <Text className="text-foreground/60 text-xs">
              by{' '}
              <Link href={`/persons/${n.person.id}`} className="text-foreground/80 underline">
                {n.person.firstName} {n.person.lastName}
              </Link>
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
