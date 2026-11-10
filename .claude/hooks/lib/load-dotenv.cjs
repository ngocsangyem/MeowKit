'use strict';
// load-dotenv.cjs — read the project dotenv for the one handler that needs it.
//
// This used to run for every hook, which meant a rogue dotenv could reach any
// of them. It is now called only by the integration handler that actually reads
// those keys, so the blast radius of the file is the one handler that wants it.
//
// Never overrides an existing variable: the first file to define a key wins and
// a shell export beats both, so a dotenv can add configuration but not quietly
// replace what the caller already chose.
//
// Keys that could alter how a process is launched or how a shell splits words
// are refused outright, because a dotenv is project data and project data must
// not be able to change the runtime it is read into.

const fs = require('node:fs');
const path = require('node:path');

/** Canonical location first, then the pre-move one so an existing install keeps working. */
const CANDIDATES = [['.meowkit', '.env'], ['.claude', '.env']];

const LEGAL_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

const REFUSED_KEYS = new Set([
  'PATH', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES',
  'DYLD_FRAMEWORK_PATH', 'IFS', 'BASH_ENV', 'ENV',
]);

/** Strip surrounding quotes, or an inline comment when the value is unquoted. */
function parseValue(raw) {
  const value = raw.trim();
  const quoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
  // A quoted value keeps a literal `#`, which real API keys contain.
  if (quoted) return value.slice(1, -1);
  const comment = value.search(/\s+#/);
  return comment > 0 ? value.slice(0, comment).trimEnd() : value;
}

function parseDotenv(content) {
  const out = new Map();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!LEGAL_KEY.test(key) || REFUSED_KEYS.has(key)) continue;
    if (!out.has(key)) out.set(key, parseValue(trimmed.slice(eq + 1)));
  }
  return out;
}

/** Apply the dotenv files to `env`, returning the keys that were added. */
function loadDotenv({ root = process.cwd(), env = process.env } = {}) {
  const added = [];
  for (const parts of CANDIDATES) {
    const file = path.join(root, ...parts);
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
    for (const [key, value] of parseDotenv(content)) {
      if (key in env) continue;
      env[key] = value;
      added.push(key);
    }
  }
  return added;
}

module.exports = { loadDotenv, parseDotenv, REFUSED_KEYS };
