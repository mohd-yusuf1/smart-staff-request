// One-line explanations built only from the scorer's numbers (never from the
// LLM), so every claim in a line can be traced to a score component.
import { SUBCATEGORY_LABELS, type Subcategory } from '../domain/taxonomy';
import type {
  ExcludedPartner,
  ExclusionReason,
  ScoreComponents,
  ScoredPartner,
} from '../domain/types';
import { WEIGHTS } from './score';

type Component = keyof ScoreComponents;

// "5" or "2.5": no trailing ".0" on whole hours.
function formatHourCount(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function formatHours(hours: number): string {
  return `${formatHourCount(hours)} h`;
}

function formatKm(km: number): string {
  return `${km.toFixed(1)} km`;
}

function skillFact(scored: ScoredPartner, requested: Subcategory | null): string {
  if (scored.subcategoryMatch === 'any' || requested === null) {
    return `${SUBCATEGORY_LABELS[scored.partner.primarySubcategory]} (any skill accepted)`;
  }
  const kind = scored.subcategoryMatch === 'primary' ? 'main skill' : 'second skill';
  return `${SUBCATEGORY_LABELS[requested]} (${kind})`;
}

function hoursFact(scored: ScoredPartner): string {
  return scored.hoursCovered === scored.hoursRequested
    ? `free all ${formatHours(scored.hoursRequested)}`
    : `free ${formatHourCount(scored.hoursCovered)} of ${formatHours(scored.hoursRequested)}`;
}

function facts(scored: ScoredPartner, requested: Subcategory | null): string {
  return [
    skillFact(scored, requested),
    hoursFact(scored),
    formatKm(scored.distanceKm),
    `rating ${scored.partner.reliability}`,
  ].join(', ');
}

// How `a` compares with `b` on one component, in the owner's words.
function advantage(component: Component, a: ScoredPartner, b: ScoredPartner): string {
  switch (component) {
    case 'subcategory':
      return 'has it as main skill, not second';
    case 'availability':
      return `free ${formatHours(a.hoursCovered - b.hoursCovered)} more`;
    case 'distance':
      return `${formatKm(b.distanceKm - a.distanceKm)} closer`;
    case 'reliability':
      return `rated ${(a.partner.reliability - b.partner.reliability).toFixed(1)} higher`;
  }
}

function disadvantage(component: Component, a: ScoredPartner, b: ScoredPartner): string {
  switch (component) {
    case 'subcategory':
      return 'only a second skill';
    case 'availability':
      return `free ${formatHours(b.hoursCovered - a.hoursCovered)} less`;
    case 'distance':
      return `${formatKm(a.distanceKm - b.distanceKm)} farther`;
    case 'reliability':
      return `rated ${(b.partner.reliability - a.partner.reliability).toFixed(1)} lower`;
  }
}

// Each component's effect on the total: weight times the difference.
function weightedGaps(a: ScoredPartner, b: ScoredPartner): [Component, number][] {
  const components = Object.keys(WEIGHTS) as Component[];
  return components.map((c) => [c, WEIGHTS[c] * (a.components[c] - b.components[c])]);
}

// Same order as compareScored in score.ts: rating, then distance, then id.
function tieBreak(a: ScoredPartner, b: ScoredPartner): string {
  if (a.partner.reliability !== b.partner.reliability) {
    return `higher rating (${a.partner.reliability} vs ${b.partner.reliability})`;
  }
  if (a.distanceKm !== b.distanceKm) {
    return `closer (${formatKm(a.distanceKm)} vs ${formatKm(b.distanceKm)})`;
  }
  return 'partner id, as they are equal on every measure';
}

/** Why `a` is ranked directly above `b`. */
function comparison(a: ScoredPartner, b: ScoredPartner, belowRank: number): string {
  if (a.total === b.total) {
    return `Tied with #${belowRank} at ${a.total.toFixed(2)}; listed first for ${tieBreak(a, b)}.`;
  }
  const gaps = weightedGaps(a, b);
  const [bestFor] = gaps.reduce((best, gap) => (gap[1] > best[1] ? gap : best));
  const [worstFor, worstGap] = gaps.reduce((worst, gap) => (gap[1] < worst[1] ? gap : worst));
  const although = worstGap < 0 ? `, although ${disadvantage(worstFor, a, b)}` : '';
  return `Above #${belowRank}: ${advantage(bestFor, a, b)}${although}.`;
}

/**
 * One line per partner, in the given order. Pass only the partners that are
 * shown (the top 5), so the last line never compares with a hidden partner.
 */
export function explainRanking(shown: ScoredPartner[], requested: Subcategory | null): string[] {
  return shown.map((scored, index) => {
    const rank = index + 1;
    const line = `#${rank} · ${scored.total.toFixed(2)}: ${facts(scored, requested)}.`;
    const next = shown[index + 1];
    return next ? `${line} ${comparison(scored, next, rank + 1)}` : line;
  });
}

export interface BreakdownRow {
  label: string;
  /** The component, 0 to 1. */
  value: number;
  weight: number;
  /** value × weight: this component's share of the total. */
  points: number;
}

const COMPONENT_LABELS: Record<Component, string> = {
  subcategory: 'Skill',
  availability: 'Hours free',
  distance: 'Distance',
  reliability: 'Rating',
};

/** The sum behind a partner's total, one row per component, for the tap-to-open breakdown. */
export function scoreBreakdown(scored: ScoredPartner): BreakdownRow[] {
  const components = Object.keys(WEIGHTS) as Component[];
  return components.map((c) => ({
    label: COMPONENT_LABELS[c],
    value: scored.components[c],
    weight: WEIGHTS[c],
    points: WEIGHTS[c] * scored.components[c],
  }));
}

const EXCLUSION_ORDER: ExclusionReason[] = ['not_available', 'already_booked', 'over_budget', 'different_skill'];

const EXCLUSION_PHRASES: Record<ExclusionReason, string> = {
  not_available: 'not free at that time',
  already_booked: 'already booked at that time',
  over_budget: 'over budget',
  different_skill: 'with a different skill',
};

/** "Not shown: 2 not free at that time, 6 over budget." Null when nobody was removed. */
export function explainExclusions(excluded: ExcludedPartner[]): string | null {
  const parts = EXCLUSION_ORDER.map((reason) => {
    const count = excluded.filter((item) => item.reason === reason).length;
    return count > 0 ? `${count} ${EXCLUSION_PHRASES[reason]}` : null;
  }).filter((part) => part !== null);
  return parts.length > 0 ? `Not shown: ${parts.join(', ')}.` : null;
}
