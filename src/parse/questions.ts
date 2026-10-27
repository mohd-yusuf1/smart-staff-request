// One-tap answers for each row, built from our own tables, never by the LLM.
// An answer is written straight into the booking (no re-parse), so fields
// that were already right can't change.
import { addDays, formatShortDate, formatTime } from '../domain/dates';
import { LOCALITIES, LOCALITY_IDS, normalizeLocality, type LocalityId } from '../domain/localities';
import { ROLE_LABELS, ROLES, SUBCATEGORY_LABELS, subcategoriesOf, type Role, type Subcategory } from '../domain/taxonomy';
import type { IsoDate, LineItem, TimeOfDay } from '../domain/types';
import { formatDates, type RowKey } from './review';
import { TIME_WORDS } from './validate';

export interface Choice<T> {
  label: string;
  value: T;
}

export interface TimeWindow {
  start: TimeOfDay;
  end: TimeOfDay;
}

const QUICK_DAYS = 7;
const MAX_LOCATION_CHOICES = 12;

export const QUESTIONS: Record<RowKey, string> = {
  role: 'What kind of staff do you need?',
  subcategory: 'Which skill?',
  count: 'How many people?',
  dates: 'Which day?',
  time: 'What time?',
  location: 'Which area?',
};

export function roleChoices(): Choice<Role>[] {
  return ROLES.map((role) => ({ label: ROLE_LABELS[role], value: role }));
}

/** Null value means any skill of the role. */
export function subcategoryChoices(role: Role | null): Choice<Subcategory | null>[] {
  if (role === null) return [];
  const skills = subcategoriesOf(role).map((skill) => ({ label: SUBCATEGORY_LABELS[skill], value: skill }));
  return skills.length > 1 ? [{ label: 'Any', value: null }, ...skills] : skills;
}

/** The validator's alternatives first, then the next seven days. */
export function dateChoices(item: LineItem, today: IsoDate): Choice<IsoDate[]>[] {
  const quickDays = Array.from({ length: QUICK_DAYS }, (_, i) => [addDays(today, i)]);
  const choices = [...item.dates.alternatives, ...quickDays].map((dates, i) => ({
    label: i >= item.dates.alternatives.length && dates[0] === today ? `Today ${formatShortDate(today)}` : formatDates(dates),
    value: dates,
  }));
  const seen = new Set<string>();
  return choices.filter((choice) => {
    const key = choice.value.join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** The same conventions the validator uses for "evening" etc.; duplicates removed. */
export function timeChoices(): Choice<TimeWindow>[] {
  const seen = new Set<string>();
  return Object.entries(TIME_WORDS)
    .filter(([, window]) => {
      const key = `${window.start}-${window.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(([word, window]) => ({
      label: `${capitalize(word)} ${formatTime(window.start)}–${formatTime(window.end)}`,
      value: window,
    }));
}

/** Areas whose name contains the query, plus an alias match like "CP". */
export function locationChoices(query: string): Choice<LocalityId>[] {
  const needle = query.trim().toLowerCase();
  const alias = needle ? normalizeLocality(needle) : null;
  const matches = LOCALITY_IDS.filter((id) => LOCALITIES[id].name.toLowerCase().includes(needle));
  const ids = alias && !matches.includes(alias) ? [alias, ...matches] : matches;
  return ids.slice(0, MAX_LOCATION_CHOICES).map((id) => ({ label: LOCALITIES[id].name, value: id }));
}
