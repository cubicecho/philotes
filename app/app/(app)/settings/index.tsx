import { useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/page-layout';
import { Section } from '@/components/section';
import { ApiKeyManager } from '@/components/settings/api-key-manager';
import { DefaultCountryCard } from '@/components/settings/default-country-card';
import { ExportCalendarCard } from '@/components/settings/export-calendar-card';
import { ExportPeopleCard } from '@/components/settings/export-people-card';
import { ExportVCardsCard } from '@/components/settings/export-vcards-card';
import { GoogleCsvImportCard } from '@/components/settings/google-csv-import-card';
import { VCardImportCard } from '@/components/settings/vcard-import-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ThemePicker } from '@/components/ui/theme-picker';

/** The tabs of the settings page. */
type SettingsTab = 'import-export' | 'api-keys' | 'app';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'import-export', label: 'Import / Export' },
  { id: 'api-keys', label: 'API Keys' },
  { id: 'app', label: 'App Settings' },
];

/** The settings page: imports and exports, API keys, and appearance, a tab each. */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('import-export');

  const handleTabChange = (value: string): void => {
    const tab = TABS.find((known) => known.id === value);
    if (tab === undefined) {
      return;
    }
    setActiveTab(tab.id);
  };

  return (
    <PageLayout
      width="prose"
      title="Settings"
      contentSlot={
        <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-6 py-4">
          <TabsList aria-label="Settings" className="self-start">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="import-export">
            <View className="gap-6">
              <ExportCalendarCard />
              <ExportPeopleCard />
              <ExportVCardsCard />
              <VCardImportCard />
              <GoogleCsvImportCard />
            </View>
          </TabsContent>
          <TabsContent value="api-keys">
            <ApiKeyManager />
          </TabsContent>
          <TabsContent value="app">
            <View className="gap-6">
              <Section
                surface="card"
                title="Appearance"
                description="Customize how Philotes looks on your device."
                contentSlot={<ThemePicker />}
              />
              <DefaultCountryCard />
            </View>
          </TabsContent>
        </Tabs>
      }
    />
  );
}
