---
name: rubric-check
description: Grade the current project honestly against the take-home's rubric and deliverables checklist, and name the highest-value fixes before submission.
disable-model-invocation: true
---

# Rubric check

Be a strict grader, not a cheerleader. A friendly but inflated score is useless to the owner.

## Rubric (from the assignment)
| Area | Weight | What strong looks like |
|---|---|---|
| Review and correction UX | 25% | Fast, obvious, hard to confirm carelessly; reasoning about taps and attention |
| Handling imperfect AI output | 25% | Own validation layer, sensible uncertainty signals, asks instead of guessing |
| Matching logic and explanations | 20% | Justified weights, explanations traceable to score components, ties and no-match handled |
| React Native craft | 15% | Clean components, sane state, real error and loading states |
| Honesty and judgment | 15% | Accurate self-reported results, names the weakest part, explains rejected approaches |

"A narrow thing done thoughtfully beats six half-features." Breadth earns nothing, and out-of-scope features cost focus.

## Deliverables checklist
- Working Expo app; seed data of **20 partners across at least 6 subcategories**, each with location, availability and reliability
- **Design note, 2 pages max**, covering: parse schema and why; how a field is judged uncertain; how the review UI minimizes taps and what was tried first and rejected; scoring formula and weights; how to build the out-of-scope pieces; what breaks first at 10,000 partners
- **README:** setup steps, env vars (API key in `.env`, never committed), results on **all ten** test requests, known limitations
- **Exactly two tests:** the parse-output validator and the matching scorer
- **AI usage note:** tools used, for what, and one specific AI suggestion that was rejected, with reasoning
- 4-minute recording: request 1 end to end, request 5, and one corrected field. You can't verify this one, so remind the owner.

## Steps
1. Read the code, `README.md`, the design note and `AI_NOTES.md`. Run `npm test`, `npm run typecheck` and `npx eslint . --max-warnings=0`, and report the real results.
2. Check that no secret is tracked: list `git ls-files` and confirm no env file other than the example appears.
3. For each rubric area, give a 1–5 score with **evidence** (`file:line`), the biggest gap, and the single fix with the best value for its effort.
4. Tick the deliverables checklist and list what's missing or over limit (for example, a design note longer than 2 pages, or more than two test files).
5. End with the **top three fixes** ranked by weighted impact, and an honest one-line verdict on submission readiness.

## Rules
- Report only. Don't fix anything without the owner's go-ahead.
- If something can't be verified from the repo, say "can't verify" instead of guessing.
