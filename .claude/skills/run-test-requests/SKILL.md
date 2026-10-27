---
name: run-test-requests
description: Run the assignment's ten test requests through the real parse and validate pipeline and draft the README results table from actual output, failures included.
disable-model-invocation: true
---

# Run the ten test requests

The assignment says: "Run your app against all ten and report what happened for each in your README, including the ones it got wrong." Graders score **honesty**: an accurate table with failures beats a flattering one.

## Preconditions (check first, and stop if any fails)
- The parse pipeline exists: `src/llm/client.ts` and `src/parse/validate.ts`.
- A runner script exists that sends one request through `client.ts` and then `validate.ts` and prints the validated `Booking` as JSON. If it doesn't exist yet, stop and tell the owner it should be built alongside the parse module. **Never simulate or predict LLM output.**
- The owner has put an API key in `.env`. You can't read `.env` (a hook blocks it), so ask the owner to confirm.

## The ten requests (verbatim from the assignment)
| # | Type | Request |
|---|---|---|
| 1 | Clear | Need 2 Chinese chefs and 1 helper for Saturday 6 PM to 11 PM, Connaught Place area. |
| 2 | Clear | 1 tandoor chef, 25th October, 11am-4pm, Rajouri Garden. |
| 3 | Clear | Deep cleaning crew of 3 for Sunday morning, Pitampura outlet. |
| 4 | Clear | Waiter, 3 din ke liye, 28 se 30 October, shaam 6 baje se, Karol Bagh. |
| 5 | Ambiguous | Need someone for tomorrow evening. |
| 6 | Ambiguous | 2 chefs, Chinese, CP, Sat |
| 7 | Ambiguous | Chef for party next week |
| 8 | Ambiguous | Need a cook, budget max 1500 per day, Lajpat Nagar, this weekend |
| 9 | Edge case | Need 2 chefs Saturday and 1 cleaner Sunday, both at Saket. |
| 10 | Edge case | Cancel my last request and book a pastry chef instead for Friday. |

## Steps
1. **Record the reference date** (today, Asia/Kolkata) and the LLM model used. Relative dates depend on both, so they go in the README.
2. Run all ten. For each, capture every line item's field values with their `status`, plus the follow-up questions generated.
3. **Compare with the expected behaviour** in the approved plan's "Expected behavior on the 10 requests" table. Mark each result as Correct, Partly correct or Wrong, and say exactly which field is off.
4. **Draft the README table:** `# | Request | What the app did | Verdict | Notes`. Use plain words, and put wrong results in the table the same way as correct ones.
5. **Show the draft to the owner. Don't write it into the README yourself.** The assignment means "run your app", so the owner should confirm the key cases on a real device before the table is final.

## Rules
- Report what happened, not what should have happened. If a run errored, the row says it errored.
- Running the same request twice can give different LLM output. If you see a difference, report both, because that's a real finding.
