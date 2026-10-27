// Test 1 of 2: the parse-output validator. The LLM replies here are written by
// hand, including wrong and broken ones, because the point is what our code
// does with untrusted output, not what the LLM happens to return today.
import type { Booking, LineItem } from '../domain/types';
import { blankBooking, validateLlmOutput, type ValidationContext } from './validate';

// Saturday 24 Oct 2026, 11:30 AM in India.
const NOW = new Date('2026-10-24T06:00:00Z');

type FieldName = 'role' | 'subcategory' | 'count' | 'dates' | 'startTime' | 'endTime' | 'location';
type RawItem = Partial<Record<FieldName, unknown>>;

/** One LLM field: the value and the exact words it came from. */
function f(value: unknown, evidence: string | null = null) {
  return { value, evidence };
}

function context(sourceText: string, overrides: Partial<ValidationContext> = {}): ValidationContext {
  return { sourceText, now: NOW, bookingId: 'b1', fallbackLocation: null, ...overrides };
}

function llmReply(lineItems: RawItem[], extra: Record<string, unknown> = {}) {
  return { intent: 'new', lineItems, budget: f(null), notes: null, ...extra };
}

function validate(sourceText: string, reply: unknown, overrides: Partial<ValidationContext> = {}): Booking {
  const result = validateLlmOutput(reply, context(sourceText, overrides));
  if (!result.ok) throw new Error(result.error);
  return result.booking;
}

function statuses(item: LineItem): Record<FieldName, string> {
  return {
    role: item.role.status,
    subcategory: item.subcategory.status,
    count: item.count.status,
    dates: item.dates.status,
    startTime: item.startTime.status,
    endTime: item.endTime.status,
    location: item.location.status,
  };
}

const ALL_OK: Record<FieldName, string> = {
  role: 'ok',
  subcategory: 'ok',
  count: 'ok',
  dates: 'ok',
  startTime: 'ok',
  endTime: 'ok',
  location: 'ok',
};

