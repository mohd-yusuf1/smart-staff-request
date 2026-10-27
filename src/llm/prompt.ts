// The instructions sent to the LLM. It only extracts what the owner wrote and
// copies the words it used; it never rates its own confidence. The validator
// re-checks everything it returns.
import { formatShortDate, weekdayOf } from '../domain/dates';
import { TAXONOMY } from '../domain/taxonomy';
import type { IsoDate } from '../domain/types';

// Generated from the taxonomy, so adding a skill there updates the prompt too.
function skillList(): string {
  return Object.entries(TAXONOMY)
    .map(([role, skills]) => `  - ${role}: ${skills.join(', ')}`)
    .join('\n');
}

const EXAMPLE_MESSAGE = 'Need 3 waiters tomorrow from 7 pm, Hauz Khas';

// Written for a fixed "today" so the example never changes.
const EXAMPLE_TODAY: IsoDate = '2026-10-26';

const EXAMPLE_OUTPUT = {
  intent: 'new',
  lineItems: [
    {
      role: { value: 'waiter', evidence: 'waiters' },
      subcategory: { value: null, evidence: null },
      count: { value: 3, evidence: '3' },
      dates: { value: ['2026-10-27'], evidence: 'tomorrow' },
      startTime: { value: '19:00', evidence: '7 pm' },
      endTime: { value: null, evidence: null },
      location: { value: 'Hauz Khas', evidence: 'Hauz Khas' },
    },
  ],
  budget: { value: null, evidence: null },
  notes: null,
};

export function buildSystemPrompt(today: IsoDate): string {
  return `You turn a restaurant owner's staffing message into JSON. The message may mix English and Hindi (Hinglish).
Today is ${weekdayOf(today)} ${today} (${formatShortDate(today)}) in India.

Return only JSON with this shape:
{
  "intent": "new" or "cancel_and_rebook",
  "lineItems": [ { "role", "subcategory", "count", "dates", "startTime", "endTime", "location" } ],
  "budget": { "value": { "amountInr": number, "per": "day" or "hour" } or null, "evidence": string or null },
  "notes": string or null
}
Each line-item field is an object: { "value": ..., "evidence": ... }.

Rules for every field:
- "evidence" is the exact words copied from the message that the value comes from, unchanged. Use null if the message doesn't say it.
- If the message doesn't say something, set "value" to null. Don't guess and don't fill in defaults: the app asks the owner.
- Don't add confidence scores or explanations.

Fields:
- role: one of ${Object.keys(TAXONOMY).join(', ')}. "cook" is a chef. If the message only says "someone" or "staff", use null.
- subcategory: one of these, or null if not stated:
${skillList()}
- count: a whole number. "a", "an" or "one" is 1. Null if not stated.
- dates: a list of "YYYY-MM-DD" dates, worked out from today's date. A range like "28 se 30 October" lists every day. For words that aren't one exact date ("this weekend", "next week"), give your best reading and copy the words as evidence.
- startTime, endTime: 24-hour "HH:mm"; "6 PM" is "18:00". For words like "morning" or "evening", give your best reading and copy the word as evidence. If no end time is given, use null.
- location: the area name as written, such as "Connaught Place" or "CP". Null if not given.
- budget: only if a budget is stated, per "day" or per "hour".
- intent: "cancel_and_rebook" only if the owner asks to cancel an earlier request.
- notes: other useful details in a few words (occasion, special requests), or null.

Make one line item per role and schedule: "2 chefs Saturday and 1 cleaner Sunday" is two line items. If a place or time is shared ("both at Saket"), repeat it in each line item with the same evidence.

Example, if today were ${EXAMPLE_TODAY}:
Message: "${EXAMPLE_MESSAGE}"
Output: ${JSON.stringify(EXAMPLE_OUTPUT)}`;
}
