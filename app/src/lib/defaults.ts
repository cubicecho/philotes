// Every value someone might tune, as plain data. Nothing here computes, reads the environment or imports.

/** How many rows one request asks the API for. Each must stay under the server's `maxPageSize` and cost limit. */
export interface PageSizeSettings {
  /** Rows per page when a list is read to its end. The server's default page, and what the documents' costs are worked out for. */
  list: number;
  /** People per page of the CSV export. Each carries every contact detail and address, so the page is small. */
  peopleExport: number;
  /** Rows per page of the calendar export. An event row is small, so this is the server's largest page. */
  calendarExport: number;
  /** People per page of the network graph. Each carries up to 50 relationships, so the page is small. */
  network: number;
  /** Interactions per page on a person's page and timeline. An interaction row is small. */
  interactions: number;
}

export const PAGE_SIZE_DEFAULTS: Readonly<PageSizeSettings> = Object.freeze({
  list: 50,
  peopleExport: 40,
  calendarExport: 500,
  network: 40,
  interactions: 100,
});

/** What the dashboard's widgets show. */
export interface DashboardSettings {
  /** Most rows one widget lists. */
  widgetLimit: number;
  /** How far ahead the upcoming-dates widget looks, in days. */
  upcomingWindowDays: number;
  /** Days without contact after which a person with no check-in frequency counts as dormant. */
  dormantAfterDays: number;
  /** How far ahead the tasks widget looks for due tasks, in days. */
  tasksDueWithinDays: number;
}

export const DASHBOARD_DEFAULTS: Readonly<DashboardSettings> = Object.freeze({
  widgetLimit: 6,
  upcomingWindowDays: 30,
  dormantAfterDays: 365,
  tasksDueWithinDays: 7,
});

/** What the brief shown before contacting a person holds. */
export interface PreContactBriefSettings {
  /** Most recent notes listed. */
  maxNotes: number;
  /** Most open tasks listed. */
  maxTasks: number;
  /** How far ahead it looks for the person's important dates, in days. */
  upcomingWindowDays: number;
  /** Longest excerpt of the last interaction's note, in characters. */
  interactionNoteExcerptLength: number;
  /** Longest excerpt of a recent note, in characters. */
  noteExcerptLength: number;
}

export const PRE_CONTACT_BRIEF_DEFAULTS: Readonly<PreContactBriefSettings> = Object.freeze({
  maxNotes: 3,
  maxTasks: 3,
  upcomingWindowDays: 60,
  interactionNoteExcerptLength: 100,
  noteExcerptLength: 80,
});

/** How much of a long text the lists on a person's page show. */
export interface ExcerptSettings {
  /** Longest excerpt of an interaction's note in the interaction list, in characters. */
  interactionNoteLength: number;
  /** Longest excerpt of a note that mentions the person, in characters. */
  mentionLength: number;
}

export const EXCERPT_DEFAULTS: Readonly<ExcerptSettings> = Object.freeze({
  interactionNoteLength: 80,
  mentionLength: 120,
});

/** The suggested introductions on a person's page. */
export interface IntroductionSettings {
  /** Most people suggested. */
  maxSuggestions: number;
}

export const INTRODUCTION_DEFAULTS: Readonly<IntroductionSettings> = Object.freeze({
  maxSuggestions: 5,
});

/** The people search box. */
export interface SearchSettings {
  /** How long typing must pause before the search runs. */
  debounceMs: number;
}

export const SEARCH_DEFAULTS: Readonly<SearchSettings> = Object.freeze({
  debounceMs: 300,
});

/** The contacts import. */
export interface ContactImportSettings {
  /** How many names the preview lists before "and N more". */
  previewNames: number;
}

export const CONTACT_IMPORT_DEFAULTS: Readonly<ContactImportSettings> = Object.freeze({
  previewNames: 5,
});

