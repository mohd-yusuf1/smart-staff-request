// Turns the LLM's JSON into a Booking with a status on every field. LLM output
// is untrusted: each field is checked on its own, so one bad field becomes
// 'invalid' or 'missing' instead of failing the whole parse. Status always
// comes from these checks, never from the LLM's own confidence.
import { z } from 'zod';

import {
  addDays,
  formatShortDate,
  formatTime,
  isIsoDate,
  isTimeOfDay,
  minutesSinceMidnight,
  nextOccurrence,
  resolveRelativeDay,
  resolveWeekday,
  timeFromMinutes,
  todayInKolkata,
  weekdayFromWord,
} from '../domain/dates';
import { LOCALITIES, normalizeLocality, type LocalityId } from '../domain/localities';
import {
  isSubcategoryOfRole,
  normalizeRole,
  normalizeSubcategory,
  ROLE_LABELS,
  subcategoriesOf,
  SUBCATEGORY_LABELS,
  type Role,
  type Subcategory,
} from '../domain/taxonomy';
import type {
  Booking,
  Budget,
  Field,
  FieldStatus,
  IsoDate,
  LineItem,
  TimeOfDay,
} from '../domain/types';

// ---- What the LLM must return ----------------------------------------------
// Every field is { value, evidence }; evidence is the exact words from the
// owner's text the value came from. A field that is malformed or absent reads
// as { null, null }, so it becomes "missing" and the owner is asked.
const rawFieldSchema = z
  .object({ value: z.unknown(), evidence: z.string().nullable().catch(null) })
  .catch({ value: null, evidence: null });

const rawLineItemSchema = z.object({
  role: rawFieldSchema,
  subcategory: rawFieldSchema,
  count: rawFieldSchema,
  dates: rawFieldSchema,
  startTime: rawFieldSchema,
  endTime: rawFieldSchema,
  location: rawFieldSchema,
});

export const llmOutputSchema = z.object({
  intent: z.enum(['new', 'cancel_and_rebook']).catch('new'),
  lineItems: z.array(rawLineItemSchema),
  budget: rawFieldSchema,
  // Plain text, but the LLM sometimes wraps it like the other fields: { value: "party" }.
  notes: z
    .union([z.string(), z.object({ value: z.string() }).transform((wrapped) => wrapped.value)])
    .nullable()
    .catch(null),
});

type RawField = z.infer<typeof rawFieldSchema>;
type RawLineItem = z.infer<typeof rawLineItemSchema>;
type LlmOutput = z.infer<typeof llmOutputSchema>;

const budgetSchema = z.object({
  amountInr: z.number().positive().max(100_000),
  per: z.enum(['day', 'hour']),
});

// ---- Rules -----------------------------------------------------------------
export const MAX_LINE_ITEMS = 5;
const MIN_COUNT = 1;
const MAX_COUNT = 20;
const DEFAULT_COUNT = 1;
const MAX_BOOKING_DAYS = 7;
const DEFAULT_SHIFT_MINUTES = 5 * 60;
const LAST_MINUTE_OF_DAY = 24 * 60 - 1;
const MAX_NOTES_LENGTH = 500;

/** Conventional readings of vague time words. Filled in, but marked assumed. */
export const TIME_WORDS: Record<string, { start: TimeOfDay; end: TimeOfDay }> = {
  morning: { start: '08:00', end: '12:00' },
  afternoon: { start: '12:00', end: '16:00' },
  lunch: { start: '11:00', end: '16:00' },
  evening: { start: '18:00', end: '23:00' },
  dinner: { start: '18:00', end: '23:00' },
};

