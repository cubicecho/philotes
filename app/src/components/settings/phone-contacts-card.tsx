import { useQuery } from '@apollo/client';
import { useState } from 'react';
import { Text } from 'react-native';
import { QueryError } from '@/components/query-state';
import { Section } from '@/components/section';
import { SettingRow } from '@/components/setting-row';
import { Switch } from '@/components/ui/switch';
import { PHONE_CONTACTS_USER } from '@/hooks/use-phone-contacts-sync';
import { messageOf } from '@/lib/error-message';
import { isSyncingPhoneContacts, SyncStart, startPhoneContactsSync, stopPhoneContactsSync } from '@/lib/phone-contacts';

/** What the card says when the user refuses the contacts permissions. */
const PERMISSION_DENIED =
  'Philotes needs to read and write contacts to keep them in step. Allow it in the system settings for the app.';

/** What the card says when turning the sync on or off fails without saying why. */
const COULD_NOT_CHANGE = 'The phone’s contacts could not be changed. Try again.';

/**
 * The setting that puts the user's people in the phone's own contacts, under a Philotes account, so the
 * dialer, caller ID and messaging see them. The settings page shows it only on an Android build that can do it
 * (`isPhoneContactsSupported`); DAVx⁵ through
 * the CardDAV address book stays the way for anything else.
 */
export function PhoneContactsCard() {
  const { data, error: loadError, refetch } = useQuery(PHONE_CONTACTS_USER);
  const [isOn, setIsOn] = useState(isSyncingPhoneContacts);
  const [isBusy, setIsBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const email = data?.user?.email ?? null;

  /**
   * Turns the sync on or off.
   *
   * @param wanted - True to turn it on.
   */
  async function toggle(wanted: boolean): Promise<void> {
    if (email === null) {
      return;
    }
    setIsBusy(true);
    setProblem(null);
    try {
      if (wanted) {
        const start = await startPhoneContactsSync(email);
        const isRefused = start === SyncStart.PermissionDenied;
        setProblem(isRefused ? PERMISSION_DENIED : null);
      } else {
        await stopPhoneContactsSync();
      }
    } catch (error) {
      setProblem(messageOf(error) ?? COULD_NOT_CHANGE);
    } finally {
      setIsOn(isSyncingPhoneContacts());
      setIsBusy(false);
    }
  }

  return (
    <Section
      surface="card"
      title="Phone Contacts"
      contentSlot={
        <>
          {loadError ? <QueryError compact error={loadError} what="your account" onRetry={() => refetch()} /> : null}
          <SettingRow
            title="Sync to the phone's contacts"
            description="Adds a Philotes account to the phone. Your people appear in its contacts, dialer and messages, and edits made there come back here. Turning it off takes them off the phone."
            actionSlot={({ titleId, descriptionId }) => (
              <Switch
                checked={isOn}
                onCheckedChange={toggle}
                disabled={isBusy || email === null}
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
              />
            )}
          />
          {problem === null ? null : (
            <Text role="alert" className="text-destructive text-sm">
              {problem}
            </Text>
          )}
        </>
      }
    />
  );
}
