import { Linking, Text, View } from 'react-native';
import { Avatar } from '@/components/domain/person/avatar';
import { AvatarPickerButton } from '@/components/domain/person/avatar-picker-button';
import { Badge } from '@/components/ui/badge';
import type { PickedPhoto } from '@/lib/avatar-photo';
import type { SlotNode } from '@/lib/utils';

export interface PersonProfileSummaryProps {
  /** The person's name as shown, for the initials drawn without a photo. */
  name: string;
  /** What the person goes by, drawn in quotes; nothing is drawn without one. */
  nickname?: string | null | undefined;
  /** Where the person works, in the order a card reads: job title, department, organization. Empty parts are skipped. */
  work?: ReadonlyArray<string | null | undefined>;
  /** The note kept with the contact itself, which a phone syncs; nothing is drawn without one. */
  about?: string | null | undefined;
  /** Drawn as a mail link; nothing is drawn without one. */
  email: string | null | undefined;
  /** The stored photo's path; without one the initials are drawn. */
  avatarPath: string | null | undefined;
  /** The contact cadence, shown as a badge; nothing is drawn without one. */
  contactFrequency: string | null | undefined;
  /** Called with the photo picked to replace this one. */
  onPickAvatar: (photo: PickedPhoto) => void;
  /** The person's label chips, drawn under the email line. */
  labelsSlot?: SlotNode;
}

/** Who this is at a glance: photo (with its upload badge), nickname, work, email, contact cadence, labels and note. */
export function PersonProfileSummary({
  name,
  nickname,
  work = [],
  about,
  email,
  avatarPath,
  contactFrequency,
  onPickAvatar,
  labelsSlot,
}: PersonProfileSummaryProps) {
  const hasDetails = Boolean(email || contactFrequency);
  const workLine = work.filter(Boolean).join(' · ');

  return (
    <View className="flex-row items-start gap-4">
      <View className="relative shrink-0">
        <Avatar name={name} avatarPath={avatarPath} size="lg" />
        {/* Always drawn, not revealed on hover, so it is reachable by touch. */}
        <View className="absolute -right-1 -bottom-1">
          <AvatarPickerButton label="Upload photo" onPick={onPickAvatar} />
        </View>
      </View>
      <View className="min-w-0 flex-1 gap-1.5">
        {nickname ? <Text className="text-foreground/60 text-sm">“{nickname}”</Text> : null}
        {workLine ? <Text className="text-foreground text-sm">{workLine}</Text> : null}
        {hasDetails ? (
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            {email ? (
              <Text
                role="link"
                onPress={() => Linking.openURL(`mailto:${email}`)}
                className="text-foreground/60 text-sm"
              >
                {email}
              </Text>
            ) : null}
            {contactFrequency ? (
              <Badge variant="secondary" className="capitalize">
                {contactFrequency}
              </Badge>
            ) : null}
          </View>
        ) : null}
        {labelsSlot}
        {about ? <Text className="text-foreground/60 text-sm">{about}</Text> : null}
      </View>
    </View>
  );
}
