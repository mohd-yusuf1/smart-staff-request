// Ranks partners for one line item. Plain arithmetic on the request and the
// partner data, no LLM, so the explanation can quote the exact numbers that
// produced each rank.
import { minutesSinceMidnight, weekdayOf } from '../domain/dates';
import { distanceKm, LOCALITIES } from '../domain/localities';
import type {
  BookedSlot,
  Budget,
  ExcludedPartner,
  IsoDate,
  MatchRequest,
  MatchResult,
  Partner,
  ScoreComponents,
  ScoredPartner,
  SubcategoryMatch,
} from '../domain/types';
import type { Subcategory } from '../domain/taxonomy';

// Sum to 1, so a total is also between 0 and 1. Hours weigh as much as skill:
// a partner who arrives late or leaves early leaves the restaurant short in
// the middle of service. With skill at 0.40 and hours at 0.25, a tandoor chef
// free 3 of 5 hours outranked one free all 5 hours with tandoor as a second skill.
export const WEIGHTS: Readonly<ScoreComponents> = {
  subcategory: 0.35,
  availability: 0.35,
  distance: 0.15,
  reliability: 0.15,
};

// Partners without the requested skill are filtered out, not scored low.
const SUBCATEGORY_SCORES: Record<SubcategoryMatch, number> = {
  any: 1,
  primary: 1,
  secondary: 0.7,
};

// The distance component reaches 0 here. 15 km straight line is about
// 18-20 km by road (road was 1.2-1.3x straight line in our Google Maps checks).
const DISTANCE_LIMIT_KM = 15;

// Ratings in the data sit between 4 and 5, so rating / 5 would barely separate
// partners. Stretch 3..5 to 0..1 instead.
const RELIABILITY_FLOOR = 3;
const RELIABILITY_CEILING = 5;

const MINUTES_PER_HOUR = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

type Interval = [start: number, end: number];

/** The part of the requested window inside the partner's working hours that day. */
function workingWindow(partner: Partner, date: IsoDate, request: MatchRequest): Interval | null {
  if (partner.blockedDates.includes(date)) return null;
  const shift = partner.weeklyHours[weekdayOf(date)];
  if (!shift) return null;
  const start = Math.max(minutesSinceMidnight(request.startTime), minutesSinceMidnight(shift.start));
  const end = Math.min(minutesSinceMidnight(request.endTime), minutesSinceMidnight(shift.end));
  return end > start ? [start, end] : null;
}

// Touching is not overlapping: booked until 4 PM leaves a 4 PM start free.
function overlaps([aStart, aEnd]: Interval, [bStart, bEnd]: Interval): boolean {
  return aStart < bEnd && bStart < aEnd;
}

interface Coverage {
  /** Requested minutes inside working hours. */
  working: number;
  /** Of those, the minutes on days with no clashing booking. */
  free: number;
}

function coverage(partner: Partner, request: MatchRequest, booked: readonly BookedSlot[]): Coverage {
  const result: Coverage = { working: 0, free: 0 };
  for (const date of request.dates) {
    const window = workingWindow(partner, date, request);
    if (!window) continue;
    // A booking that touches any part of the window rules out the whole day:
    // the partner can't cover a shift that clashes with one they already have.
    const clash = booked.some(
      (slot) =>
        slot.partnerId === partner.id &&
        slot.date === date &&
        overlaps(window, [minutesSinceMidnight(slot.start), minutesSinceMidnight(slot.end)]),
    );
    const minutes = window[1] - window[0];
    result.working += minutes;
    if (!clash) result.free += minutes;
  }
  return result;
}

// Partners are paid by the day, so an hourly budget becomes a daily one for
// the requested hours.
function isOverBudget(partner: Partner, budget: Budget | null, minutesPerDay: number): boolean {
  if (!budget) return false;
  const dailyLimit =
    budget.per === 'day' ? budget.amountInr : (budget.amountInr * minutesPerDay) / MINUTES_PER_HOUR;
  return partner.dayRateInr > dailyLimit;
}

/** Null when the partner doesn't have the requested skill at all. */
function subcategoryMatch(partner: Partner, wanted: Subcategory | null): SubcategoryMatch | null {
  if (wanted === null) return 'any';
  if (partner.primarySubcategory === wanted) return 'primary';
  if (partner.secondarySubcategories.includes(wanted)) return 'secondary';
  return null;
}

function weightedTotal(components: ScoreComponents): number {
  const keys = Object.keys(WEIGHTS) as (keyof ScoreComponents)[];
  return roundTo2(keys.reduce((sum, key) => sum + WEIGHTS[key] * components[key], 0));
}

function scorePartner(
  partner: Partner,
  request: MatchRequest,
  match: SubcategoryMatch,
  coveredMinutes: number,
  requestedMinutes: number,
): ScoredPartner {
  const km = distanceKm(LOCALITIES[partner.home], LOCALITIES[request.location]);
  const components: ScoreComponents = {
    subcategory: SUBCATEGORY_SCORES[match],
    availability: coveredMinutes / requestedMinutes,
    distance: Math.max(0, 1 - km / DISTANCE_LIMIT_KM),
    reliability: clamp(
      (partner.reliability - RELIABILITY_FLOOR) / (RELIABILITY_CEILING - RELIABILITY_FLOOR),
      0,
      1,
    ),
  };
  return {
    partner,
    total: weightedTotal(components),
    components,
    subcategoryMatch: match,
    distanceKm: km,
    hoursCovered: coveredMinutes / MINUTES_PER_HOUR,
    hoursRequested: requestedMinutes / MINUTES_PER_HOUR,
  };
}

// Totals are compared after rounding, so two partners who show the same score
// are ordered by a rule the explanation can state: rating, then distance, then
// id so the order never changes between runs.
function compareScored(a: ScoredPartner, b: ScoredPartner): number {
  return (
    b.total - a.total ||
    b.partner.reliability - a.partner.reliability ||
    a.distanceKm - b.distanceKm ||
    a.partner.id.localeCompare(b.partner.id)
  );
}

/**
 * `booked` is the time partners already have on other confirmed requests. A
 * partner booked 12-4 PM can't be picked for 1-5 PM, but can for 4-8 PM.
 */
export function rankPartners(
  request: MatchRequest,
  partners: readonly Partner[],
  booked: readonly BookedSlot[] = [],
): MatchResult {
  const minutesPerDay =
    minutesSinceMidnight(request.endTime) - minutesSinceMidnight(request.startTime);
  if (request.dates.length === 0 || minutesPerDay <= 0) {
    throw new RangeError('rankPartners needs at least one date and an end time after the start time.');
  }
  const requestedMinutes = minutesPerDay * request.dates.length;

  const ranked: ScoredPartner[] = [];
  const excluded: ExcludedPartner[] = [];
  for (const partner of partners) {
    if (partner.role !== request.role) continue;
    const match = subcategoryMatch(partner, request.subcategory);
    const { working, free } = coverage(partner, request, booked);
    if (match === null) {
      excluded.push({ partner, reason: 'different_skill' });
    } else if (working === 0) {
      excluded.push({ partner, reason: 'not_available' });
    } else if (free === 0) {
      excluded.push({ partner, reason: 'already_booked' });
    } else if (isOverBudget(partner, request.budget, minutesPerDay)) {
      excluded.push({ partner, reason: 'over_budget' });
    } else {
      ranked.push(scorePartner(partner, request, match, free, requestedMinutes));
    }
  }
  return { ranked: ranked.sort(compareScored), excluded };
}
