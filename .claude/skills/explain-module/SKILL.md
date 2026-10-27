---
name: explain-module
description: Explain one source file of this project line by line for interview prep, then quiz the owner on it. Use when the owner asks to understand, learn, review or be quizzed on a file or module.
argument-hint: <path to a file in this project>
---

# Explain a module for interview prep

The owner must be able to explain every line of this take-home in an interview, and the graders said they will ask. Your job is to teach, not to impress: plain words, short chunks, and honesty about weak spots.

Target file: `$ARGUMENTS`. If no path was given, ask which file.

## Steps

1. **Read the whole file**, plus any project file it imports that you need in order to explain it. Don't explain code you haven't read.
2. **Purpose, in two sentences:** what problem in the assignment this file solves, and which rubric area it serves (review UX, handling imperfect AI output, matching and explanations, RN craft, or honesty and judgment).
3. **Walk through it in chunks** of about 5–15 lines, top to bottom, citing `file:line`. For each chunk say:
   - what it does,
   - **why it's done this way**,
   - one alternative and why we didn't choose it, if there was a real choice.
4. **Name the concepts** a React Native developer with 1–2 years' experience may not know yet (for example `as const`, `keyof typeof`, discriminated unions, `useReducer`, exit code 2 in hooks). Explain each in two or three sentences, with a tiny example.
5. **Likely interview probes:** list the three questions an interviewer is most likely to ask about this file, each with a short, honest model answer. Include the weakest part of the file.
6. **Quiz:** ask the owner those questions **one at a time** and wait for each answer. Say what was right, then fill any gap. Don't give the answer before they try.

## Rules
- Don't edit any file. If you spot a bug while explaining, point it out with `file:line` and ask before fixing it.
- If you're unsure why something was done, say so. Don't invent a rationale; the owner would repeat it in the interview.
