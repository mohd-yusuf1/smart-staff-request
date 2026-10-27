// The owner's corrections. Each returns a new booking (nothing is mutated) and
// touches only the fields the owner changed, plus the checks that depend on them.
import { formatTime } from '../domain/dates';
import type { LocalityId } from '../domain/localities';
import { ROLE_LABELS, subcategoriesOf, type Role, type Subcategory } from '../domain/taxonomy';
import type { Booking, Field, IsoDate, LineItem, TimeOfDay } from '../domain/types';
import type { RowKey } from './review';
import { blankLineItem, MAX_LINE_ITEMS } from './validate';

/** Whatever the owner picks is what they meant, so it is ok and checked. */
function ownerSet<T>(field: Field<T>, value: T | null): Field<T> {
  return { ...field, value, status: 'ok', reason: null, checkedByOwner: true, alternatives: [] };
}

function ownerConfirmed<T>(field: Field<T>): Field<T> {
  return field.status === 'assumed' ? { ...field, checkedByOwner: true } : field;
}

export function updateLineItem(booking: Booking, lineItemId: string, update: (item: LineItem) => LineItem): Booking {
  return { ...booking, lineItems: booking.lineItems.map((item) => (item.id === lineItemId ? update(item) : item)) };
}

export function setRole(item: LineItem, role: Role): LineItem {
  const skills = subcategoriesOf(role);
  const current = item.subcategory.value;
  let subcategory = item.subcategory;
  if (skills.length === 1) {
    subcategory = { ...ownerSet(item.subcategory, skills[0]), checkedByOwner: false };
  } else if (current === null || !skills.includes(current)) {
    // The old skill doesn't fit the new role: fall back to "any", for the owner to check.
    subcategory = {
      ...item.subcategory,
      value: null,
      status: 'assumed',
      reason: `No speciality given, so any ${ROLE_LABELS[role].toLowerCase()} will do.`,
      checkedByOwner: false,
      alternatives: [],
    };
  }
  return { ...item, role: ownerSet(item.role, role), subcategory };
}

export function setSubcategory(item: LineItem, subcategory: Subcategory | null): LineItem {
  return { ...item, subcategory: ownerSet(item.subcategory, subcategory) };
}

export function setCount(item: LineItem, count: number): LineItem {
  return { ...item, count: ownerSet(item.count, count) };
}

export function setDates(item: LineItem, dates: IsoDate[]): LineItem {
  return { ...item, dates: ownerSet(item.dates, dates) };
}

export function setTimes(item: LineItem, start: TimeOfDay, end: TimeOfDay): LineItem {
  const startTime = ownerSet(item.startTime, start);
  if (end <= start) {
    return {
      ...item,
      startTime,
      endTime: {
        ...item.endTime,
        value: null,
        status: 'invalid',
        reason: `Ends at ${formatTime(end)}, not after the ${formatTime(start)} start. Overnight shifts aren't supported.`,
        checkedByOwner: false,
        alternatives: [],
      },
    };
  }
  return { ...item, startTime, endTime: ownerSet(item.endTime, end) };
}

export function setLocation(item: LineItem, location: LocalityId): LineItem {
  return { ...item, location: ownerSet(item.location, location) };
}

/** "Looks right": accepts every assumed field in the row as it is. */
export function confirmRow(item: LineItem, key: RowKey): LineItem {
  if (key === 'time') {
    return { ...item, startTime: ownerConfirmed(item.startTime), endTime: ownerConfirmed(item.endTime) };
  }
  return { ...item, [key]: ownerConfirmed(item[key] as Field<unknown>) };
}

// Ids are "<booking>-<n>". After a removal the count no longer gives a free n,
// so take the first one not in use.
function nextLineItemId(booking: Booking): string {
  const used = new Set(booking.lineItems.map((item) => item.id));
  let n = booking.lineItems.length + 1;
  while (used.has(`${booking.id}-${n}`)) n += 1;
  return `${booking.id}-${n}`;
}

/** A requirement the parse missed, e.g. the cleaner when "fill it in myself" started with one card. */
export function addLineItem(booking: Booking, role: Role, now: Date): Booking {
  if (booking.lineItems.length >= MAX_LINE_ITEMS) return booking;
  const item = setRole(blankLineItem(nextLineItemId(booking), now), role);
  return { ...booking, lineItems: [...booking.lineItems, item] };
}

/** The last requirement can't be removed: a request with nobody to book is no request. */
export function removeLineItem(booking: Booking, lineItemId: string): Booking {
  if (booking.lineItems.length <= 1) return booking;
  return { ...booking, lineItems: booking.lineItems.filter((item) => item.id !== lineItemId) };
}

/** An unreadable budget can be dropped instead of guessed. */
export function removeBudget(booking: Booking): Booking {
  return { ...booking, budget: ownerSet(booking.budget, null) };
}

export function confirmCancel(booking: Booking): Booking {
  return { ...booking, cancelCheckedByOwner: true };
}
