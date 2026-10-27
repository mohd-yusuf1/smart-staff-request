// What the review screen needs to know about a booking: which rows need the
// owner, in what order, and how to describe values in words. Pure functions.
import { addDays, formatShortDate, formatTime } from '../domain/dates';
import { LOCALITIES } from '../domain/localities';
import { ROLE_LABELS, SUBCATEGORY_LABELS, SUBCATEGORY_STAFF_LABELS } from '../domain/taxonomy';
import type { Booking, Field, IsoDate, LineItem } from '../domain/types';

/** Start and end time are one row: they are picked together. */
export type RowKey = 'role' | 'subcategory' | 'count' | 'dates' | 'time' | 'location';

export const ROW_KEYS: RowKey[] = ['role', 'subcategory', 'count', 'dates', 'time', 'location'];

export const ROW_LABELS: Record<RowKey, string> = {
  role: 'Staff',
  subcategory: 'Skill',
  count: 'How many',
  dates: 'Date',
  time: 'Time',
  location: 'Area',
};

/** fix: red, must be answered. check: amber, needs one tap. done: green. */
export type Attention = 'fix' | 'check' | 'done';

const ATTENTION_RANK: Record<Attention, number> = { fix: 0, check: 1, done: 2 };

export function attentionOf(field: Field<unknown>): Attention {
  if (field.status === 'missing' || field.status === 'invalid') return 'fix';
  if (field.status === 'assumed' && !field.checkedByOwner) return 'check';
  return 'done';
}

export function fieldsOfRow(item: LineItem, key: RowKey): Field<unknown>[] {
  return key === 'time' ? [item.startTime, item.endTime] : [item[key]];
}

export function rowAttention(item: LineItem, key: RowKey): Attention {
  return fieldsOfRow(item, key)
    .map(attentionOf)
    .reduce((worst, next) => (ATTENTION_RANK[next] < ATTENTION_RANK[worst] ? next : worst), 'done');
}

/** The reasons of the fields in this row that still need the owner. */
export function rowReason(item: LineItem, key: RowKey): string | null {
  const reasons = fieldsOfRow(item, key)
    .filter((field) => attentionOf(field) !== 'done' && field.reason)
    .map((field) => field.reason as string);
  return reasons.length > 0 ? [...new Set(reasons)].join(' ') : null;
}

/** Red rows first, then amber, then green, so attention goes where it's needed. */
export function sortedRows(item: LineItem): RowKey[] {
  return [...ROW_KEYS].sort((a, b) => ATTENTION_RANK[rowAttention(item, a)] - ATTENTION_RANK[rowAttention(item, b)]);
}

export interface ReviewProgress {
  toFix: number;
  toCheck: number;
}

export function reviewProgress(booking: Booking): ReviewProgress {
  const progress: ReviewProgress = { toFix: 0, toCheck: 0 };
  const count = (attention: Attention) => {
    if (attention === 'fix') progress.toFix += 1;
    if (attention === 'check') progress.toCheck += 1;
  };
  for (const item of booking.lineItems) {
    for (const key of ROW_KEYS) count(rowAttention(item, key));
  }
  count(attentionOf(booking.budget));
  // Cancelling the earlier request is its own decision, so it needs its own tap.
  if (booking.cancelsBookingId !== null && !booking.cancelCheckedByOwner) progress.toCheck += 1;
  return progress;
}

export function formatDates(dates: IsoDate[]): string {
  const consecutive = dates.every((date, i) => i === 0 || addDays(dates[i - 1], 1) === date);
  if (dates.length > 2 && consecutive) {
    return `${formatShortDate(dates[0])} – ${formatShortDate(dates[dates.length - 1])}`;
  }
  return dates.map(formatShortDate).join(', ');
}

const UNKNOWN = '?';

export function formatRowValue(item: LineItem, key: RowKey): string {
  switch (key) {
    case 'role':
      return item.role.value ? ROLE_LABELS[item.role.value] : UNKNOWN;
    case 'subcategory':
      if (item.subcategory.value) return SUBCATEGORY_LABELS[item.subcategory.value];
      return item.role.value ? 'Any' : UNKNOWN;
    case 'count':
      return item.count.value === null ? UNKNOWN : String(item.count.value);
    case 'dates':
      return item.dates.value ? formatDates(item.dates.value) : UNKNOWN;
    case 'time': {
      const start = item.startTime.value ? formatTime(item.startTime.value) : UNKNOWN;
      const end = item.endTime.value ? formatTime(item.endTime.value) : UNKNOWN;
      return `${start} – ${end}`;
    }
    case 'location':
      return item.location.value ? LOCALITIES[item.location.value].name : UNKNOWN;
  }
}

/** "2 × Chinese chef", "1 × Kitchen helper", "1 × Chef" when any skill will do. */
export function whoText(item: LineItem): string {
  const count = item.count.value ?? UNKNOWN;
  if (item.subcategory.value) return `${count} × ${SUBCATEGORY_STAFF_LABELS[item.subcategory.value]}`;
  return `${count} × ${item.role.value ? ROLE_LABELS[item.role.value] : 'Staff'}`;
}

/** "2 × Chinese chef · Sat 31 Oct · 6 PM – 11 PM · Connaught Place" */
export function readback(item: LineItem): string {
  return [whoText(item), formatRowValue(item, 'dates'), formatRowValue(item, 'time'), formatRowValue(item, 'location')].join(' · ');
}
