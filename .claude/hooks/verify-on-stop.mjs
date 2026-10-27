// Stop: before Claude says it is done, run typecheck, lint and tests. If any
// fail, the stop is refused and Claude sees the errors and keeps working.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { blockWith, PROJECT_DIR, readHookInput, tail } from './lib.mjs';

const WATCHED_DIR = join(PROJECT_DIR, 'src');
// Remembers the newest source change that passed, so a chat-only turn
// doesn't pay ~20s for checks. Git-ignored.
const STAMP_FILE = join(PROJECT_DIR, '.claude', '.verify-stamp');
const MAX_OUTPUT_LINES = 30;

const CHECKS = [
  { name: 'Typecheck', command: 'npx tsc --noEmit' },
  // Same bar as lint-on-edit: `expo lint` exits 0 on warnings, this does not.
  { name: 'Lint', command: 'npx eslint . --max-warnings=0' },
  { name: 'Tests', command: 'npx jest --passWithNoTests' },
];

function newestModifiedTime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const time = entry.isDirectory() ? newestModifiedTime(path) : statSync(path).mtimeMs;
    newest = Math.max(newest, time);
  }
  return newest;
}

// Set when Claude is already continuing because of this hook; checking again
// could loop forever on a failure Claude cannot fix, so let it stop and report.
if (readHookInput().stop_hook_active) process.exit(0);
if (!existsSync(WATCHED_DIR)) process.exit(0);

const newestChange = newestModifiedTime(WATCHED_DIR);
const lastVerified = existsSync(STAMP_FILE) ? Number(readFileSync(STAMP_FILE, 'utf8')) : 0;
if (newestChange <= lastVerified) process.exit(0);

const failures = [];
for (const { name, command } of CHECKS) {
  const result = spawnSync(command, { cwd: PROJECT_DIR, shell: true, encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`## ${name} failed (\`${command}\`)\n${tail(result.stdout + result.stderr, MAX_OUTPUT_LINES)}`);
  }
}

if (failures.length > 0) {
  blockWith(`verify-on-stop: fix these before finishing, or tell the owner why you can't:\n\n${failures.join('\n\n')}`);
}

writeFileSync(STAMP_FILE, String(newestChange));
