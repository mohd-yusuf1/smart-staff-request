// The 20 seed partners. Each one is here for a reason, noted beside it, so the
// matching results for the ten test requests can be checked by hand.
// Hours repeat weekly so they never go stale. blockedDates are tied to the
// test week (24-31 Oct 2026) and stop mattering after it.
import { WEEKDAYS, type Weekday } from '../domain/dates';
import type { Partner, TimeOfDay } from '../domain/types';

const MON_TO_SAT: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MON_TO_THU: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday'];
const TUE_TO_SUN: Weekday[] = ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const THU_TO_SUN: Weekday[] = ['thursday', 'friday', 'saturday', 'sunday'];
const SAT_TO_MON: Weekday[] = ['saturday', 'sunday', 'monday'];

function hours(days: readonly Weekday[], start: TimeOfDay, end: TimeOfDay): Partner['weeklyHours'] {
  return Object.fromEntries(days.map((day) => [day, { start, end }]));
}

export const PARTNERS: Partner[] = [
  // Chinese chefs: requests 1 and 6 (Sat 18:00-23:00, Connaught Place).
  {
    id: 'p01',
    name: 'Ravi Kumar',
    role: 'chef',
    primarySubcategory: 'chinese',
    secondarySubcategories: ['north_indian'],
    home: 'karol_bagh',
    reliability: 4.6,
    dayRateInr: 2200,
    weeklyHours: hours(WEEKDAYS, '12:00', '23:00'),
    blockedDates: [],
  },
  {
    // Cheapest chef: one of the few inside the ₹1500 budget of request 8.
    id: 'p02',
    name: 'Amit Sharma',
    role: 'chef',
    primarySubcategory: 'chinese',
    secondarySubcategories: [],
    home: 'paharganj',
    reliability: 4.4,
    dayRateInr: 1400,
    weeklyHours: hours(MON_TO_SAT, '16:00', '23:30'),
    blockedDates: [],
  },
  {
    id: 'p03',
    name: 'Sunil Verma',
    role: 'chef',
    primarySubcategory: 'chinese',
    secondarySubcategories: [],
    home: 'chandni_chowk',
    reliability: 4.7,
    dayRateInr: 2100,
    weeklyHours: hours(THU_TO_SUN, '17:00', '23:00'),
    blockedDates: [],
  },
  {
    // Best rating of all, but in Dwarka, far from CP: tests distance vs rating.
    id: 'p04',
    name: 'Deepak Thapa',
    role: 'chef',
    primarySubcategory: 'chinese',
    secondarySubcategories: [],
    home: 'dwarka',
    reliability: 4.9,
    dayRateInr: 2400,
    weeklyHours: hours(WEEKDAYS, '10:00', '23:00'),
    blockedDates: [],
  },
  // Tandoor: request 2 (Sun 25 Oct, 11:00-16:00, Rajouri Garden).
  {
    // Perfect fit and next door, but blocked on 25 Oct: must be excluded.
    id: 'p05',
    name: 'Harpreet Singh',
    role: 'chef',
    primarySubcategory: 'tandoor',
    secondarySubcategories: ['north_indian'],
    home: 'rajouri_garden',
    reliability: 4.8,
    dayRateInr: 1900,
    weeklyHours: hours(WEEKDAYS, '10:00', '22:00'),
    blockedDates: ['2026-10-25'],
  },
  {
    // Right skill but starts at 13:00: covers only 3 of the 5 hours.
    // Also exactly on the ₹1500 budget of request 8.
    id: 'p06',
    name: 'Mohan Lal',
    role: 'chef',
    primarySubcategory: 'tandoor',
    secondarySubcategories: [],
    home: 'punjabi_bagh',
    reliability: 4.3,
    dayRateInr: 1500,
    weeklyHours: hours(WEEKDAYS, '13:00', '23:00'),
    blockedDates: [],
  },
  // North Indian.
  {
    // Tandoor only as a second skill, but free all 5 hours of request 2:
    // tests a weaker skill match against p06's partial hours.
    id: 'p07',
    name: 'Gurmeet Kaur',
    role: 'chef',
    primarySubcategory: 'north_indian',
    secondarySubcategories: ['tandoor'],
    home: 'janakpuri',
    reliability: 4.5,
    dayRateInr: 1700,
    weeklyHours: hours(WEEKDAYS, '09:00', '17:00'),
    blockedDates: [],
  },
  {
    // Request 8: closest and best-rated chef to Lajpat Nagar, but over the
    // ₹1500 budget, so the budget filter must remove this partner.
    id: 'p08',
    name: 'Vikram Malhotra',
    role: 'chef',
    primarySubcategory: 'north_indian',
    secondarySubcategories: [],
    home: 'lajpat_nagar',
    reliability: 4.9,
    dayRateInr: 1800,
    weeklyHours: hours(WEEKDAYS, '10:00', '22:00'),
    blockedDates: [],
  },
  // Pastry: request 10 (Fri 30 Oct).
  {
    id: 'p09',
    name: 'Anjali Mehta',
    role: 'chef',
    primarySubcategory: 'pastry',
    secondarySubcategories: [],
    home: 'green_park',
    reliability: 4.7,
    dayRateInr: 2000,
    weeklyHours: hours(TUE_TO_SUN, '08:00', '18:00'),
    blockedDates: [],
  },
  {
    // Works weekends and is inside the ₹1500 budget, so request 8 has more
    // than one chef left after the budget filter.
    id: 'p10',
    name: 'Rohit Das',
    role: 'chef',
    primarySubcategory: 'pastry',
    secondarySubcategories: [],
    home: 'laxmi_nagar',
    reliability: 4.2,
    dayRateInr: 1300,
    weeklyHours: hours(WEEKDAYS, '09:00', '20:00'),
    blockedDates: [],
  },
  // Kitchen helpers: request 1 (Sat 18:00-23:00, CP).
  {
    id: 'p11',
    name: 'Raju Prasad',
    role: 'helper',
    primarySubcategory: 'kitchen_helper',
    secondarySubcategories: [],
    home: 'karol_bagh',
    reliability: 4.1,
    dayRateInr: 800,
    weeklyHours: hours(WEEKDAYS, '10:00', '23:30'),
    blockedDates: [],
  },
  {
    id: 'p12',
    name: 'Sanjay Yadav',
    role: 'helper',
    primarySubcategory: 'kitchen_helper',
    secondarySubcategories: [],
    home: 'paharganj',
    reliability: 4.5,
    dayRateInr: 900,
    weeklyHours: hours(THU_TO_SUN, '16:00', '23:30'),
    blockedDates: [],
  },
  {
    // Day shifts only: no overlap with a Saturday evening, so filtered out.
    id: 'p13',
    name: 'Pooja Rawat',
    role: 'helper',
    primarySubcategory: 'kitchen_helper',
    secondarySubcategories: [],
    home: 'saket',
    reliability: 4.6,
    dayRateInr: 850,
    weeklyHours: hours(MON_TO_SAT, '08:00', '16:00'),
    blockedDates: [],
  },
  // Cleaners: request 3 (deep cleaning x3, Sun 25 Oct morning, Pitampura)
  // and request 9 (cleaner Sunday, Saket).
  {
    id: 'p14',
    name: 'Meena Devi',
    role: 'cleaner',
    primarySubcategory: 'deep_cleaning',
    secondarySubcategories: ['general_cleaning'],
    home: 'pitampura',
    reliability: 4.8,
    dayRateInr: 1200,
    weeklyHours: hours(WEEKDAYS, '07:00', '15:00'),
    blockedDates: [],
  },
  {
    id: 'p15',
    name: 'Rakesh Gupta',
    role: 'cleaner',
    primarySubcategory: 'deep_cleaning',
    secondarySubcategories: [],
    home: 'rohini',
    reliability: 4.4,
    dayRateInr: 1100,
    weeklyHours: hours(SAT_TO_MON, '06:00', '14:00'),
    blockedDates: [],
  },
  {
    id: 'p16',
    name: 'Salim Khan',
    role: 'cleaner',
    primarySubcategory: 'deep_cleaning',
    secondarySubcategories: [],
    home: 'model_town',
    reliability: 4.6,
    dayRateInr: 1300,
    weeklyHours: hours(WEEKDAYS, '08:00', '20:00'),
    blockedDates: [],
  },
  {
    // General cleaning only: right role, different speciality for request 3.
    id: 'p17',
    name: 'Kavita Joshi',
    role: 'cleaner',
    primarySubcategory: 'general_cleaning',
    secondarySubcategories: [],
    home: 'saket',
    reliability: 4.3,
    dayRateInr: 900,
    weeklyHours: hours(WEEKDAYS, '09:00', '18:00'),
    blockedDates: [],
  },
  // Waiters: request 4 (28-30 Oct, Wed-Fri, from 18:00, Karol Bagh).
  {
    id: 'p18',
    name: 'Arjun Nair',
    role: 'waiter',
    primarySubcategory: 'waiter',
    secondarySubcategories: [],
    home: 'karol_bagh',
    reliability: 4.5,
    dayRateInr: 1000,
    weeklyHours: hours(WEEKDAYS, '17:00', '23:30'),
    blockedDates: [],
  },
  {
    // Works Mon-Thu: free 28 and 29 Oct but not Fri 30 Oct (2 of 3 days).
    id: 'p19',
    name: 'Faizan Ali',
    role: 'waiter',
    primarySubcategory: 'waiter',
    secondarySubcategories: [],
    home: 'rajouri_garden',
    reliability: 4.7,
    dayRateInr: 1100,
    weeklyHours: hours(MON_TO_THU, '17:00', '23:00'),
    blockedDates: [],
  },
  {
    // Day off on 29 Oct: also 2 of 3 days.
    id: 'p20',
    name: 'Neha Bisht',
    role: 'waiter',
    primarySubcategory: 'waiter',
    secondarySubcategories: [],
    home: 'connaught_place',
    reliability: 4.2,
    dayRateInr: 950,
    weeklyHours: hours(WEEKDAYS, '18:00', '23:00'),
    blockedDates: ['2026-10-29'],
  },
];
