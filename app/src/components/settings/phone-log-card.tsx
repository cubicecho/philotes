import { useState } from 'react';
import { Text, View } from 'react-native';
import { Section } from '@/components/section';
import { SettingRow } from '@/components/setting-row';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { messageOf } from '@/lib/error-message';
import type { PhoneSource } from '@/lib/phone-log';
import { disablePhoneSource, enablePhoneSource, isPhoneSourceEnabled, scanPhoneSources } from '@/lib/phone-scan';
import { syncBackgroundScan } from '@/lib/phone-scan-task';
import { InteractionSource } from '@/lib/vocabulary';

/** One switch on the card. */
interface SourceRow {
  source: PhoneSource;
  title: string;
  description: string;
  /** What the card says when Android refuses the permission. */
  refused: string;
}

const SOURCE_ROWS: readonly SourceRow[] = [
  {
    source: InteractionSource.CallLog,
    title: 'Calls',
    description: 'Who you called or who called you, when, and how long the call lasted. Missed calls too.',
    refused: 'Android did not allow Philotes to read the call log. You can allow it in the app’s settings.',
  },
  {
    source: InteractionSource.Sms,
    title: 'Texts',
    description: 'Who you texted or who texted you, and when. Never what a text says.',
    refused: 'Android did not allow Philotes to read texts. You can allow it in the app’s settings.',
  },
];

/**
 * The settings card that lets the phone log calls and texts as interactions, each turned on on its own.
 * Both start off. It says plainly what is read and where it goes. Shown only on a device that can read them.
 */
export function PhoneLogCard() {
  const [enabled, setEnabled] = useState(() =>
    Object.fromEntries(SOURCE_ROWS.map(({ source }) => [source, isPhoneSourceEnabled(source)])),
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastLogged, setLastLogged] = useState<number | null>(null);

  const scan = async (): Promise<void> => {
    setIsScanning(true);
    try {
      const { logged } = await scanPhoneSources();
      setLastLogged(logged);
    } catch (error: unknown) {
      setProblem(`The scan stopped: ${messageOf(error) ?? 'unknown error'}`);
    } finally {
      setIsScanning(false);
    }
  };

  const toggle = async (row: SourceRow, isOn: boolean): Promise<void> => {
    setProblem(null);
    const isNowOn = isOn ? await enablePhoneSource(row.source) : false;
    if (isOn === false) {
      disablePhoneSource(row.source);
    }
    const isRefused = isOn && isNowOn === false;
    if (isRefused) {
      setProblem(row.refused);
    }
    setEnabled((current) => ({ ...current, [row.source]: isNowOn }));
    try {
      await syncBackgroundScan();
    } catch (error: unknown) {
      setProblem(`The background scan could not be scheduled: ${messageOf(error) ?? 'unknown error'}`);
    }
    if (isNowOn) {
      await scan();
    }
  };

  const isAnyOn = Object.values(enabled).some(Boolean);

  return (
    <Section
      surface="card"
      title="Log Calls and Texts"
      description="Philotes can note when you were last in touch with someone by reading this phone’s call log and texts. It reads the other number, the time, which way it went and how long a call lasted, and never what a text says. What it reads goes to your Philotes server, which keeps an interaction for each number that belongs to one of your people and drops the rest. It reads when the app opens, and every so often in the background."
      contentSlot={
        <View className="gap-4">
          {SOURCE_ROWS.map((row) => (
            <SettingRow
              key={row.source}
              title={row.title}
              description={row.description}
              actionSlot={({ titleId, descriptionId }) => (
                <Switch
                  checked={enabled[row.source] === true}
                  onCheckedChange={(isOn) => void toggle(row, isOn)}
                  aria-labelledby={titleId}
                  aria-describedby={descriptionId}
                />
              )}
            />
          ))}
          {problem ? <Alert variant="warning" title={problem} /> : null}
          {isAnyOn ? (
            <View className="flex-row flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" content="Scan now" loading={isScanning} onPress={() => void scan()} />
              {lastLogged === null ? null : (
                <Text className="text-muted-foreground text-sm">
                  {lastLogged === 1 ? '1 new interaction logged.' : `${lastLogged} new interactions logged.`}
                </Text>
              )}
            </View>
          ) : null}
        </View>
      }
    />
  );
}