const VAGUE_DATE = /\b(weekend|next week|this week)\b/;
// Longest phrase first, so "day after tomorrow" isn't read as "tomorrow".
const RELATIVE_DAY_PHRASE = /\b(day after tomorrow|tomorrow|tonight|today)\b/;
const CLOCK_TIME = /\b(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/;

const NOT_IN_TEXT = 'Not in your text, so please check it.';

// ---- Field builders ----------------------------------------------------------
function makeField<T>(
  status: FieldStatus,
  value: T | null,
  evidence: string | null,
  reason: string | null,
  alternatives: T[] = [],
): Field<T> {
  return { value, evidence, status, reason, checkedByOwner: false, alternatives };
}

function ok<T>(value: T | null, evidence: string | null): Field<T> {
  return makeField('ok', value, evidence, null);
}

function assumed<T>(value: T | null, evidence: string | null, reason: string, alternatives: T[] = []): Field<T> {
  return makeField('assumed', value, evidence, reason, alternatives);
}

function missing<T>(evidence: string | null, reason: string, alternatives: T[] = []): Field<T> {
  return makeField<T>('missing', null, evidence, reason, alternatives);
}

function invalid<T>(evidence: string | null, reason: string): Field<T> {
  return makeField<T>('invalid', null, evidence, reason);
}

interface Checks {
  sourceText: string;
  today: IsoDate;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Evidence must be words the owner actually typed. If it isn't, the LLM
// invented or reworded it, so the value can't count as stated.
function isEvidenceInText(evidence: string | null, checks: Checks): evidence is string {
  return evidence !== null && evidence.trim() !== '' && normalizeText(checks.sourceText).includes(normalizeText(evidence));
}

/** For a value our code could not verify further: ok only if its evidence is real. */
function fromLlm<T>(value: T, evidence: string | null, checks: Checks): Field<T> {
  return isEvidenceInText(evidence, checks) ? ok(value, evidence) : assumed(value, evidence, NOT_IN_TEXT);
}

/** null, undefined or "" all mean the LLM found nothing, so we ask. */
function isAbsent(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

const UNREADABLE = "Couldn't read this. Please pick a value.";

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value);
  return null;
}

// ---- Role, skill, count, location, budget ------------------------------------
function validateRole(raw: RawField, checks: Checks): Field<Role> {
  if (isAbsent(raw.value)) return missing(raw.evidence, 'Not mentioned.');
  const text = asText(raw.value);
  if (text === null) return invalid(raw.evidence, UNREADABLE);
  const role = normalizeRole(text);
  if (role === null) return invalid(raw.evidence, `We don't book "${text}".`);
  return fromLlm(role, raw.evidence, checks);
}

function validateSubcategory(raw: RawField, role: Role | null, checks: Checks): Field<Subcategory> {
  const options = role === null ? [] : subcategoriesOf(role);
  if (isAbsent(raw.value)) {
    if (role === null) return ok<Subcategory>(null, null);
    // A waiter or helper has only one skill, so there is nothing to guess.
    if (options.length === 1) return ok(options[0], null);
    return assumed<Subcategory>(null, null, `No speciality given, so any ${ROLE_LABELS[role].toLowerCase()} will do.`);
  }
  const text = asText(raw.value);
  if (text === null) return invalid(raw.evidence, UNREADABLE);
  const subcategory = normalizeSubcategory(text);
  if (subcategory === null) return invalid(raw.evidence, `"${text}" isn't a skill we book.`);
  // The role's only skill needs no evidence: it follows from the role.
  if (options.length === 1 && options[0] === subcategory) return ok(subcategory, raw.evidence);
  if (role !== null && !isSubcategoryOfRole(subcategory, role)) {
    return invalid(raw.evidence, `${SUBCATEGORY_LABELS[subcategory]} isn't a ${ROLE_LABELS[role].toLowerCase()} skill.`);
  }
  return fromLlm(subcategory, raw.evidence, checks);
}

function validateCount(raw: RawField, checks: Checks): Field<number> {
  if (isAbsent(raw.value)) {
    return assumed(DEFAULT_COUNT, null, `No number given, so assuming ${DEFAULT_COUNT}.`);
  }
  const count = asNumber(raw.value);
  if (count === null || !Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
    return invalid(raw.evidence, `Must be a whole number from ${MIN_COUNT} to ${MAX_COUNT}.`);
  }
  return fromLlm(count, raw.evidence, checks);
}

function validateLocation(raw: RawField, fallback: LocalityId | null, checks: Checks): Field<LocalityId> {
  if (isAbsent(raw.value)) {
    if (fallback !== null) {
      return assumed(fallback, null, `Not given, so using ${LOCALITIES[fallback].name} from the request you're replacing.`);
    }
    return missing(raw.evidence, 'Not mentioned.');
  }
  const text = asText(raw.value);
  if (text === null) return invalid(raw.evidence, UNREADABLE);
  const locality = normalizeLocality(text) ?? (raw.evidence ? normalizeLocality(raw.evidence) : null);
  if (locality === null) return invalid(raw.evidence, `We don't cover "${text}" yet. Pick an area from the list.`);
  return fromLlm(locality, raw.evidence, checks);
}

function validateBudget(raw: RawField, checks: Checks): Field<Budget> {
  // Budget is optional: none given is fine and means no budget filter.
  if (isAbsent(raw.value)) return ok<Budget>(null, null);
  const budget = budgetSchema.safeParse(raw.value);
  if (!budget.success) return invalid(raw.evidence, "Couldn't read the budget.");
  return fromLlm(budget.data, raw.evidence, checks);
}

// ---- Dates -----------------------------------------------------------------
/** Our own reading of the date words, or null when the words aren't ones we resolve. */
function dateFromWords(evidence: string, checks: Checks): Field<IsoDate[]> | null {
  const words = evidence.toLowerCase();

  const vague = VAGUE_DATE.exec(words);
  if (vague) {
    if (vague[1] !== 'weekend') return missing(evidence, `"${evidence}" isn't one date. Which day?`);
    const saturday = resolveWeekday('saturday', checks.today).date;
    const sunday = resolveWeekday('sunday', checks.today).date;
    const both = addDays(saturday, 1) === sunday ? [[saturday, sunday]] : [];
    return missing(evidence, `"${evidence}" could be Saturday, Sunday or both.`, [[saturday], [sunday], ...both]);
  }

  const relative = RELATIVE_DAY_PHRASE.exec(words);
  if (relative) {
    const date = resolveRelativeDay(relative[1], checks.today);
    return date === null ? null : ok([date], evidence);
  }

  // Exactly one weekday and no digits, so "Saturday" but not "Sat 31 Oct".
  if (/\d/.test(words)) return null;
  const tokens = words.split(/[^a-z.]+/).filter(Boolean);
  const weekdays = tokens.map(weekdayFromWord).filter((day) => day !== null);
  if (weekdays.length !== 1) return null;
  const { date, alternative } = resolveWeekday(weekdays[0], checks.today);
  if (tokens.includes('next')) {
    // "next Friday" is either the coming Friday or the one after it.
    const later = alternative ?? addDays(date, 7);
    const sooner = alternative === null ? date : addDays(date, 7);
    return assumed([sooner], evidence, `"${evidence}" could be ${formatShortDate(sooner)} or ${formatShortDate(later)}.`, [[later]]);
  }
  if (alternative !== null) {
    return assumed([date], evidence, `"${evidence}" could be today or next week.`, [[alternative]]);
  }
  return ok([date], evidence);
}

function validateDates(raw: RawField, checks: Checks): Field<IsoDate[]> {
  const llmDates = Array.isArray(raw.value) ? raw.value : null;

  if (isEvidenceInText(raw.evidence, checks)) {
    const fromWords = dateFromWords(raw.evidence, checks);
    if (fromWords !== null) {
      // Our resolution wins. Say so when the LLM had a different date.
      const ours = fromWords.value;
      const llmAgrees = ours !== null && llmDates !== null && llmDates.length === ours.length && ours.every((d, i) => d === llmDates[i]);
      if (fromWords.status === 'ok' && ours !== null && !llmAgrees) {
        return assumed(ours, raw.evidence, `Corrected: "${raw.evidence}" is ${ours.map(formatShortDate).join(', ')}.`);
      }
      return fromWords;
    }
  }

  if (llmDates === null || llmDates.length === 0) return missing(raw.evidence, 'Not mentioned.');
  if (!llmDates.every((d): d is string => typeof d === 'string' && isIsoDate(d))) {
    return invalid(raw.evidence, "Couldn't read the date.");
  }

  let yearCorrected = false;
  const dates: IsoDate[] = [];
  for (const date of llmDates) {
    if (date >= checks.today) {
      dates.push(date);
      continue;
    }
    // LLMs often guess an old year for "25th October". Only fix a stale year,
    // never move a date the owner may have mistyped into next year.
    const upcoming = nextOccurrence(Number(date.slice(5, 7)), Number(date.slice(8, 10)), checks.today);
    if (upcoming === null || upcoming.slice(0, 4) !== checks.today.slice(0, 4)) {
      // Name the weekday from this year's date, not the LLM's (possibly wrong) year.
      const thisYear = `${checks.today.slice(0, 4)}${date.slice(4)}`;
      return invalid(raw.evidence, `${formatShortDate(isIsoDate(thisYear) ? thisYear : date)} has already passed.`);
    }
    yearCorrected = true;
    dates.push(upcoming);
  }

  const unique = [...new Set(dates)].sort();
  if (unique.length > MAX_BOOKING_DAYS) {
    return invalid(raw.evidence, `A booking can cover at most ${MAX_BOOKING_DAYS} days.`);
  }
  if (yearCorrected) {
    return assumed(unique, raw.evidence, `No year given, so using ${checks.today.slice(0, 4)}.`);
  }
  return fromLlm(unique, raw.evidence, checks);
}

// ---- Times -----------------------------------------------------------------
function timeWordIn(evidence: string | null): { word: string; start: TimeOfDay; end: TimeOfDay } | null {
  if (evidence === null) return null;
  const words = evidence.toLowerCase();
  if (CLOCK_TIME.test(words)) return null;
  const word = Object.keys(TIME_WORDS).find((w) => new RegExp(`\\b${w}\\b`).test(words));
  return word ? { word, ...TIME_WORDS[word] } : null;
}

/** "6 PM" or "11am" in the evidence, as "HH:mm"; null when there is none. */
function clockTimeIn(evidence: string): TimeOfDay | null {
  const match = CLOCK_TIME.exec(evidence.toLowerCase());
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour < 1 || hour > 12) return null;
  const hour24 = (hour % 12) + (match[3] === 'pm' ? 12 : 0);
  return timeFromMinutes(hour24 * 60 + Number(match[2] ?? 0));
}

