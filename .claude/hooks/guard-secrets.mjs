// PreToolUse (Bash|PowerShell|Read|Edit|Write|Grep): keep Claude away from
// .env files, which hold the LLM API key. .env.example has no secrets and
// stays allowed.
import { basename } from 'node:path';
import { blockWith, readHookInput } from './lib.mjs';

const ALLOWED_ENV_FILES = ['.env.example'];

// A standalone ".env" or ".env.<suffix>" token, but not ".env.example" and
// not code like `process.env.X` (a word character before the dot).
const SECRET_ENV_IN_COMMAND = /(?<![\w.])\.env(?:\.(?!example(?![\w.-]))[\w.-]+)?(?![\w.-])/;

function isSecretEnvFile(path) {
  const name = basename(path);
  if (ALLOWED_ENV_FILES.includes(name)) return false;
  return name === '.env' || name.startsWith('.env.');
}

const { tool_name: toolName, tool_input: toolInput = {} } = readHookInput();
const REASON = 'Blocked by guard-secrets: .env holds the API key and must not be read, edited or printed by Claude. Ask the owner to make the change.';

if (toolName === 'Bash' || toolName === 'PowerShell') {
  if (SECRET_ENV_IN_COMMAND.test(toolInput.command ?? '')) blockWith(REASON);
} else {
  const path = toolInput.file_path ?? toolInput.path;
  if (path && isSecretEnvFile(path)) blockWith(REASON);
}
