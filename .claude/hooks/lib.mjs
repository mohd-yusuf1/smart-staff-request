import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Hooks live in <project>/.claude/hooks, so the project root is two levels up.
// Derived from this file's location rather than an env var so a hook never
// silently runs against the wrong folder.
export const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Claude Code passes the event as JSON on stdin. Windows PowerShell prefixes
 * piped text with a byte-order mark, which JSON.parse rejects, so drop it.
 */
export function readHookInput() {
  return JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, ''));
}

/**
 * Exit code 2 is Claude Code's "block" signal: a PreToolUse action is
 * cancelled, a Stop is refused, and stderr is shown to Claude as the reason.
 */
export function blockWith(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

/** Keep only the end of long tool output; errors are usually there. */
export function tail(text, maxLines) {
  const lines = text.trim().split(/\r?\n/);
  return lines.length <= maxLines ? lines.join('\n') : ['…', ...lines.slice(-maxLines)].join('\n');
}
