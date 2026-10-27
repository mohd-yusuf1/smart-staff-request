// PostToolUse (Edit|Write): lint the one file Claude just changed, so lint
// errors are fixed while the change is fresh instead of piling up.
import { spawnSync } from 'node:child_process';
import { isAbsolute, relative, sep } from 'node:path';
import { blockWith, PROJECT_DIR, readHookInput, tail } from './lib.mjs';

const LINTABLE = /\.(ts|tsx|js|jsx|mjs)$/i;
const MAX_OUTPUT_LINES = 40;

const filePath = readHookInput().tool_input?.file_path;
if (!filePath || !LINTABLE.test(filePath)) process.exit(0);

const relPath = relative(PROJECT_DIR, filePath);
const outsideProject = relPath.startsWith('..') || isAbsolute(relPath);
if (outsideProject || relPath.split(sep).includes('node_modules')) process.exit(0);

const result = spawnSync(`npx eslint --max-warnings=0 "${relPath}"`, {
  cwd: PROJECT_DIR,
  shell: true,
  encoding: 'utf8',
});

if (result.status !== 0) {
  blockWith(`lint-on-edit: ESLint reported problems in ${relPath}:\n${tail(result.stdout + result.stderr, MAX_OUTPUT_LINES)}`);
}
