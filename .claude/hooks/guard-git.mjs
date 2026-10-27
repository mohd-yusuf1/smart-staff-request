// PreToolUse (Bash|PowerShell): enforce the owner's git rules on Claude's
// commands. Only Claude's tool calls pass through here; the owner's own
// terminal is unaffected.
import { execSync } from 'node:child_process';
import { blockWith, PROJECT_DIR, readHookInput } from './lib.mjs';

const PROTECTED_BRANCHES = ['main', 'master', 'develop', 'production'];

// `[^|;&]*` keeps each match inside one command of a chain like `a && b`.
const ALWAYS_BLOCKED = [
  { pattern: /\bgit\b[^|;&]*\spush\b/i, reason: 'Claude never pushes. The owner pushes after testing locally.' },
  { pattern: /\bgit\b[^|;&]*\sreset\b[^|;&]*--hard\b/i, reason: '`git reset --hard` discards uncommitted work. Suggest `git stash` instead.' },
  { pattern: /\bgit\b[^|;&]*\sclean\b[^|;&]*\s-[a-z]*f/i, reason: '`git clean -f` permanently deletes untracked files.' },
  { pattern: /\bgit\b[^|;&]*\scheckout\s+(--\s+)?\.(\s|$)/i, reason: '`git checkout .` discards uncommitted work. Suggest `git stash` instead.' },
  { pattern: /\bgit\b[^|;&]*\srestore\s+\.(\s|$)/i, reason: '`git restore .` discards uncommitted work. Suggest `git stash` instead.' },
  { pattern: /--no-verify\b/i, reason: 'Skipping git hooks (--no-verify) is not allowed.' },
];

const HISTORY_CHANGING = /\bgit\b[^|;&]*\s(commit|merge|rebase)\b/i;

function currentBranch() {
  try {
    return execSync('git branch --show-current', {
      cwd: PROJECT_DIR,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    // Not a git repository: there is no branch to protect.
    return '';
  }
}

const command = readHookInput().tool_input?.command ?? '';

for (const { pattern, reason } of ALWAYS_BLOCKED) {
  if (pattern.test(command)) blockWith(`Blocked by guard-git: ${reason}`);
}

if (HISTORY_CHANGING.test(command)) {
  const branch = currentBranch();
  if (PROTECTED_BRANCHES.includes(branch)) {
    blockWith(`Blocked by guard-git: never commit, merge or rebase on "${branch}". Ask the owner to create a feature branch first.`);
  }
}
