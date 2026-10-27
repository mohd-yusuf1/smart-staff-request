// Single source of truth for what staff the app can book. The Role and
// Subcategory types, the LLM prompt and the validator all derive from this,
// so adding a subcategory here is the only change needed to support it.
export const TAXONOMY = {
  chef: ['chinese', 'tandoor', 'north_indian', 'pastry'],
  helper: ['kitchen_helper'],
  cleaner: ['deep_cleaning', 'general_cleaning'],
  waiter: ['waiter'],
} as const;

export type Role = keyof typeof TAXONOMY;
export type Subcategory = (typeof TAXONOMY)[Role][number];

export const ROLES = Object.keys(TAXONOMY) as Role[];

export const ROLE_LABELS: Record<Role, string> = {
  chef: 'Chef',
  helper: 'Helper',
  cleaner: 'Cleaner',
  waiter: 'Waiter',
};

export const SUBCATEGORY_LABELS: Record<Subcategory, string> = {
  chinese: 'Chinese',
  tandoor: 'Tandoor',
  north_indian: 'North Indian',
  pastry: 'Pastry',
  kitchen_helper: 'Kitchen helper',
  deep_cleaning: 'Deep cleaning',
  general_cleaning: 'General cleaning',
  waiter: 'Waiter',
};

/**
 * What to call one person with this skill. Not "skill + role": that gives
 * "Kitchen helper helper" and "Waiter waiter".
 */
export const SUBCATEGORY_STAFF_LABELS: Record<Subcategory, string> = {
  chinese: 'Chinese chef',
  tandoor: 'Tandoor chef',
  north_indian: 'North Indian chef',
  pastry: 'Pastry chef',
  kitchen_helper: 'Kitchen helper',
  deep_cleaning: 'Deep cleaner',
  general_cleaning: 'General cleaner',
  waiter: 'Waiter',
};

// Words owners actually use that are not our canonical names. Kept small on
// purpose: an alias only belongs here if it can mean exactly one thing.
const ROLE_ALIASES: Record<string, Role> = {
  cook: 'chef',
  server: 'waiter',
  steward: 'waiter',
  cleaning: 'cleaner',
  housekeeping: 'cleaner',
  kitchen_helper: 'helper',
};

const SUBCATEGORY_ALIASES: Record<string, Subcategory> = {
  baker: 'pastry',
  bakery: 'pastry',
  tandoori: 'tandoor',
  deep_clean: 'deep_cleaning',
};

export function subcategoriesOf(role: Role): readonly Subcategory[] {
  return TAXONOMY[role];
}

export function isSubcategoryOfRole(subcategory: Subcategory, role: Role): boolean {
  return subcategoriesOf(role).includes(subcategory);
}

// Own keys only: `in` would also accept inherited names like "constructor",
// and these lookups run on untrusted LLM output.
function lookup<T>(table: Record<string, T>, key: string): T | null {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
}

// "Kitchen Helpers" -> "kitchen_helper": lowercase, underscores, singular.
function toKey(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return key.endsWith('s') ? key.slice(0, -1) : key;
}

export function normalizeRole(raw: string): Role | null {
  const key = toKey(raw);
  if (lookup(TAXONOMY, key)) return key as Role;
  return lookup(ROLE_ALIASES, key);
}

export function normalizeSubcategory(raw: string): Subcategory | null {
  const key = toKey(raw);
  if (lookup(SUBCATEGORY_LABELS, key)) return key as Subcategory;
  return lookup(SUBCATEGORY_ALIASES, key);
}
