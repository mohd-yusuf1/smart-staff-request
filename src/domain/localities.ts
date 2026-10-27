// The Delhi areas the app can book for, each with one approximate centre
// point. There is no geocoding API (no backend), so a place outside this
// table is reported as unknown and the owner picks one from the list.

export interface LatLng {
  lat: number;
  lng: number;
}

interface Locality extends LatLng {
  name: string;
}

// Centre points are approximate (about 4 decimals). A large area like Dwarka
// or Rohini is still a single point, so distances to it can be off by a few km.
export const LOCALITIES = {
  // Central
  connaught_place: { name: 'Connaught Place', lat: 28.6315, lng: 77.2167 },
  karol_bagh: { name: 'Karol Bagh', lat: 28.6514, lng: 77.1907 },
  paharganj: { name: 'Paharganj', lat: 28.6449, lng: 77.2124 },
  chandni_chowk: { name: 'Chandni Chowk', lat: 28.6506, lng: 77.2303 },
  khan_market: { name: 'Khan Market', lat: 28.6003, lng: 77.227 },
  // West
  rajouri_garden: { name: 'Rajouri Garden', lat: 28.6492, lng: 77.122 },
  punjabi_bagh: { name: 'Punjabi Bagh', lat: 28.6683, lng: 77.1311 },
  janakpuri: { name: 'Janakpuri', lat: 28.6219, lng: 77.0878 },
  dwarka: { name: 'Dwarka', lat: 28.5921, lng: 77.046 },
  // North
  pitampura: { name: 'Pitampura', lat: 28.699, lng: 77.136 },
  kohat_enclave: { name: 'Kohat Enclave', lat: 28.6981, lng: 77.1404 },
  rohini: { name: 'Rohini', lat: 28.732, lng: 77.11 },
  model_town: { name: 'Model Town', lat: 28.716, lng: 77.19 },
  civil_lines: { name: 'Civil Lines', lat: 28.6814, lng: 77.2226 },
  // South
  hauz_khas: { name: 'Hauz Khas', lat: 28.5494, lng: 77.2001 },
  green_park: { name: 'Green Park', lat: 28.5596, lng: 77.2068 },
  saket: { name: 'Saket', lat: 28.5245, lng: 77.2066 },
  malviya_nagar: { name: 'Malviya Nagar', lat: 28.5335, lng: 77.2109 },
  vasant_kunj: { name: 'Vasant Kunj', lat: 28.5207, lng: 77.1585 },
  lajpat_nagar: { name: 'Lajpat Nagar', lat: 28.5677, lng: 77.2433 },
  defence_colony: { name: 'Defence Colony', lat: 28.573, lng: 77.232 },
  greater_kailash: { name: 'Greater Kailash', lat: 28.5482, lng: 77.238 },
  nehru_place: { name: 'Nehru Place', lat: 28.5491, lng: 77.2533 },
  kalkaji: { name: 'Kalkaji', lat: 28.5393, lng: 77.259 },
  // East
  mayur_vihar: { name: 'Mayur Vihar', lat: 28.6046, lng: 77.2943 },
  preet_vihar: { name: 'Preet Vihar', lat: 28.6417, lng: 77.295 },
  laxmi_nagar: { name: 'Laxmi Nagar', lat: 28.6304, lng: 77.2773 },
} as const satisfies Record<string, Locality>;

export type LocalityId = keyof typeof LOCALITIES;

// Sorted by name for the locality picker on the review screen.
export const LOCALITY_IDS = (Object.keys(LOCALITIES) as LocalityId[]).sort((a, b) =>
  LOCALITIES[a].name.localeCompare(LOCALITIES[b].name),
);

// Words owners put around a place name: "Connaught Place area", "Pitampura outlet".
const FILLER_WORDS = /\b(area|outlet|branch)\b/g;

// Letters and digits only, so "Karol Bagh", "Karolbagh", "karol-bagh" and the
// id "karol_bagh" all become "karolbagh".
function toCompactKey(raw: string): string {
  return raw.toLowerCase().replace(FILLER_WORDS, '').replace(/[^a-z0-9]/g, '');
}

// Maps rather than plain objects: these lookups run on untrusted LLM output,
// and a plain object would also match inherited names like "constructor".
const ID_BY_KEY = new Map<string, LocalityId>(
  (Object.keys(LOCALITIES) as LocalityId[]).map((id) => [toCompactKey(id), id]),
);

// Same rule as the taxonomy aliases: only names that mean exactly one place.
const ALIAS_BY_KEY = new Map<string, LocalityId>([
  ['cp', 'connaught_place'],
  ['rajivchowk', 'connaught_place'],
  ['gk', 'greater_kailash'],
  // GK-1 and GK-2 are separate neighbourhoods; one point is close enough to rank partners.
  ['gk1', 'greater_kailash'],
  ['gk2', 'greater_kailash'],
  ['greaterkailash1', 'greater_kailash'],
  ['greaterkailash2', 'greater_kailash'],
  ['hkv', 'hauz_khas'],
  ['hauzkhasvillage', 'hauz_khas'],
]);

export function normalizeLocality(raw: string): LocalityId | null {
  const key = toCompactKey(raw);
  return ID_BY_KEY.get(key) ?? ALIAS_BY_KEY.get(key) ?? null;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Straight-line (haversine) distance. Real travel is longer by road; the
 * scorer only uses this to compare partners, not to promise a travel time.
 */
export function distanceKm(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
