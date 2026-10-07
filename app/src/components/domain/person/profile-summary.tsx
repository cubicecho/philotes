import { Linking, Text, View } from 'react-native';
import { Camera } from '@/components/app-icons';
import { Avatar } from '@/components/domain/person/avatar';
import { Badge } from '@/components/ui/badge';
import { FilePickerButton } from '@/components/ui/file-picker';
import type { PickedFile } from '@/components/ui/file-picker-base';
import type { SlotNode } from '@/lib/utils';

export interface PersonProfileSummaryProps {
  firstName: string;
  lastName: string;
  email: string | null | undefined;
  avatarPath: string | null | undefined;
  contactFrequency: string | null | undefined;
  /** `accept` for the photo picker. */
  avatarAccept: string;
  /** Called with the picked photo, read as bytes. */
  onPickAvatar: (files: PickedFile[]) => void;
  /** The person's label chips, drawn under the email line. */
  labelsSlot?: SlotNode;
}

/** Who this is at a glance: photo (with its upload badge), email, contact cadence and labels. */
export function PersonProfileSummary({
  firstName,
  lastName,
  email,
  avatarPath,
  contactFrequency,
  avatarAccept,
  onPickAvatar,
  labelsSlot,
}: PersonProfileSummaryProps) {
  return (
    <View className="flex-row items-start gap-4">
      <View className="relative shrink-0">
        <Avatar firstName={firstName} lastName={lastName} avatarPath={avatarPath} size="lg" />
        {/* Always drawn, not revealed on hover, so it is reachable by touch. */}
        <View className="absolute -right-1 -bottom-1">
          <FilePickerButton
            label="Upload photo"
            accept={avatarAccept}
            read="bytes"
            variant="secondary"
            size="icon-xs"
            className="rounded-full"
            iconSlot={<Camera />}
            onPickMany={onPickAvatar}
          />
        </View>
      </View>
      <View className="min-w-0 flex-1 gap-1.5">
        {email || contactFrequency ? (
          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
            {email ? (
              <Text
                role="link"
                onPress={() => Linking.openURL(`mailto:${email}`)}
                className="text-muted-foreground text-sm"
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
      </View>
    </View>
  );
}
