// Unit conversions. The month and year lengths are the round ones a "3 months ago" label uses, not calendar maths.

/** Milliseconds in a minute. */
export const MS_PER_MINUTE = 60_000;
/** Milliseconds in a day. */
export const MS_PER_DAY = 86_400_000;
/** Days in a week. */
export const DAYS_PER_WEEK = 7;
/** Days in a month, rounded to 30. */
export const DAYS_PER_MONTH = 30;
/** Days in a year, leap years ignored. */
export const DAYS_PER_YEAR = 365;
/** The year the API stores a date under when its own is not known. A leap year, so 29 February fits. */
export const YEARLESS_DATE_YEAR = 1604;
/** Weeks in a month, rounded to 4. */
export const WEEKS_PER_MONTH = 4;
