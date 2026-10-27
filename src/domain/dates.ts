// Date rules the validator uses to check the LLM instead of trusting it.
// Every function takes "today" or "now" as an argument rather than reading
// the clock, so the same input always gives the same answer in tests.
// An IsoDate argument must already have passed isIsoDate.
import type { IsoDate, TimeOfDay } from './types';

// India has used one fixed offset (UTC+5:30, no daylight saving) since 1945,
// so a constant is exact and doesn't depend on the phone's time-zone data.
const KOLKATA_OFFSET_MINUTES = 5 * 60 + 30;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;

// Stops a bad LLM range ("2026-10-28" to "2099-01-01") from building a huge
// list. The validator applies the real booking-length rule on top.
const MAX_RANGE_DAYS = 31;

// Same order as Date.getUTCDay(): index 0 is Sunday.
export const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// All arithmetic happens on UTC midnight, which has no daylight saving, so
// adding MS_PER_DAY always lands on the next calendar date.
function toUtcMidnight(date: IsoDate): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcMidnight(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** Rejects wrong formats and impossible dates like "2026-02-30". */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  return fromUtcMidnight(toUtcMidnight(value)) === value;
}

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;
const MINUTES_PER_HOUR = 60;

/** 24-hour "HH:mm", 00:00 to 23:59. */
export function isTimeOfDay(value: string): boolean {
  return TIME_OF_DAY.test(value);
}

/** "18:30" -> 1110. Expects a valid "HH:mm" time. */
export function minutesSinceMidnight(time: TimeOfDay): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
}

/** 1110 -> "18:30". Expects 0 to 1439. */
export function timeFromMinutes(totalMinutes: number): TimeOfDay {
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** "18:00" -> "6 PM", "18:30" -> "6:30 PM", "00:00" -> "12 AM". */
export function formatTime(time: TimeOfDay): string {
  const total = minutesSinceMidnight(time);
  const hours24 = Math.floor(total / MINUTES_PER_HOUR);
  const minutes = total % MINUTES_PER_HOUR;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  return minutes === 0 ? `${hours12} ${suffix}` : `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function todayInKolkata(now: Date): IsoDate {
  return fromUtcMidnight(new Date(now.getTime() + KOLKATA_OFFSET_MINUTES * MS_PER_MINUTE));
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMidnight(new Date(toUtcMidnight(date).getTime() + days * MS_PER_DAY));
}

export function weekdayOf(date: IsoDate): Weekday {
  return WEEKDAYS[toUtcMidnight(date).getUTCDay()];
}

/**
 * Every date from start to end, both included ("28 se 30 October" gives three
 * dates). Null when end is before start or the range is unreasonably long.
 */
export function datesInRange(start: IsoDate, end: IsoDate): IsoDate[] | null {
  // Checked here too: the loop compares strings, and garbage would never end it.
  if (!isIsoDate(start) || !isIsoDate(end)) return null;
  const dates: IsoDate[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (dates.length === MAX_RANGE_DAYS) return null;
    dates.push(date);
  }
  return dates.length > 0 ? dates : null;
}

/**
 * Owners rarely say the year ("25th October"), and an LLM may guess an old
 * one. Picks the first such date on or after today, so the year never comes
 * from the LLM. Null for impossible dates like 30 February.
 */
export function nextOccurrence(month: number, day: number, today: IsoDate): IsoDate | null {
  const thisYear = Number(today.slice(0, 4));
  for (const year of [thisYear, thisYear + 1]) {
    const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (isIsoDate(candidate) && candidate >= today) return candidate;
  }
  return null;
}

const WEEKDAY_WORDS = new Map<string, Weekday>([
  ...WEEKDAYS.map((weekday) => [weekday, weekday] as const),
  ['sun', 'sunday'],
  ['mon', 'monday'],
  ['tue', 'tuesday'],
  ['tues', 'tuesday'],
  ['wed', 'wednesday'],
  ['thu', 'thursday'],
  ['thur', 'thursday'],
  ['thurs', 'thursday'],
  ['fri', 'friday'],
  ['sat', 'saturday'],
]);

/** "Sat", "saturday", "Sat." -> "saturday". Anything else, like "next Saturday", is null. */
export function weekdayFromWord(raw: string): Weekday | null {
  return WEEKDAY_WORDS.get(raw.trim().toLowerCase().replace(/\.$/, '')) ?? null;
}

export interface WeekdayResolution {
  date: IsoDate;
  /** Set only when today is that weekday: the same day next week. */
  alternative: IsoDate | null;
}

/**
 * The next `weekday` on or after today. "Saturday" said on a Saturday could
 * mean today or next week. Today is the default because owners book extra
 * staff at short notice; next week is returned as `alternative`, and the
 * validator marks the date as assumed so the owner picks one of the two.
 */
export function resolveWeekday(weekday: Weekday, today: IsoDate): WeekdayResolution {
  const daysAhead =
    (WEEKDAYS.indexOf(weekday) - WEEKDAYS.indexOf(weekdayOf(today)) + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return {
    date: addDays(today, daysAhead),
    alternative: daysAhead === 0 ? addDays(today, DAYS_PER_WEEK) : null,
  };
}

// Only words with one meaning. Hindi "kal" means both yesterday and tomorrow,
// and "this weekend" or "next week" cover several days, so those are asked.
const RELATIVE_DAY_OFFSETS = new Map<string, number>([
  ['today', 0],
  ['tonight', 0],
  ['tomorrow', 1],
  ['day after tomorrow', 2],
]);

export function resolveRelativeDay(raw: string, today: IsoDate): IsoDate | null {
  const offset = RELATIVE_DAY_OFFSETS.get(raw.trim().toLowerCase().replace(/\s+/g, ' '));
  return offset === undefined ? null : addDays(today, offset);
}

const WEEKDAY_LABELS: Record<Weekday, string> = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sat 24 Oct", for the read-back line and the date chips. */
export function formatShortDate(date: IsoDate): string {
  const utc = toUtcMidnight(date);
  return `${WEEKDAY_LABELS[weekdayOf(date)]} ${utc.getUTCDate()} ${MONTH_LABELS[utc.getUTCMonth()]}`;
}