describe('validateLlmOutput on the assignment requests', () => {
  it('request 1: splits two roles, and flags "Saturday" said on a Saturday', () => {
    const text = 'Need 2 Chinese chefs and 1 helper for Saturday 6 PM to 11 PM, Connaught Place area.';
    const shared = {
      dates: f(['2026-10-24'], 'Saturday'),
      startTime: f('18:00', '6 PM'),
      endTime: f('23:00', '11 PM'),
      location: f('Connaught Place', 'Connaught Place'),
    };
    const booking = validate(text, llmReply([
      { role: f('chef', 'chefs'), subcategory: f('chinese', 'Chinese'), count: f(2, '2'), ...shared },
      // As the real LLM sent it on 26 Oct: the only helper skill, with no evidence.
      { role: f('helper', 'helper'), subcategory: f('kitchen_helper'), count: f(1, '1'), ...shared },
    ]));
    const [chefs, helper] = booking.lineItems;

    expect(statuses(chefs)).toEqual({ ...ALL_OK, dates: 'assumed' });
    expect(chefs.dates.value).toEqual(['2026-10-24']);
    expect(chefs.dates.alternatives).toEqual([['2026-10-31']]);
    expect(chefs.location.value).toBe('connaught_place');
    // A helper has only one skill, so nothing is guessed.
    expect(helper.subcategory).toMatchObject({ status: 'ok', value: 'kitchen_helper' });
  });

  it('request 2: a clear request comes out all ok', () => {
    const text = '1 tandoor chef, 25th October, 11am-4pm, Rajouri Garden.';
    const booking = validate(text, llmReply([{
      role: f('chef', 'chef'),
      subcategory: f('tandoor', 'tandoor'),
      count: f(1, '1'),
      dates: f(['2026-10-25'], '25th October'),
      startTime: f('11:00', '11am'),
      endTime: f('16:00', '4pm'),
      location: f('Rajouri Garden', 'Rajouri Garden'),
    }]));

    expect(statuses(booking.lineItems[0])).toEqual(ALL_OK);
  });

  it('request 3: "morning" is filled in as 8 AM-12 PM but marked assumed', () => {
    const text = 'Deep cleaning crew of 3 for Sunday morning, Pitampura outlet.';
    const [item] = validate(text, llmReply([{
      role: f('cleaner', 'Deep cleaning crew'),
      subcategory: f('deep_cleaning', 'Deep cleaning'),
      count: f(3, 'crew of 3'),
      dates: f(['2026-10-25'], 'Sunday'),
      startTime: f('09:00', 'morning'),
      endTime: f(null),
      location: f('Pitampura', 'Pitampura outlet'),
    }])).lineItems;

    expect(statuses(item)).toEqual({ ...ALL_OK, startTime: 'assumed', endTime: 'assumed' });
    expect([item.startTime.value, item.endTime.value]).toEqual(['08:00', '12:00']);
    expect(item.startTime.reason).toContain('morning');
  });

  it('request 4: Hinglish range is ok, and a missing end time gets a 5-hour default', () => {
    const text = 'Waiter, 3 din ke liye, 28 se 30 October, shaam 6 baje se, Karol Bagh.';
    const [item] = validate(text, llmReply([{
      role: f('waiter', 'Waiter'),
      count: f(1),
      dates: f(['2026-10-28', '2026-10-29', '2026-10-30'], '28 se 30 October'),
      startTime: f('18:00', 'shaam 6 baje'),
      endTime: f(null),
      location: f('Karol Bagh', 'Karol Bagh'),
    }])).lineItems;

    expect(item.dates).toMatchObject({ status: 'ok', value: ['2026-10-28', '2026-10-29', '2026-10-30'] });
    expect(item.startTime).toMatchObject({ status: 'ok', value: '18:00' });
    expect(item.endTime).toMatchObject({ status: 'assumed', value: '23:00' });
    // Count 1 with no evidence is the LLM's claim, not the owner's words.
    expect(item.count).toMatchObject({ status: 'assumed', value: 1 });
  });

  it('request 5: asks for role and area instead of guessing', () => {
    const text = 'Need someone for tomorrow evening.';
    const [item] = validate(text, llmReply([{
      role: f(null, 'someone'),
      count: f(1, 'someone'),
      dates: f(['2026-10-25'], 'tomorrow'),
      startTime: f('18:00', 'evening'),
      endTime: f('23:00', 'evening'),
      location: f(null),
    }])).lineItems;

    expect(statuses(item)).toEqual({
      role: 'missing',
      subcategory: 'ok',
      count: 'ok',
      dates: 'ok',
      startTime: 'assumed',
      endTime: 'assumed',
      location: 'missing',
    });
    expect(item.dates.value).toEqual(['2026-10-25']);
  });

  it('request 7: "next week" is not a date, so it is asked; no cuisine means any chef', () => {
    const text = 'Chef for party next week';
    const booking = validate(text, llmReply(
      [{ role: f('chef', 'Chef'), subcategory: f(null), dates: f(['2026-10-26'], 'next week') }],
      // The real LLM wrapped notes like a field on 26 Oct; the text is kept.
      { notes: { value: 'party', evidence: 'party' } },
    ));
    const [item] = booking.lineItems;

    expect(item.dates).toMatchObject({ status: 'missing', value: null });
    expect(item.subcategory).toMatchObject({ status: 'assumed', value: null });
    expect(booking.notes).toBe('party');
  });

  it('request 8: "cook" is a chef, budget is read, "this weekend" offers one-tap choices', () => {
    const text = 'Need a cook, budget max 1500 per day, Lajpat Nagar, this weekend';
    const booking = validate(text, llmReply(
      [{
        role: f('cook', 'cook'),
        count: f(1, 'a cook'),
        dates: f(['2026-10-24', '2026-10-25'], 'this weekend'),
        location: f('Lajpat Nagar', 'Lajpat Nagar'),
      }],
      { budget: f({ amountInr: 1500, per: 'day' }, 'budget max 1500 per day') },
    ));
    const [item] = booking.lineItems;

    expect(item.role).toMatchObject({ status: 'ok', value: 'chef' });
    expect(booking.budget).toMatchObject({ status: 'ok', value: { amountInr: 1500, per: 'day' } });
    expect(item.dates).toMatchObject({ status: 'missing', value: null });
    expect(item.dates.alternatives).toEqual([['2026-10-24'], ['2026-10-25'], ['2026-10-24', '2026-10-25']]);
  });

  it('request 10: cancel-and-rebook takes the area from the request it replaces', () => {
    const text = 'Cancel my last request and book a pastry chef instead for Friday.';
    const booking = validate(
      text,
      llmReply(
        [{ role: f('chef', 'pastry chef'), subcategory: f('pastry', 'pastry'), count: f(1, 'a pastry chef'), dates: f(['2026-10-30'], 'Friday') }],
        { intent: 'cancel_and_rebook' },
      ),
      { fallbackLocation: 'saket' },
    );
    const [item] = booking.lineItems;

    expect(booking.intent).toBe('cancel_and_rebook');
    expect(item.dates).toMatchObject({ status: 'ok', value: ['2026-10-30'] });
    expect(item.location).toMatchObject({ status: 'assumed', value: 'saket' });
    expect(item.startTime.status).toBe('missing');
  });
});

