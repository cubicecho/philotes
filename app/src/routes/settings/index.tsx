import { gql, useMutation, useQuery } from '@apollo/client';
import { createFileRoute } from '@tanstack/react-router';
import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// ── Queries ────────────────────────────────────────────────────────────────

const GET_EXPORT_PERSONS = gql`
  query ExportPersons {
    persons(
      orderBy: {
        lastName: { direction: asc, priority: 1 }
        firstName: { direction: asc, priority: 2 }
      }
    ) {
      id
      firstName
      lastName
      email
      contactInfos {
        type
        label
        value
        isPrimary
      }
      addresses {
        type
        label
        line1
        line2
        city
        state
        postalCode
        country
      }
      importantDates(where: { name: { eq: "Birthday" } }) {
        name
        date
        recurrence
      }
      labels {
        id
        label
        color
      }
    }
  }
`;

const GET_ALL_EVENTS_FOR_EXPORT = gql`
  query GetAllEventsForExport {
    interactions {
      id
      channel
      occurredAt
      note
      person {
        id
        firstName
        lastName
      }
    }
    importantDates {
      id
      name
      description
      date
      recurrence
      milestoneType
      person {
        id
        firstName
        lastName
      }
    }
    activitys {
      id
      title
      description
      location
      occurredAt
      person {
        id
        firstName
        lastName
      }
    }
  }
`;

// ── Import Mutation ─────────────────────────────────────────────────────────

const IMPORT_GOOGLE_CONTACTS = gql`
  mutation ImportGoogleContacts($csv: String!) {
    importGoogleContacts(csv: $csv) {
      imported
      merged
      skipped
      errors
    }
  }
`;

// ── Types ──────────────────────────────────────────────────────────────────

interface ExportContactInfo {
  type: string;
  label: string | null;
  value: string;
  isPrimary: boolean;
}

