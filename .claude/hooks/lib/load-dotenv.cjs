'use strict';
// load-dotenv.cjs — read the env files for the one handler that needs them.
//
// This used to run for every hook, which meant a rogue dotenv could reach any
// of them. It is now called only by the integration handler that actually reads
// those keys, so the blast radius of the file is the one handler that wants it.
//
// The order is the one every skill loader in the kit follows: a shell export,
// then the project's `.meowkit/.env`, then the pre-move `.claude/.env`, then the
// user-wide `~/.meowkit/.env`. The first source to define a key wins, so a
// dotenv can add configuration but not quietly replace what the caller chose,
// and a project value beats the user-wide one.
//
// Keys that could alter how a process is launched or how a shell splits words
// are refused outright, because a dotenv is data and data must not be able to
// change the runtime it is read into.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const LEGAL_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

const REFUSED_KEYS = new Set([
  'PATH', 'LD_PRELOAD', 'LD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES',
  'DYLD_FRAMEWORK_PATH', 'IFS', 'BASH_ENV', 'ENV',
]);

/** The env files in priority order, highest first. */
function envFiles({ root = process.cwd(), home = os.homedir() } = {}) {
  return [
    path.join(root, '.meowkit', '.env'),
    path.join(root, '.claude', '.env'),
    path.join(home, '.meowkit', '.env'),
  ];
}

/** Strip surrounding quotes, or an inline comment when the value is unquoted. */
function parseValue(raw) {
  const value = raw.trim();
  const quoted = value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0]);
  // A quoted value keeps a literal `#`, which real API keys contain.
  if (quoted) return value.slice(1, -1);
  const comment = value.search(/\s#/);
  return comment > 0 ? value.slice(0, comment).trimEnd() : value;
}

function parseDotenv(content) {
  const out = new Map();
  for (const line of content.split(/\r?\n/)) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('export ')) trimmed = trimmed.slice(7).trimStart();
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!LEGAL_KEY.test(key) || REFUSED_KEYS.has(key)) continue;
    if (!out.has(key)) out.set(key, parseValue(trimmed.slice(eq + 1)));
  }
  return out;
}

/**
 * Apply the env files to `env`, returning the keys that were added and the
 * files that were found.
 */
function loadDotenv({ root = process.cwd(), home = os.homedir(), env = process.env } = {}) {
  const added = [];
  const found = [];
  for (const file of envFiles({ root, home })) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
    found.push(file);
    for (const [key, value] of parseDotenv(content)) {
      if (key in env) continue;
      env[key] = value;
      added.push(key);
    }
  }
  return { added, found };
}

module.exports = { envFiles, loadDotenv, parseDotenv, REFUSED_KEYS };