describe('validateLlmOutput with wrong or broken LLM output', () => {
  it('marks a value assumed when its evidence is not in the owner text', () => {
    const [item] = validate('Need someone tomorrow', llmReply([{ role: f('chef', 'tandoor chef') }])).lineItems;

    expect(item.role).toMatchObject({ status: 'assumed', value: 'chef' });
    expect(item.role.reason).toMatch(/not in your text/i);
  });

  it('corrects a weekday the LLM resolved to the wrong date', () => {
    const [item] = validate('Pastry chef for Friday', llmReply([{ dates: f(['2026-10-23'], 'Friday') }])).lineItems;

    expect(item.dates).toMatchObject({ status: 'assumed', value: ['2026-10-30'] });
    expect(item.dates.reason).toContain('Corrected');
  });

  it('fixes a stale year but rejects a date that has really passed', () => {
    const staleYear = validate('chef on 25th October', llmReply([{ dates: f(['2025-10-25'], '25th October') }]));
    // Wrong year as well: 20 Oct 2025 was a Monday, 20 Oct 2026 a Tuesday.
    const passed = validate('chef on 20th October', llmReply([{ dates: f(['2025-10-20'], '20th October') }]));

    expect(staleYear.lineItems[0].dates).toMatchObject({ status: 'assumed', value: ['2026-10-25'] });
    expect(passed.lineItems[0].dates).toMatchObject({ status: 'invalid', value: null });
    expect(passed.lineItems[0].dates.reason).toBe('Tue 20 Oct has already passed.');
  });

  it('reads AM/PM from the owner text over the LLM time', () => {
    const [item] = validate('chef from 6 PM', llmReply([{ startTime: f('06:00', '6 PM') }])).lineItems;

    expect(item.startTime).toMatchObject({ status: 'assumed', value: '18:00' });
  });

  it('rejects an end time that is not after the start', () => {
    const [item] = validate('chef 6 PM to 4 PM', llmReply([{ startTime: f('18:00', '6 PM'), endTime: f('16:00', '4 PM') }])).lineItems;

    expect(item.endTime).toMatchObject({ status: 'invalid', value: null });
  });

  it('marks unknown or impossible values invalid instead of passing them on', () => {
    const text = 'Need 0 plumbers in Gurgaon';
    const [plumber] = validate(text, llmReply([{ role: f('plumber', 'plumbers'), count: f(0, '0'), location: f('Gurgaon', 'Gurgaon') }])).lineItems;
    const [cleaner] = validate('pastry cleaner', llmReply([{ role: f('cleaner', 'cleaner'), subcategory: f('pastry', 'pastry') }])).lineItems;

    expect(plumber.role.status).toBe('invalid');
    expect(plumber.count.status).toBe('invalid');
    expect(plumber.location.status).toBe('invalid');
    expect(cleaner.subcategory.status).toBe('invalid');
  });

  it('rejects bookings longer than 7 days', () => {
    const dates = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'];
    const [item] = validate('waiter for 8 days', llmReply([{ dates: f(dates, '8 days') }])).lineItems;

    expect(item.dates.status).toBe('invalid');
  });

  it('turns badly typed fields into questions instead of failing the parse', () => {
    const [item] = validate('Need a chef tomorrow', llmReply([{
      role: f(42, 'chef'),
      count: f('two', 'a'),
      dates: f('tomorrow'),
      location: 'Saket',
    }])).lineItems;

    expect(item.role.status).toBe('invalid');
    expect(item.count.status).toBe('invalid');
    expect(item.dates.status).toBe('missing');
    expect(item.location.status).toBe('missing');
  });

  it('ignores a cancel intent when the owner never wrote "cancel"', () => {
    const booking = validate('Need a waiter tomorrow', llmReply([{}], { intent: 'cancel_and_rebook' }), {
      fallbackLocation: 'saket',
    });

    expect(booking.intent).toBe('new');
    // Only a replacement may borrow the previous area; a new request asks.
    expect(booking.lineItems[0].location.status).toBe('missing');
  });

  it('asks for everything when the LLM finds no line items', () => {
    const [item] = validate('hello', llmReply([])).lineItems;

    expect(item.role.status).toBe('missing');
    expect(item.dates.status).toBe('missing');
    expect(item.location.status).toBe('missing');
  });

  it.each([null, 'not json', 42, { lineItems: 'nope' }, { intent: 'new' }])(
    'fails cleanly on output that is not a booking at all: %p',
    (reply) => {
      expect(validateLlmOutput(reply, context('anything'))).toEqual({
        ok: false,
        error: 'The AI reply was not in the expected format.',
      });
    },
  );
});

describe('blankBooking', () => {
  it('gives one line item where every required field asks', () => {
    const [item] = blankBooking(context('typed by hand')).lineItems;

    expect(statuses(item)).toEqual({
      role: 'missing',
      subcategory: 'ok',
      count: 'assumed',
      dates: 'missing',
      startTime: 'missing',
      endTime: 'missing',
      location: 'missing',
    });
  });
});