interface ExportAddress {
  type: string;
  label: string | null;
  line1: string;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

interface ExportImportantDate {
  name: string;
  date: string;
  recurrence?: string | null;
}

interface ExportLabel {
  id: string;
  label: string;
  color: string;
}

interface ExportPerson {
  id: string;
  firstName: string;
  lastName?: string | null;
  email: string;
  contactInfos: ExportContactInfo[];
  addresses: ExportAddress[];
  importantDates: ExportImportantDate[];
  labels: ExportLabel[];
}

interface ExportPersonsQueryResult {
  persons: ExportPerson[];
}

interface Person {
  id: string;
  firstName: string;
  lastName?: string | null;
}

interface Interaction {
  id: string;
  channel: string;
  occurredAt: string;
  note?: string | null;
  person?: Person | null;
}

interface ImportantDate {
  id: string;
  name: string;
  description?: string | null;
  date: string;
  recurrence?: string | null;
  milestoneType?: string | null;
  person?: Person | null;
}

interface Activity {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  occurredAt: string;
  person?: Person | null;
}

interface AllEventsQueryResult {
  interactions: Interaction[];
  importantDates: ImportantDate[];
  activitys: Activity[];
}

// ── CSV helpers ────────────────────────────────────────────────────────────

function csvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(',');
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function contactInfoLabel(entry: ExportContactInfo, defaultLabel: string): string {
  const base = entry.label || defaultLabel;
  return entry.isPrimary ? `* ${base}` : base;
}

function buildPersonsCsv(persons: ExportPerson[]): string {
  // 1. Calculate max counts across all persons
  const maxEmails = Math.max(0, ...persons.map((p) => p.contactInfos.filter((c) => c.type === 'email').length));
  const maxPhones = Math.max(
    0,
    ...persons.map((p) => p.contactInfos.filter((c) => c.type === 'phone' || c.type === 'mobile').length),
  );
  const maxWebsites = Math.max(0, ...persons.map((p) => p.contactInfos.filter((c) => c.type === 'website').length));
  const maxAddresses = Math.max(0, ...persons.map((p) => p.addresses.length));

  // 2. Build header row
  const headers: string[] = ['First Name', 'Last Name', 'Birthday', 'Labels'];
  for (let n = 1; n <= maxEmails; n++) {
    headers.push(`E-mail ${n} - Label`, `E-mail ${n} - Value`);
  }
  for (let n = 1; n <= maxPhones; n++) {
    headers.push(`Phone ${n} - Label`, `Phone ${n} - Value`);
  }
  for (let n = 1; n <= maxWebsites; n++) {
    headers.push(`Website ${n} - Label`, `Website ${n} - Value`);
  }
  for (let n = 1; n <= maxAddresses; n++) {
    headers.push(
      `Address ${n} - Label`,
      `Address ${n} - Street`,
      `Address ${n} - City`,
      `Address ${n} - Region`,
      `Address ${n} - Postal Code`,
      `Address ${n} - Country`,
    );
  }

  // 3. Build data rows
  const rows = persons.map((person) => {
    const birthday = person.importantDates.find((d) => d.name === 'Birthday')?.date ?? '';
    const labelsStr = person.labels.map((l) => l.label).join(' ::: ');

    const cells: string[] = [person.firstName, person.lastName ?? '', birthday, labelsStr];

    // Emails
    const emails = person.contactInfos.filter((c) => c.type === 'email');
    for (let n = 0; n < maxEmails; n++) {
      const entry = emails[n];
      cells.push(entry ? contactInfoLabel(entry, 'Home') : '', entry?.value ?? '');
    }

    // Phones
    const phones = person.contactInfos.filter((c) => c.type === 'phone' || c.type === 'mobile');
    for (let n = 0; n < maxPhones; n++) {
      const entry = phones[n];
      const defaultLabel = entry?.type === 'mobile' ? 'Mobile' : 'Phone';
      cells.push(entry ? contactInfoLabel(entry, defaultLabel) : '', entry?.value ?? '');
    }

    // Websites
    const websites = person.contactInfos.filter((c) => c.type === 'website');
    for (let n = 0; n < maxWebsites; n++) {
      const entry = websites[n];
      cells.push(entry ? contactInfoLabel(entry, 'Website') : '', entry?.value ?? '');
    }

    // Addresses
    for (let n = 0; n < maxAddresses; n++) {
      const addr = person.addresses[n];
      const typeLabel = addr?.label ?? (addr ? capitalizeFirst(addr.type) : '');
      cells.push(
        typeLabel,
        addr?.line1 ?? '',
        addr?.city ?? '',
        addr?.state ?? '',
        addr?.postalCode ?? '',
        addr?.country ?? '',
      );
    }

    return cells;
  });

  // 4. Assemble with RFC 4180 CRLF line endings
  const lines = [csvRow(headers), ...rows.map(csvRow)];
  return lines.join('\r\n');
}

type ImportState =
  | { stage: 'idle' }
  | { stage: 'preview'; contactCount: number; firstFiveNames: string[]; rawCsv: string }
  | { stage: 'importing' }
  | { stage: 'done'; imported: number; merged: number; skipped: number; errors: string[] }
  | { stage: 'error'; message: string };

// ── ICS helpers ────────────────────────────────────────────────────────────

function buildPersonDisplayName(person?: Person | null): string {
  if (!person) return 'Unknown';
  return [person.firstName, person.lastName].filter(Boolean).join(' ');
}

function formatIcsDateTime(dateStr: string): string {
  return new Date(dateStr)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

/** Format a date-only value as a DATE (not DATE-TIME) for all-day events */
function formatIcsDateOnly(dateStr: string): string {
  return new Date(dateStr).toISOString().slice(0, 10).replace(/-/g, '');
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function buildInteractionEvent(interaction: Interaction, now: string): string {
  const personName = buildPersonDisplayName(interaction.person);
  const summary = escapeIcsText(
    `${interaction.channel.charAt(0).toUpperCase()}${interaction.channel.slice(1)} with ${personName}`,
  );
  const dtStart = formatIcsDateTime(interaction.occurredAt);
  const dtEnd = formatIcsDateTime(new Date(new Date(interaction.occurredAt).getTime() + 30 * 60 * 1000).toISOString());
  const lines = [
    'BEGIN:VEVENT',
    `UID:interaction-${interaction.id}@philotes`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
  ];
  if (interaction.note) {
    lines.push(`DESCRIPTION:${escapeIcsText(interaction.note)}`);
  }
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

function buildImportantDateEvent(importantDate: ImportantDate, now: string): string {
  const personName = buildPersonDisplayName(importantDate.person);
  const summary = escapeIcsText(`${importantDate.name} (${personName})`);
  const dtStart = formatIcsDateOnly(importantDate.date);
  const lines = [
    'BEGIN:VEVENT',
    `UID:importantdate-${importantDate.id}@philotes`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `SUMMARY:${summary}`,
  ];
  if (importantDate.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(importantDate.description)}`);
  }
  if (importantDate.recurrence === 'yearly') {
    lines.push('RRULE:FREQ=YEARLY');
  }
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

function buildActivityEvent(activity: Activity, now: string): string {
  const personName = buildPersonDisplayName(activity.person);
  const summary = escapeIcsText(`${activity.title} with ${personName}`);
  const dtStart = formatIcsDateTime(activity.occurredAt);
  const dtEnd = formatIcsDateTime(new Date(new Date(activity.occurredAt).getTime() + 60 * 60 * 1000).toISOString());
  const lines = [
    'BEGIN:VEVENT',
    `UID:activity-${activity.id}@philotes`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
  ];
  if (activity.location) {
    lines.push(`LOCATION:${escapeIcsText(activity.location)}`);
  }
  if (activity.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(activity.description)}`);
  }
  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

function buildIcsContent(data: AllEventsQueryResult): string {
  const now = formatIcsDateTime(new Date().toISOString());

  const events = [
    ...data.interactions.map((i) => buildInteractionEvent(i, now)),
    ...data.importantDates.map((d) => buildImportantDateEvent(d, now)),
    ...data.activitys.map((a) => buildActivityEvent(a, now)),
  ].join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Philotes CRM//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadIcs(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── ExportPeopleCsvCard Component ──────────────────────────────────────────

function ExportPeopleCsvCard() {
  const {
    data: exportData,
    loading: exportLoading,
    error: exportError,
  } = useQuery<ExportPersonsQueryResult>(GET_EXPORT_PERSONS);

  function handleExportPeople() {
    if (!exportData?.persons?.length) return;
    const csv = buildPersonsCsv(exportData.persons);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'philotes-contacts.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Export People</CardTitle>
        <CardDescription>
          Download all your contacts as a CSV file compatible with Google Contacts, Apple Contacts, and other
          applications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {exportError && <p className="text-sm text-destructive mb-4">Failed to load people: {exportError.message}</p>}
        <Button onClick={handleExportPeople} disabled={exportLoading || !!exportError || !exportData?.persons?.length}>
          <Download className="h-4 w-4 mr-2" />
          {exportLoading ? 'Loading…' : `Export ${exportData?.persons?.length ?? 0} People as CSV`}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── GoogleCsvImportCard Component ──────────────────────────────────────────

function GoogleCsvImportCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importState, setImportState] = useState<ImportState>({ stage: 'idle' });

  const [importContacts] = useMutation<{
    importGoogleContacts: { imported: number; merged: number; skipped: number; errors: string[] };
  }>(IMPORT_GOOGLE_CONTACTS);

  function handleFileButtonClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so the same file can be re-selected
    e.target.value = '';

    const text = await file.text();

    // Quick preview: count non-empty non-header lines for an estimate
    const lines = text.split(/\r?\n|\r/).filter((l) => l.trim().length > 0);
    const dataLines = Math.max(0, lines.length - 1); // subtract header row

    // Get first 5 names from raw lines for preview (best-effort, unquoted)
    const firstFiveNames = lines.slice(1, 6).map((line) => {
      const firstComma = line.indexOf(',');
      const secondComma = line.indexOf(',', firstComma + 1);
      const first = line.slice(0, firstComma).replace(/^"|"$/g, '').trim();
      const last =
        firstComma !== -1 && secondComma !== -1
          ? line
              .slice(firstComma + 1, secondComma)
              .replace(/^"|"$/g, '')
              .trim()
          : '';
      return [first, last].filter(Boolean).join(' ') || '(unknown)';
    });

    setImportState({
      stage: 'preview',
      contactCount: dataLines,
      firstFiveNames,
      rawCsv: text,
    });
  }

  async function handleImport() {
    if (importState.stage !== 'preview' || !importState.rawCsv) return;

    setImportState({ stage: 'importing' });

    try {
      const result = await importContacts({ variables: { csv: importState.rawCsv } });

      if (result.errors?.length) {
        setImportState({
          stage: 'error',
          message: result.errors.map((e) => e.message).join('; '),
        });
        return;
      }

      const { imported, merged, skipped, errors } = result.data!.importGoogleContacts;
      setImportState({ stage: 'done', imported, merged, skipped, errors });
    } catch (err) {
      setImportState({
        stage: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Import from Google Contacts</CardTitle>
        <CardDescription>
          Upload a CSV export from Google Contacts to import your contacts into Philotes. Contacts without an email
          address will be skipped.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {importState.stage === 'idle' && (
          <>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            <Button onClick={handleFileButtonClick} variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Choose CSV File
            </Button>
          </>
        )}

        {importState.stage === 'preview' && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ready to import approximately {importState.contactCount} contacts.
            </p>
            {importState.firstFiveNames.length > 0 && (
              <ul className="text-sm space-y-1">
                {importState.firstFiveNames.map((name, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static preview list
                  <li key={i} className="text-muted-foreground">
                    • {name}
                  </li>
                ))}
                {importState.contactCount > 5 && (
                  <li className="text-muted-foreground">…and {importState.contactCount - 5} more</li>
                )}
              </ul>
            )}
            <Button onClick={handleImport}>
              <Upload className="h-4 w-4 mr-2" />
              Import Contacts
            </Button>
          </div>
        )}

        {importState.stage === 'importing' && <p className="text-sm text-muted-foreground">Importing…</p>}

        {importState.stage === 'done' && (
          <div className="space-y-1">
            <p className="text-sm text-green-600">
              ✓ {importState.imported} contacts imported
              {importState.merged > 0 ? `, ${importState.merged} merged` : ''}
              {importState.skipped > 0 ? `, ${importState.skipped} skipped` : ''}
            </p>
            {importState.errors.length > 0 && (
              <ul className="text-sm text-destructive space-y-0.5">
                {importState.errors.map((e, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static error list
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" onClick={() => setImportState({ stage: 'idle' })}>
              Import Another File
            </Button>
          </div>
        )}

        {importState.stage === 'error' && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">Import failed: {importState.message}</p>
            <Button variant="outline" onClick={() => setImportState({ stage: 'idle' })}>
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

type SettingsTab = 'import';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'import', label: 'Import' },
];

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('import');
  const { data, loading, error } = useQuery<AllEventsQueryResult>(GET_ALL_EVENTS_FOR_EXPORT);

  const totalCount =
    (data?.interactions?.length ?? 0) + (data?.importantDates?.length ?? 0) + (data?.activitys?.length ?? 0);

  function handleExport() {
    if (!data) return;
    const icsContent = buildIcsContent(data);
    downloadIcs(icsContent, 'philotes-events.ics');
  }

  return (
    <div className="h-full overflow-y-auto min-h-0 pr-2">
    <div className="px-6 py-8 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Export Calendar Events</CardTitle>
          <CardDescription>
            Download all your interactions, important dates, and activities as an ICS file. You can import this into
            Google Calendar, Apple Calendar, Outlook, or any other calendar application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-4">Failed to load events: {error.message}</p>}
          <Button onClick={handleExport} disabled={loading || !!error || totalCount === 0}>
            <Download className="h-4 w-4 mr-2" />
            {loading ? 'Loading…' : `Export ${totalCount} Events as ICS`}
          </Button>
          {!loading && !error && totalCount > 0 && (
            <p className="text-sm text-muted-foreground mt-3">
              {data?.interactions?.length ?? 0} interactions · {data?.importantDates?.length ?? 0} important dates ·{' '}
              {data?.activitys?.length ?? 0} activities
            </p>
          )}
          {!loading && !error && totalCount === 0 && (
            <p className="text-sm text-muted-foreground mt-3">No events to export yet.</p>
          )}
        </CardContent>
      </Card>

      <ExportPeopleCsvCard />

      <div>
        <div className="flex border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="pt-6">
          {activeTab === 'import' && <GoogleCsvImportCard />}
        </div>
      </div>
    </div>
    </div>
  );
}

export const Route = createFileRoute('/settings/')({
  component: SettingsPage,
});