function validateTime(raw: RawField, checks: Checks): Field<TimeOfDay> {
  if (isAbsent(raw.value)) return missing(raw.evidence, 'Not mentioned.');
  const text = asText(raw.value);
  if (text === null || !isTimeOfDay(text)) return invalid(raw.evidence, "Couldn't read the time.");
  if (isEvidenceInText(raw.evidence, checks)) {
    const ours = clockTimeIn(raw.evidence);
    if (ours !== null && ours !== text) {
      return assumed(ours, raw.evidence, `Corrected to ${formatTime(ours)} from your text.`);
    }
  }
  return fromLlm(text, raw.evidence, checks);
}

function validateTimes(start: RawField, end: RawField, checks: Checks): Pick<LineItem, 'startTime' | 'endTime'> {
  const vagueStart = isEvidenceInText(start.evidence, checks) ? timeWordIn(start.evidence) : null;
  const vagueEnd = isEvidenceInText(end.evidence, checks) ? timeWordIn(end.evidence) : null;
  const vague = vagueStart ?? vagueEnd;

  let startTime: Field<TimeOfDay>;
  let endTime: Field<TimeOfDay>;
  if (vague !== null) {
    const reason = `"${vague.word}" read as ${formatTime(vague.start)}-${formatTime(vague.end)}.`;
    const evidence = start.evidence ?? end.evidence;
    startTime = vagueStart || start.value == null ? assumed(vague.start, evidence, reason) : validateTime(start, checks);
    endTime = vagueEnd || end.value == null ? assumed(vague.end, evidence, reason) : validateTime(end, checks);
  } else {
    startTime = validateTime(start, checks);
    endTime = validateTime(end, checks);
    if (endTime.status === 'missing' && startTime.value !== null) {
      const defaultEnd = minutesSinceMidnight(startTime.value) + DEFAULT_SHIFT_MINUTES;
      if (defaultEnd <= LAST_MINUTE_OF_DAY) {
        endTime = assumed(timeFromMinutes(defaultEnd), null, 'No end time given, so assuming a 5-hour shift.');
      }
    }
  }

  if (startTime.value !== null && endTime.value !== null && endTime.value <= startTime.value) {
    endTime = invalid(
      end.evidence,
      `Ends at ${formatTime(endTime.value)}, not after the ${formatTime(startTime.value)} start. Overnight shifts aren't supported.`,
    );
  }
  return { startTime, endTime };
}

