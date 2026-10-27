# Smart Staff Request (Owner Flow)

Take-home app. A restaurant owner types a staffing need in plain language; an LLM parses it; the owner reviews and corrects the parse; a deterministic scorer ranks partners; the owner confirms. Expo SDK 58, TypeScript strict, expo-router.

@AGENTS.md

## Working agreement
- Job take-home: received 2026-10-22, due 2026-10-27. The spec is the assignment PDF; the approved plan is at `C:\Users\DELL\.claude\plans\c-users-dell-downloads-assignment-pdf-wa-humming-starfish.md` (on the owner's machine).
- **Build one module at a time.** Write it, explain it, and let the owner review it and make the judgment calls (weights, thresholds, UX) before moving on. The owner must be able to explain every line in the interview.
- **Never invent anything for the deliverables**: no made-up test results, rejected approaches or AI-usage stories. `AI_NOTES.md` records only what actually happened.
- **The owner commits and pushes after testing locally.** Don't commit unless explicitly asked.
- Tested on Android and iPhone via Expo Go. LLM provider not chosen yet (no key as of 2026-10-24).

## Commands
- `npm test`: Jest (jest-expo preset)
- `npm run typecheck`: `tsc --noEmit`
- `npx expo lint`, `npx expo-doctor`
- `npx expo start`: run in Expo Go (tested on Android and iPhone)

## Layout
- `src/app/`: routes only (list, new, review/[id], match/[id])
- `src/domain/`: types, taxonomy, localities, dates. Pure TS, no React Native imports
- `src/llm/`: the single LLM provider adapter
- `src/parse/`: validator (LLM JSON → `Booking` with per-field status) and follow-up questions
- `src/match/`: scorer and explanation templates
- `src/state/`: one `useReducer` store; `src/components/`: UI pieces

## Rules that cost points if broken
- **Partner explanations are templated in code from the scorer's numbers.** Never ask the LLM to write them.
- **LLM output is untrusted input.** Everything goes through `src/parse/validate.ts`. Field uncertainty is decided by our checks (`Field.status`), never by the LLM's self-reported confidence.
- **Ask, don't guess.** Missing required field → follow-up question. Vague but conventional ("evening") → fill it and mark `assumed`.
- **Exactly two test files**: the parse validator and the matching scorer. Do sanity checks with scratch scripts outside the repo.
- **Out of scope, do not build**: partner app, auth, payments, backend, offline, real push notifications (mock with a toast/log).
- Keep `domain/`, `parse/` and `match/` as pure functions so they are testable without React Native.
- Dates resolve in `Asia/Kolkata`.

## Dependencies and secrets
- Add packages with `npx expo install` (SDK-compatible versions), and only after the owner approves.
- ESLint is pinned to 9: `eslint-plugin-react` (inside `eslint-config-expo`) does not support ESLint 10.
- jest-expo on SDK 58 needs `@react-native/jest-preset` matching the React Native version.
- The LLM key lives only in `.env` (git-ignored) as `EXPO_PUBLIC_LLM_API_KEY`. `EXPO_PUBLIC_` values are inlined into the app bundle; this is a documented limitation (production would proxy through a backend).

## Hooks (`.claude/hooks/`, wired in `.claude/settings.json`)
- `guard-git`: blocks push, force, `reset --hard`, `clean -f`, discarding checkouts, `--no-verify`, and commits on main/master/develop/production.
- `guard-secrets`: blocks reading, editing or printing `.env*` (except `.env.example`).
- `lint-on-edit`: ESLint (zero warnings) on each edited file.
- `verify-on-stop`: typecheck + lint + tests before finishing a turn, skipped when `src/` is unchanged since the last pass.

## Skills
- `/explain-module <file>`: line-by-line walkthrough plus interview quiz
- `/run-test-requests`: run the 10 assignment requests and draft the README results table
- `/rubric-check`: grade the project against the rubric before submitting
