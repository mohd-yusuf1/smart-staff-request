import type { Weekday } from './dates';
import type { LocalityId } from './localities';
import type { Role, Subcategory } from './taxonomy';

/** Calendar date in Asia/Kolkata, "YYYY-MM-DD". */
export type IsoDate = string;
/** 24-hour wall-clock time, "HH:mm". */
export type TimeOfDay = string;

/**
 * How much the owner should trust a field. Decided by our validator from
 * checkable signals, never by the LLM's own confidence.
 * - ok:      stated in the text and passes every check; shown quietly
 * - assumed: filled from a convention or default; owner must check it
 * - missing: required but not in the text; we ask instead of guessing
 * - invalid: present but fails a check (past date, unknown area, ...)
 */
export type FieldStatus = 'ok' | 'assumed' | 'missing' | 'invalid';

export interface Field<T> {
  value: T | null;
  /** Verbatim words from the owner's text this value came from, if any. */
  evidence: string | null;
  status: FieldStatus;
  /** Shown to the owner when status is not 'ok'. */
  reason: string | null;
  /** Owner tapped "Looks right" or edited it; needed to confirm an 'assumed' field. */
  checkedByOwner: boolean;
  /** Other likely values, offered as one-tap choices (e.g. "Sat 31 Oct" for "Saturday"). */
  alternatives: T[];
}

/** One kind of staff for one schedule. "2 chefs Sat and 1 cleaner Sun" is two line items. */
export interface LineItem {
  id: string;
  role: Field<Role>;
  /** value null means "any subcategory of this role". */
  subcategory: Field<Subcategory>;
  count: Field<number>;
  /** Several dates for multi-day bookings, same hours each day. */
  dates: Field<IsoDate[]>;
  startTime: Field<TimeOfDay>;
  endTime: Field<TimeOfDay>;
  location: Field<LocalityId>;
}

export interface Budget {
  amountInr: number;
  per: 'day' | 'hour';
}

export type BookingIntent = 'new' | 'cancel_and_rebook';

export type BookingStatus = 'draft' | 'confirmed' | 'partially_confirmed' | 'cancelled';

export interface Booking {
  id: string;
  /** Exactly what the owner typed; the review screen highlights evidence in it. */
  sourceText: string;
  intent: BookingIntent;
  /** Set when intent is cancel_and_rebook and a previous request was found. */
  cancelsBookingId: string | null;
  /** The owner tapped to agree that the previous request will be cancelled. */
  cancelCheckedByOwner: boolean;
  lineItems: LineItem[];
  /** Optional: value null with status 'ok' means no budget was given. */
  budget: Field<Budget>;
  notes: string | null;
  status: BookingStatus;
  /** Partner ids picked for each line item, set when the owner confirms. */
  assignments: Record<string, string[]>;
  createdAt: string;
}

/** Working hours within one day; end is after start (no overnight shifts). */
export interface ShiftWindow {
  start: TimeOfDay;
  end: TimeOfDay;
}

export interface Partner {
  id: string;
  name: string;
  role: Role;
  /** Main skill; scores highest. */
  primarySubcategory: Subcategory;
  /** Other skills in the same role; score lower than the main one. */
  secondarySubcategories: Subcategory[];
  home: LocalityId;
  /** Average rating from past bookings, out of 5. */
  reliability: number;
  dayRateInr: number;
  /** Usual hours for each weekday; a missing day means not working. */
  weeklyHours: Partial<Record<Weekday, ShiftWindow>>;
  /** Days off on top of the weekly pattern. */
  blockedDates: IsoDate[];
}

/** A line item after review: every field is filled and checked, ready to match. */
export interface MatchRequest {
  role: Role;
  /** null means any subcategory of the role. */
  subcategory: Subcategory | null;
  dates: IsoDate[];
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  location: LocalityId;
  budget: Budget | null;
}

/** How the partner's skills meet the requested subcategory. */
export type SubcategoryMatch = 'primary' | 'secondary' | 'any';

/** Each component is between 0 and 1. */
export interface ScoreComponents {
  subcategory: number;
  availability: number;
  distance: number;
  reliability: number;
}

/** The raw facts are kept next to the score so explanations quote real numbers. */
export interface ScoredPartner {
  partner: Partner;
  /** Weighted sum of the components, rounded to 2 decimals (what the owner sees). */
  total: number;
  components: ScoreComponents;
  subcategoryMatch: SubcategoryMatch;
  distanceKm: number;
  hoursCovered: number;
  hoursRequested: number;
}

/** Time a partner already has on another confirmed request; that time isn't free again. */
export interface BookedSlot {
  partnerId: string;
  date: IsoDate;
  start: TimeOfDay;
  end: TimeOfDay;
}

export type ExclusionReason = 'different_skill' | 'not_available' | 'already_booked' | 'over_budget';

export interface ExcludedPartner {
  partner: Partner;
  reason: ExclusionReason;
}

export interface MatchResult {
  /** Best first. */
  ranked: ScoredPartner[];
  /** Partners of the right role removed by a hard filter, to explain a short or empty list. */
  excluded: ExcludedPartner[];
}