// ---- Booking -----------------------------------------------------------------
export interface ValidationContext {
  sourceText: string;
  now: Date;
  bookingId: string;
  /** Location of the request being replaced, used when "cancel and rebook" names no area. */
  fallbackLocation: LocalityId | null;
}

export type ValidationResult = { ok: true; booking: Booking } | { ok: false; error: string };

const EMPTY_FIELD: RawField = { value: null, evidence: null };
const EMPTY_LINE_ITEM: RawLineItem = {
  role: EMPTY_FIELD,
  subcategory: EMPTY_FIELD,
  count: EMPTY_FIELD,
  dates: EMPTY_FIELD,
  startTime: EMPTY_FIELD,
  endTime: EMPTY_FIELD,
  location: EMPTY_FIELD,
};

function validateLineItem(raw: RawLineItem, id: string, fallbackLocation: LocalityId | null, checks: Checks): LineItem {
  const role = validateRole(raw.role, checks);
  return {
    id,
    role,
    subcategory: validateSubcategory(raw.subcategory, role.value, checks),
    count: validateCount(raw.count, checks),
    dates: validateDates(raw.dates, checks),
    ...validateTimes(raw.startTime, raw.endTime, checks),
    location: validateLocation(raw.location, fallbackLocation, checks),
  };
}

