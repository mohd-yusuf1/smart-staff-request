// Test 2 of 2: the matching scorer. Uses small hand-made partners instead of
// the seed data, so editing the seed data can't break these rules.
import type { BookedSlot, MatchRequest, Partner } from '../domain/types';
import { rankPartners } from './score';

// Sunday 25 Oct 2026, 11:00-16:00 (5 hours), at Connaught Place.
const REQUEST: MatchRequest = {
  role: 'chef',
  subcategory: 'tandoor',
  dates: ['2026-10-25'],
  startTime: '11:00',
  endTime: '16:00',
  location: 'connaught_place',
  budget: null,
};

function makePartner(overrides: Partial<Partner>): Partner {
  return {
    id: 'p',
    name: 'Test Partner',
    role: 'chef',
    primarySubcategory: 'tandoor',
    secondarySubcategories: [],
    home: 'connaught_place',
    reliability: 4.2,
    dayRateInr: 1500,
    weeklyHours: { sunday: { start: '09:00', end: '22:00' } },
    blockedDates: [],
    ...overrides,
  };
}

function rankedIds(request: MatchRequest, partners: Partner[]): string[] {
  return rankPartners(request, partners).ranked.map((scored) => scored.partner.id);
}

describe('rankPartners', () => {
  describe('hard filters', () => {
    it('ignores other roles and explains every other removal', () => {
      const partners = [
        makePartner({ id: 'ok' }),
        makePartner({ id: 'waiter', role: 'waiter', primarySubcategory: 'waiter' }),
        makePartner({ id: 'chinese', primarySubcategory: 'chinese' }),
        makePartner({ id: 'blocked', blockedDates: ['2026-10-25'] }),
        makePartner({ id: 'day-off', weeklyHours: { monday: { start: '09:00', end: '22:00' } } }),
        makePartner({ id: 'evening', weeklyHours: { sunday: { start: '16:00', end: '23:00' } } }),
        makePartner({ id: 'pricey', dayRateInr: 1600 }),
      ];
      const result = rankPartners({ ...REQUEST, budget: { amountInr: 1500, per: 'day' } }, partners);

      expect(result.ranked.map((scored) => scored.partner.id)).toEqual(['ok']);
      expect(result.excluded.map(({ partner, reason }) => [partner.id, reason])).toEqual([
        ['chinese', 'different_skill'],
        ['blocked', 'not_available'],
        ['day-off', 'not_available'],
        // Ends exactly when the request starts: touching is not overlapping.
        ['evening', 'not_available'],
        ['pricey', 'over_budget'],
      ]);
    });

    it('turns an hourly budget into a daily one for the requested hours', () => {
      // ₹300 an hour for 5 hours is ₹1500 a day; equal to the limit is allowed.
      const hourly = { ...REQUEST, budget: { amountInr: 300, per: 'hour' as const } };
      const partners = [makePartner({ id: 'at-limit' }), makePartner({ id: 'over', dayRateInr: 1501 })];

      expect(rankedIds(hourly, partners)).toEqual(['at-limit']);
    });

    it('keeps every skill of the role when no subcategory was asked for', () => {
      const partners = [makePartner({ id: 'chinese', primarySubcategory: 'chinese' })];
      const [scored] = rankPartners({ ...REQUEST, subcategory: null }, partners).ranked;

      expect(scored.subcategoryMatch).toBe('any');
      expect(scored.components.subcategory).toBe(1);
    });
  });

  describe('score components', () => {
    it('computes each component from the partner and request', () => {
      const partner = makePartner({
        primarySubcategory: 'north_indian',
        secondarySubcategories: ['tandoor'],
        home: 'karol_bagh',
        reliability: 4,
        weeklyHours: { sunday: { start: '13:00', end: '22:00' } },
      });
      const [scored] = rankPartners(REQUEST, [partner]).ranked;

      expect(scored.subcategoryMatch).toBe('secondary');
      expect(scored.components.subcategory).toBe(0.7);
      // Free 13:00-16:00 of 11:00-16:00.
      expect(scored.hoursCovered).toBe(3);
      expect(scored.hoursRequested).toBe(5);
      expect(scored.components.availability).toBeCloseTo(0.6);
      // Karol Bagh to Connaught Place is about 3.4 km; 15 km or more scores 0.
      expect(scored.distanceKm).toBeCloseTo(3.4, 1);
      expect(scored.components.distance).toBeCloseTo(1 - scored.distanceKm / 15);
      // Rating 3 scores 0 and 5 scores 1, so 4 is halfway.
      expect(scored.components.reliability).toBeCloseTo(0.5);
      // 0.35*0.7 + 0.35*0.6 + 0.15*0.773 + 0.15*0.5 = 0.646
      expect(scored.total).toBe(0.65);
    });

    it('caps distance at 0 and rating between 0 and 1', () => {
      const [scored] = rankPartners(REQUEST, [makePartner({ home: 'dwarka', reliability: 2.5 })]).ranked;

      expect(scored.distanceKm).toBeGreaterThan(15);
      expect(scored.components.distance).toBe(0);
      expect(scored.components.reliability).toBe(0);
    });

    it('adds up hours over every requested date', () => {
      // Works Wed and Thu only, so covers 2 of the 3 evenings.
      const evenings = { start: '17:00', end: '23:00' };
      const partner = makePartner({ weeklyHours: { wednesday: evenings, thursday: evenings } });
      const threeDays = {
        ...REQUEST,
        dates: ['2026-10-28', '2026-10-29', '2026-10-30'],
        startTime: '18:00',
        endTime: '23:00',
      };
      const [scored] = rankPartners(threeDays, [partner]).ranked;

      expect(scored.hoursCovered).toBe(10);
      expect(scored.hoursRequested).toBe(15);
    });
  });

  describe('time already booked on other requests', () => {
    const slot = (start: string, end: string, overrides: Partial<BookedSlot> = {}): BookedSlot => ({
      partnerId: 'p',
      date: '2026-10-25',
      start,
      end,
      ...overrides,
    });

    it('removes a partner whose booking clashes with any part of the window', () => {
      // Booked 12:00-16:00 elsewhere; the request is 11:00-16:00.
      const result = rankPartners(REQUEST, [makePartner({})], [slot('12:00', '16:00')]);

      expect(result.ranked).toEqual([]);
      expect(result.excluded.map(({ reason }) => reason)).toEqual(['already_booked']);
    });

    it('keeps a partner whose booking ends when the request starts', () => {
      const [scored] = rankPartners(REQUEST, [makePartner({})], [slot('07:00', '11:00')]).ranked;

      expect(scored.hoursCovered).toBe(5);
    });

    it('rules out only the clashing day of a multi-day request', () => {
      const twoSundays = { ...REQUEST, dates: ['2026-10-25', '2026-11-01'] };
      const [scored] = rankPartners(twoSundays, [makePartner({})], [slot('15:00', '18:00')]).ranked;

      expect(scored.hoursCovered).toBe(5);
      expect(scored.hoursRequested).toBe(10);
    });

    it('ignores bookings on another day or for another partner', () => {
      const booked = [slot('09:00', '17:00', { date: '2026-10-26' }), slot('09:00', '17:00', { partnerId: 'other' })];
      const [scored] = rankPartners(REQUEST, [makePartner({})], booked).ranked;

      expect(scored.hoursCovered).toBe(5);
    });
  });

  describe('ranking', () => {
    it('ranks a full-shift second skill above a part-shift main skill', () => {
      // The case that set the weights: hours matter as much as skill.
      const partners = [
        makePartner({ id: 'main-skill-3h', weeklyHours: { sunday: { start: '13:00', end: '22:00' } } }),
        makePartner({ id: 'second-skill-5h', primarySubcategory: 'north_indian', secondarySubcategories: ['tandoor'] }),
      ];

      expect(rankedIds(REQUEST, partners)).toEqual(['second-skill-5h', 'main-skill-3h']);
    });

    it('breaks a tie on the shown score by higher rating', () => {
      // Ratings 4.20 and 4.24 both give a total of 0.94.
      const partners = [makePartner({ id: 'lower', reliability: 4.2 }), makePartner({ id: 'higher', reliability: 4.24 })];
      const { ranked } = rankPartners(REQUEST, partners);

      expect(ranked.map((scored) => scored.total)).toEqual([0.94, 0.94]);
      expect(ranked.map((scored) => scored.partner.id)).toEqual(['higher', 'lower']);
    });

    it('orders identical partners by id, whatever the input order', () => {
      const partners = [makePartner({ id: 'b' }), makePartner({ id: 'a' })];

      expect(rankedIds(REQUEST, partners)).toEqual(['a', 'b']);
    });
  });

  it('rejects a request with no dates or an end time before the start', () => {
    expect(() => rankPartners({ ...REQUEST, dates: [] }, [])).toThrow(RangeError);
    expect(() => rankPartners({ ...REQUEST, startTime: '16:00', endTime: '11:00' }, [])).toThrow(RangeError);
  });
});
