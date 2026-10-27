# Design note

## 1. Parse output schema, and why

The LLM returns JSON (Gemini JSON mode). For every field it gives **a value plus the exact words it came from**:

```ts
{ intent: 'new' | 'cancel_and_rebook',
  lineItems: [{ role, subcategory, count, dates, startTime, endTime, location }],  // each { value, evidence }
  budget: { value: { amountInr, per: 'day' | 'hour' } | null, evidence },
  notes: string | null }
```

- **`lineItems[]`:** requests 1 and 9 need two kinds of staff, each matched on its own.
- **`dates[]`:** covers multi-day bookings (request 4).
- **`intent`:** covers request 10.
- **`evidence`:** lets my code check each claim against the text, and it's what the review screen highlights.
- **Fixed lists:** roles and skills come from `taxonomy.ts`, and areas from a 27-area table, so invented values are refused.

The validator (`src/parse/validate.ts`, zod) checks each field on its own and returns a `Booking` where every field carries a `status`, a `reason` and one-tap `alternatives`. A reply that isn't a booking at all fails cleanly, and the owner is offered "Fill it in myself".

## 2. How a field is marked uncertain

My code decides, never the LLM's own confidence.

| Status | When | Screen |
|---|---|---|
| `ok` | evidence is in the text and the value passes the checks | green, folded |
| `assumed` | evidence not in the text; a conventional reading ("evening" 6-11 PM, "morning" 8 AM-12 PM, no count = 1, no end = 5-hour shift); my date differs from the LLM's; no cuisine, so any skill; area taken from the request being replaced | amber, one tap |
| `missing` | a required field is empty, or vague ("this weekend", "next week") | red question |
| `invalid` | past date, end before start, count outside 1-20, unknown role, skill or area, more than 7 days | red, with the reason |

- **Dates are my code's job.** Weekdays, "tomorrow", AM/PM and stale years are resolved in Asia/Kolkata by my code. If the LLM's value differs, mine wins and is marked amber.
- **Ask or guess:** missing means ask, and vague but conventional means fill it in and mark it amber.
- **Cancel intent** counts only if the text says "cancel".

## 3. Review screen: few taps, hard to confirm carelessly

- **What was read:** the owner's text is shown with the words that were read highlighted. Each requirement gets its own card.
- **Attention order:** rows are sorted red, amber, green, and green rows are folded away.
- **Red rows** open with answer chips (the validator's alternatives, the next 7 days, time presets, area search), so most fixes take **one tap**.
- **Amber rows** get "Looks right" or "Change".
- **No re-parse:** answers are written straight into the booking with no new AI call, so fields that were right can't change.
- **Confirm is blocked** and counts down ("Answer 2 more items", "Check 1 more item"). Every amber field needs its own tap. An all-green request confirms in one tap, because slowing down clear requests teaches the owner to tap through without reading.
- **Cancel and rebook** shows a card naming the request it will cancel, which needs its own tap.
- **Without AI:** four staff-type tiles open the same screen with every field asked.

**What I tried first and changed:**
- **The first version was plain.** Chef and helper rows ran together, and the home list was hard to read. After testing it on my phone, I moved to one card per requirement, a progress banner and icons.
- **"Fill it in myself" made one card only.** When request 9's AI call timed out, I couldn't add the cleaner. I added "Add another requirement" (its date, time and area start red, nothing copied) and "Remove".
- **AI and manual buttons side by side.** I tried this from the start, then went back to one main button with "Fill it in myself" after a failure. Typing is the main path, and two equal buttons make the owner stop and choose before even trying. Manual entry is the fallback.

## 4. Scoring formula and weights

**Filters first** (counted on screen, not ranked low): wrong role, a skill the partner lacks (as main or second), no working hours in the window, a booking on another confirmed request that overlaps the window, and over budget (an hourly budget becomes a day limit for the requested hours).

**Score** = 0.35 · skill + 0.35 · hours + 0.15 · distance + 0.15 · rating, each from 0 to 1:
- **skill:** 1 for the main skill or "any", 0.7 for a second skill
- **hours:** the share of the requested hours the partner works (a day with a clashing booking counts as 0)
- **distance:** 1 − km/15, floored at 0
- **rating:** (rating − 3)/2, clamped. Ratings sit between 4 and 5, so rating/5 would barely separate anyone.

**Why these weights:** the plan started at 0.40 / 0.25 / 0.20 / 0.15. On request 2 that ranked a tandoor chef free only 3 of 5 hours above one free all 5 hours with tandoor as a second skill. A partner who leaves mid-shift leaves the restaurant short during service, so hours weigh as much as skill.

**Ties** compare the totals rounded to 2 decimals, then rating, then distance, then id. Request 1 has a real tie (Ravi and Amit at 0.94). **No match** says why ("Not shown: 2 not free at that time, 6 over budget") and suggests another date or time.

**Explanations** are templates over the score numbers, never from the LLM. Each line gives the facts and the biggest weighted gap to the partner below, for example "Above #2: free 2 h more, although only a second skill." Tapping the score shows each component × weight.

**Rejected:** the plan gave a different cuisine 0.4 instead of removing it, which put a North Indian chef at #5 for "Chinese chefs". I removed those partners and accepted shorter lists (request 3 has exactly 3 deep cleaners for a crew of 3).

## 5. Out-of-scope pieces, if this were real

- **Backend:** holds the LLM key, the partners and the booking state. The app never calls Gemini directly.
- **Partner app:** the partner accepts or declines an offer within a time limit, and the booking is confirmed only after they accept.
- **Push notifications:** FCM/APNs through Expo push tokens, sent by the backend. Today it's a banner and a `[mock push]` log line.
- **Auto-replacement:** re-run the same scorer without the partner who cancelled, and offer the next one to the owner.
- **Voice input:** speech-to-text into the same parser and review screen.
- **Auth:** phone OTP.
- **Payments:** a hold at confirm, charged after the shift.
- **Offline:** queue drafts and parse when back online. Never confirm offline, because availability may have changed.

## 6. What breaks first at 10,000 partners

1. **Partners ship inside the app and every match scans them all.** Fix: match on the backend. Index by role and skill, prefilter by distance (geo index such as PostGIS) and by free time slots, then score only what's left.
2. **Bookings are checked on the phone only.** Today, a partner with an overlapping confirmed booking is filtered out, but only in this app's memory. With many owners, two can book the same partner at once. Fix: a calendar per partner on the backend, updated on confirm in a transaction, with a short hold while the owner decides.
3. **The 27-area table and straight-line km.** Fix: geocode real addresses once, and use road travel time.
