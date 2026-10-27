# AI usage note

## Tools
- **Claude Code** (CLI, Opus): planning, nearly all of the code, explanations of each module, scratch check scripts, and first drafts of the README and design note.
- **Google Gemini** (`gemini-3.5-flash-lite`): the LLM inside the app that parses requests.
- **Project hooks** (`.claude/hooks/`): stop the AI from pushing, discarding work or reading the API key file, and lint every file it edits.

## How I worked with it
- **One module at a time.** For each module, Claude wrote it and explained it, and I made the judgment calls before moving on.
- **My judgment calls:**
  - the scoring weights: 0.35 skill / 0.35 hours / 0.15 distance / 0.15 rating, over the plan's 0.40 / 0.25 / 0.20 / 0.15
  - a fixed table of 27 Delhi areas instead of a map API
  - "Saturday" said on a Saturday means today, with next Saturday as a one-tap alternative
  - no Hindi date words ("kal" means both yesterday and tomorrow)
  - test with the real date, not a fake one
  - every UI change after each phone test
- **What I checked myself:**
  - the area coordinates, in Google Maps
  - the date rules, by running Claude's script on my machine
  - all ten requests against the real LLM, which I ran myself because the AI can't read the key
  - every screen, on my phone
- **I accidentally pasted the API key into `.env.example`,** which gets committed. Claude flagged it, and I moved the key myself before anything was committed.

## Where the AI was wrong, and how it was caught
- **LLM timeouts:** Claude blamed the "thinking" setting and changed it. The next run showed the real cause was Google's servers being overloaded (503 "high demand"). We switched to `gemini-3.5-flash-lite`, which answered all ten in 1-3 s.
- **My real LLM run found three validator bugs** (wrong weekday in a past-date message, a helper's only skill marked uncertain, the word "party" lost from notes). Each was fixed, with a check added to test 1.
- **My phone tests found more:**
  - titles like "Kitchen helper helper"
  - "Fill it in myself" giving only one card, so request 9's cleaner couldn't be added
  - no way to delete a request
- **Claude caught its own bugs:** a missing area was being filled in from the previous request for every request, and pressing back after confirming reopened an editable screen.
- **Score breakdown:** Claude's scratch check found that the rounded rows can add up to 0.01 off the total. The screen says so rather than adjusting the numbers.

## Suggestions I rejected

**1. Showing chefs of a different cuisine in the top 5.** The plan's scorer gave a different speciality a reduced score instead of removing it, so a North Indian chef appeared at #5 for "Chinese chefs".
**My reason:** if the owner asks for a Chinese chef, a North Indian chef can't do the job. Skill is a requirement, not a preference to score lower.
**The cost I accepted:** shorter lists. Request 3 has exactly 3 deep cleaners for a crew of 3.

**2. Emoji icons.** Claude recommended emoji because they need no new package. I chose the Lucide icon library.
**My reason:** emoji look different on Android and iPhone and can't take the app's colours or sizes. Lucide icons look the same everywhere and match the design.

**3. Letting a partner be booked for an overlapping shift.** Claude's first double-booking fix subtracted booked hours, so Ravi, booked 12-4 PM, still appeared for 1-5 PM as "free 1 of 4 h".
**My reason:** a partner can't be in two places at once. An overlapping shift is a clash, not "fewer free hours".
**What changed:** now any overlap removes the partner for that day ("already booked at that time"). Back-to-back shifts (4 PM end, 4 PM start) are allowed.