function buildBooking(output: LlmOutput, context: ValidationContext): Booking {
  const checks: Checks = { sourceText: context.sourceText, today: todayInKolkata(context.now) };
  // No line items still means the owner wants someone: ask for everything.
  const rawItems = output.lineItems.length > 0 ? output.lineItems.slice(0, MAX_LINE_ITEMS) : [EMPTY_LINE_ITEM];
  // The LLM's intent is only trusted when the owner actually wrote "cancel".
  const intent = output.intent === 'cancel_and_rebook' && /\bcancel/i.test(context.sourceText) ? 'cancel_and_rebook' : 'new';
  // Only a replacement inherits the old area; a new request with no area is asked.
  const fallbackLocation = intent === 'cancel_and_rebook' ? context.fallbackLocation : null;
  const notes = output.notes?.trim().slice(0, MAX_NOTES_LENGTH) || null;

  return {
    id: context.bookingId,
    sourceText: context.sourceText,
    intent,
    cancelsBookingId: null,
    cancelCheckedByOwner: false,
    lineItems: rawItems.map((item, index) => validateLineItem(item, `${context.bookingId}-${index + 1}`, fallbackLocation, checks)),
    budget: validateBudget(output.budget, checks),
    notes,
    status: 'draft',
    assignments: {},
    createdAt: context.now.toISOString(),
  };
}

export function validateLlmOutput(raw: unknown, context: ValidationContext): ValidationResult {
  const parsed = llmOutputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'The AI reply was not in the expected format.' };
  return { ok: true, booking: buildBooking(parsed.data, context) };
}

/** For "fill it in myself" when the AI fails: one line item where every required field asks. */
export function blankBooking(context: ValidationContext): Booking {
  return buildBooking({ intent: 'new', lineItems: [], budget: EMPTY_FIELD, notes: null }, context);
}

/** For "add another requirement": nothing is copied from the other cards, so nothing is guessed. */
export function blankLineItem(id: string, now: Date): LineItem {
  return validateLineItem(EMPTY_LINE_ITEM, id, null, { sourceText: '', today: todayInKolkata(now) });
}
