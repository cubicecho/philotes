import { Linking, View } from 'react-native';
import { ContactTypeEnum } from '@/__generated__/graphql';
import { Mail, MessageSquare, MessageSquarePlus, Phone } from '@/components/app-icons';
import { contactHref } from '@/components/domain/contact-info/list';
import { Button } from '@/components/ui/button';

export interface PersonContactActionsProps {
  /** The number Call and Text use; neither is drawn without one. */
  phone: string | null;
  email: string | null | undefined;
  onLogInteraction: () => void;
}

/**
 * The ways to reach this person, then the button to log having done so. The first
 * channel that exists is the filled button; the rest are outlines.
 */
export function PersonContactActions({ phone, email, onLogInteraction }: PersonContactActionsProps) {
  const phoneHref = phone ? contactHref(ContactTypeEnum.Phone, phone) : null;
  const smsHref = phone ? `sms:${phone.replace(/[^\d+]/g, '')}` : null;
  const hasPhoneAction = phoneHref !== null || smsHref !== null;

  return (
    <View className="flex-row flex-wrap gap-2">
      {phoneHref ? (
        <Button size="sm" iconSlot={<Phone />} content="Call" onPress={() => Linking.openURL(phoneHref)} />
      ) : null}
      {smsHref ? (
        <Button
          size="sm"
          variant={phoneHref ? 'outline' : 'default'}
          iconSlot={<MessageSquare />}
          content="Text"
          onPress={() => Linking.openURL(smsHref)}
        />
      ) : null}
      {email ? (
        <Button
          size="sm"
          variant={hasPhoneAction ? 'outline' : 'default'}
          iconSlot={<Mail />}
          content="Email"
          onPress={() => Linking.openURL(`mailto:${email}`)}
        />
      ) : null}
      <Button
        size="sm"
        variant="outline"
        iconSlot={<MessageSquarePlus />}
        content="Log Interaction"
        onPress={onLogInteraction}
      />
    </View>
  );
}
