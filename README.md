# Smart Staff Request (Owner Flow)

A React Native (Expo) app for one user, the restaurant owner. The owner types a staffing need in plain language, an LLM parses it into a structured booking, the owner reviews and corrects it, a deterministic scorer ranks partners, and the owner confirms.

- Screen recording (4 min): [watch on Google Drive](https://drive.google.com/file/d/1T2odIHFqknI1u8tuCXOW3vvfO0tN2Leg/view?usp=drivesdk), covering request 1 end to end, request 5 (ambiguous), and request 10 (cancel and rebook, with a corrected field)
- Design note: [`DESIGN_NOTE.md`](DESIGN_NOTE.md)
- AI usage note: [`AI_NOTES.md`](AI_NOTES.md)

## Setup

Requirements: Node.js (built with 22.14), the **Expo Go** app on an Android phone or iPhone, and a Google Gemini API key (the free tier is enough).

```bash
npm install
cp .env.example .env        # then in .env set: EXPO_PUBLIC_LLM_API_KEY=<your key>
npx expo start              # scan the QR code with Expo Go
```

If the bundler reports a missing file after installing packages, restart it with `npx expo start --clear`.

Checks:

```bash
npm test                    # Jest: the two test files
npm run typecheck           # tsc --noEmit, strict
npx expo lint
```

## Environment variables

| Name | What | Where |
|---|---|---|
| `EXPO_PUBLIC_LLM_API_KEY` | Google Gemini API key, used by `src/llm/client.ts` | `.env` only. `.env` is git-ignored and never committed; `.env.example` shows the format. |

**Known limitation:** Expo inlines `EXPO_PUBLIC_` variables into the app bundle, so anyone with the built app could read the key. This is acceptable for a take-home. In production the app would call the LLM through a backend that holds the key.

Without a key, the app still works: "Read with AI" shows a clear "No API key" message, and the owner can use "Fill it in myself" or the staff-type tiles.

## Project layout

```
src/app/          screens (expo-router): list, new, review/[id], match/[id]
src/domain/       types, taxonomy (roles and skills), 27 Delhi areas, date rules (Asia/Kolkata)
src/llm/          the only file that talks to Gemini, plus the prompt
src/parse/        validator (LLM JSON -> booking with a status per field), follow-up choices, owner edits
src/match/        scorer, explanation templates
src/state/        one useReducer store (in memory)
src/data/         20 seed partners
src/components/   UI pieces
```

The tests are `src/parse/validate.test.ts` (the parse-output validator, 24 checks) and `src/match/score.test.ts` (the matching scorer, 14 checks).

## How I planned it

Before writing code (24 Oct), I made a written plan with Claude Code and approved it. Then I built one module at a time, reviewing each and making the judgment calls before moving on.

**Starting point: the rubric.** Review UX and handling imperfect AI output are 50% of the grade, so the plan put most effort there. Matching came next, and the plan said to build nothing out of scope.

**Key decisions made up front:**
- **The LLM only extracts.** It returns each field with the exact words it came from, and my own validator decides what is uncertain. The LLM's confidence is never used.
- **No re-parse.** Corrections are one-tap answers written straight into the booking, so fields that were already right can't change.
- **Plain arithmetic for matching.** A deterministic scorer, with explanations built from its numbers rather than written by the LLM.
- **Pure logic, testable without the phone.** The logic (`domain/`, `parse/`, `match/`) is pure TypeScript. The two tests cover the validator and the scorer.
- **One adapter for the LLM.** The provider sits behind one file, so it could be chosen late. I had no key when I started.

**Build order:** the app was built from the bottom up, so each layer could be checked before the next one used it:
1. the domain rules: roles and skills, areas, dates
2. the seed partners
3. the scorer, its explanations and test 2
4. the validator and test 1
5. the LLM client
6. the screens
7. matching and confirm
8. fixes from my phone tests

**What changed against the plan:**
- **Weights:** 0.40 / 0.25 / 0.20 / 0.15 became 0.35 / 0.35 / 0.15 / 0.15 after real rankings on request 2.
- **Different cuisines:** the plan scored a different cuisine low; such partners are now removed instead.
- **No flat form:** the plan said to build a flat form first and compare. I didn't. I built the card-based review screen directly and changed it after testing it on my phone.
- **LLM model:** the first model was too overloaded to use, so I switched to a lighter one.
- **From phone testing:** add/remove requirement, delete or cancel on the home screen, and the double-booking check, none of which were in the plan.

## Results on the ten test requests

**How these were run:**
- **All ten:** run through the app's real Gemini call (`src/llm/client.ts`) and validator on **Mon 26 Oct 2026** (India time), model **`gemini-3.5-flash-lite`**. Each answered in 1.1 to 2.6 s.
- **Fixes, then a re-run:** that run found three validator bugs (below). After the fixes, the same ten replies went through the current validator and scorer, and the "What the app shows" column is from that.
- **End to end on the phone (Expo Go):** requests 1, 8, 9 and 10, marked **Phone**.
- **Dates:** relative dates ("Saturday", "tomorrow") depend on the day you run them. On 26 Oct, Saturday was 31 Oct.

Colours on the review screen: **red** = must answer, **amber** = one tap to check, **green** = fine and folded away.

| # | Request | What the app shows | Verdict | Notes |
|---|---|---|---|---|
| 1 | Need 2 Chinese chefs and 1 helper for Saturday 6 PM to 11 PM, Connaught Place area. | Two requirements, all green: 2 × Chinese chef and 1 × Kitchen helper, Sat 31 Oct, 6-11 PM, Connaught Place. **Phone:** 4 Chinese chefs shown (Sunil Verma 0.95, Ravi Kumar and Amit Sharma tied at 0.94, Deepak Thapa 0.84) and 2 helpers (Sanjay Yadav, Raju Prasad). | Correct | First run: the helper's skill came back without evidence and was amber for no reason. Fixed: a role with only one skill is now fine. Ravi and Amit tie; Ravi is listed first for the higher rating, and the explanation says so. |
| 2 | 1 tandoor chef, 25th October, 11am-4pm, Rajouri Garden. | Red date row: "Sun 25 Oct has already passed." Everything else is green. The owner picks another day. | Correct for the day it ran | On 26 Oct this date really was past. The LLM returned the wrong year (2025-10-25). The validator refused the date, but the first message said "Sat 25 Oct", the 2025 weekday. Fixed to use this year's date. |
| 3 | Deep cleaning crew of 3 for Sunday morning, Pitampura outlet. | 3 × Deep cleaner, Sun 1 Nov, Pitampura. Time is amber: "morning" read as 8 AM-12 PM. After "Looks right": exactly 3 deep cleaners shown (Meena Devi, Salim Khan, Rakesh Gupta). | Correct | The LLM said "morning" = 9:00; our rule (8 AM-12 PM) replaced it and marked it amber. There's no backup: all three must be booked. |
| 4 | Waiter, 3 din ke liye, 28 se 30 October, shaam 6 baje se, Karol Bagh. | 1 × Waiter, Wed 28 to Fri 30 Oct, from 6 PM, Karol Bagh. Amber: count (no number, so 1) and end time (no end given, so a 5-hour shift to 11 PM). After two taps: 3 waiters shown. | Correct | The Hinglish was read correctly. "3 din ke liye" ended up in notes. I don't cross-check it against the 3 dates. |
| 5 | Need someone for tomorrow evening. | Date Tue 27 Oct is green. Time is amber ("evening" read as 6-11 PM). Red: "What kind of staff do you need?" and "Which area?" | Correct | Asks instead of guessing. No partners until role and area are answered. |
| 6 | 2 chefs, Chinese, CP, Sat | 2 × Chinese chef, Sat 31 Oct, Connaught Place ("CP" resolved). Red: "What time?" | Correct | |
| 7 | Chef for party next week | Red: which day ("next week" isn't one date), time and area. Amber: any chef (no cuisine given) and count 1. Notes: "party". | Correct | The LLM put all seven days of next week in the date field; the validator refuses vague dates and asks. First run: the word "party" was lost because the LLM wrapped notes like a field. Fixed. |
| 8 | Need a cook, budget max 1500 per day, Lajpat Nagar, this weekend | "Cook" → chef. Budget ₹1500/day. Red: date (with Sat / Sun / both as chips) and time. Amber: any chef. **Phone:** 2 chefs shown (Rohit Das, Mohan Lal), "Not shown: 2 not free at that time, 6 over budget." | Correct | Budget is a filter, not a score. The count's evidence was the word "a", which my evidence check can't really judge (see limitations). |
| 9 | Need 2 chefs Saturday and 1 cleaner Sunday, both at Saket. | Script run: split into two requirements (2 × chef on Sat 31 Oct, 1 × cleaner on Sun 1 Nov), both at Saket. Red: time for each. **Phone:** the AI call timed out after 30 s. With "Fill it in myself" there was only one card, so the cleaner couldn't be added. | **Failed on the phone** | The timeout is a real failure. The one-card problem was a gap in the app. "Add another requirement" and "Remove" were added to the review screen after this test. |
| 10 | Cancel my last request and book a pastry chef instead for Friday. | Cancel-and-rebook: a red-bordered card names the request it will cancel and needs its own tap. Pastry chef, Fri 30 Oct. Area is amber (Saket, taken from the request being replaced). Red: time. **Phone:** confirming it marked the earlier request Cancelled. | Correct | The cancel intent is only accepted if the text contains "cancel". The count's evidence was "a" again. |

**What went wrong across the runs:**
- **The LLM itself:** my first model, `gemini-3.8-flash`, timed out on 8 of 10 requests and later returned 503 "high demand" errors. The app now uses `gemini-3.5-flash-lite`. On the phone, request 9 still timed out once.
- **My validator:** three bugs (requests 1, 2 and 7 above), each fixed with a check added to test 1.

## Known limitations

- **The key is in the app bundle** (see Environment variables).
- **The evidence check is weak.** A field is "ok" when the LLM's quoted words appear in the request, but very short evidence like "a" (the count in requests 8 and 10) almost always appears.
- **Double-booking is only checked inside this app's memory.** A partner on a confirmed request can't be picked for any time that overlaps it (booked 12-4 PM: not for 1-5 PM, but yes for 4-8 PM). It lives in the in-memory store, so it's lost when the app closes, and two owners could still book the same partner (no backend).
- **27 Delhi areas.** Locations come from a fixed table with aliases (CP, GK-1, HKV…). Other areas are refused, and "GK-II" (Roman numerals) isn't recognised. Distance is a straight line, which is about 1.2-1.3× shorter than by road in my Google Maps checks.
- **No overnight shifts.** The end time must be after the start time on the same day.
- **No Hindi date words.** "kal" means both yesterday and tomorrow, so the app asks instead. Hinglish works only as far as the LLM reads it (request 4 worked).
- **Bookings are 1-7 days.** The 7-day maximum is a working limit, not based on data from real owners.
- **In-memory only.** Requests are lost when the app closes, because there's no backend or offline storage (out of scope).
- **Made-up seed data.** The 20 partners, their day rates (₹800-2400) and ratings are invented for testing, not market data.
- **The LLM can be slow or down.** There's a 30 s timeout and one retry on 503. The way out is "Fill it in myself" or the staff-type tiles.
- **Rounded score breakdown.** The breakdown behind a score rounds each row to 2 decimals, so in about 3 of 10 cases the rows add up to 0.01 off the total. The screen says so.
- `npm install` reports 5 high-severity advisories in the dependency tree. They haven't been fixed (`npm audit fix` not run).

## The weakest part

**The evidence check that decides whether a field is trusted.** It's the base of the "how sure are we" signal, and it only asks "do these words appear in the text?". That works for "Saturday" or "Lajpat Nagar", but not for a count whose evidence is "a", or a word that appears in the text for a different reason. A stronger version would check that the evidence actually supports the value (for example, that the count's evidence contains a number or a number word) before marking it green.