/** The calendar file export. */
export interface CalendarExportSettings {
  /** How long an exported interaction lasts, since none is recorded. */
  interactionMinutes: number;
}

export const CALENDAR_EXPORT_DEFAULTS: Readonly<CalendarExportSettings> = Object.freeze({
  interactionMinutes: 30,
});

/** Check-in reminders. */
export interface CheckInSettings {
  /** The check-in period assumed for a frequency the app does not know, in days. */
  fallbackPeriodDays: number;
}

export const CHECK_IN_DEFAULTS: Readonly<CheckInSettings> = Object.freeze({
  fallbackPeriodDays: 30,
});

/** The layout and look of the relationship network graph. Lengths are in SVG user units (pixels at zoom 1). */
export interface NetworkGraphSettings {
  /** Radius of a person with no relationships. */
  minNodeRadius: number;
  /** Radius of a person with `nodeRadiusFullAt` relationships or more. */
  maxNodeRadius: number;
  /** The relationship count at which a node stops growing. */
  nodeRadiusFullAt: number;
  /** A person with more relationships than this gets the outer hub ring. */
  hubAboveConnections: number;
  /** Gap between a hub's circle and its ring. */
  hubRingGap: number;
  /** Size of a node's initials, as a share of its radius. */
  initialsSizeRatio: number;
  /** Gap between a node and the name under it. */
  nameGap: number;
  /** Furthest zoom out, where 1 is actual size. */
  minZoom: number;
  /** Furthest zoom in. */
  maxZoom: number;
  /** The zoom the graph opens at. */
  initialZoom: number;
  /** How long the zoom reset animates. */
  resetZoomMs: number;
  /** Length a link pulls toward before its ends' relationships are counted. */
  linkDistance: number;
  /** Extra link length for each relationship either end has, so clusters breathe. */
  linkDistancePerConnection: number;
  /** How hard a link pulls toward its length, from 0 to 1. */
  linkStrength: number;
  /** Repulsion of a person with no relationships. Negative pushes apart. */
  chargeStrength: number;
  /** Extra repulsion for each relationship a person has. */
  chargeStrengthPerConnection: number;
  /** How hard nodes are pulled toward the middle of the box, from 0 to 1. */
  centerStrength: number;
  /** Clear space kept around each node. */
  collidePadding: number;
  /** How fast the layout cools each tick. Lower settles later and better. */
  alphaDecay: number;
  /** How much speed a node loses each tick, from 0 to 1. */
  velocityDecay: number;
  /** The heat the layout is held at while a node is dragged, and reheated to on a resize. */
  reheatAlpha: number;
  /** Padding inside a relationship label's pill, across. */
  edgeLabelPaddingX: number;
  /** Padding inside a relationship label's pill, up and down. */
  edgeLabelPaddingY: number;
  /** How far right of the pointer the tooltip sits. */
  tooltipOffsetX: number;
  /** How far above the pointer the tooltip sits. */
  tooltipOffsetY: number;
}

export const NETWORK_GRAPH_DEFAULTS: Readonly<NetworkGraphSettings> = Object.freeze({
  minNodeRadius: 18,
  maxNodeRadius: 32,
  nodeRadiusFullAt: 10,
  hubAboveConnections: 3,
  hubRingGap: 4,
  initialsSizeRatio: 0.6,
  nameGap: 6,
  minZoom: 0.1,
  maxZoom: 4,
  initialZoom: 0.5,
  resetZoomMs: 400,
  linkDistance: 120,
  linkDistancePerConnection: 8,
  linkStrength: 0.5,
  chargeStrength: -300,
  chargeStrengthPerConnection: -30,
  centerStrength: 0.05,
  collidePadding: 50,
  alphaDecay: 0.02,
  velocityDecay: 0.4,
  reheatAlpha: 0.3,
  edgeLabelPaddingX: 4,
  edgeLabelPaddingY: 2,
  tooltipOffsetX: 16,
  tooltipOffsetY: 8,
});
