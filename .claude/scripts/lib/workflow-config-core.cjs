'use strict';
// workflow-config-core.cjs — read and write the project config by dotted key.
//
// Behavior is pinned by tests/ports/golden, recorded from the implementation
// this replaces, because the answers callers actually depend on are in the
// seams the usage text never described:
//
//   * `get` on a missing key prints an EMPTY LINE and exits 0. Every skill
//     preamble calls this as `$(... || echo "true")`, so an exit code would
//     change which default they take.
//   * `has` exits 1 for a falsy value and for an absent file alike — it answers
//     "is this switched on", not "is this present".
//   * `set` refuses to create a config file. A config that appears because
//     something recorded telemetry into it is not a config the user chose.
//   * The written JSON carries two-space indentation and NO trailing newline.
//
// One thing is deliberately different, and it is the reason this is a port
// rather than a copy: the file is located canonical-first, with the pre-move
// location as a fallback, matching the resolver the TypeScript side already
// uses. The old environment-variable overrides are dropped — neither was set
// anywhere in the tree, and a second way to point this at a different file is a
// second way for two callers to disagree about what the config says.

const fs = require('node:fs');
const path = require('node:path');

/** Where the config lives now, and where it used to live. */
const CANONICAL_REL = path.join('.meowkit', 'config.json');
const LEGACY_REL = path.join('.claude', 'meowkit.config.json');

/**
 * The config a reader should use: canonical when present, else the pre-move
 * location, else the canonical path — so a diagnostic names the file that
 * would be created rather than the one being retired.
 */
function resolveConfigPath(root = process.cwd()) {
  const canonical = path.join(root, CANONICAL_REL);
  if (fs.existsSync(canonical)) return canonical;
  const legacy = path.join(root, LEGACY_REL);
  if (fs.existsSync(legacy)) return legacy;
  return canonical;
}

/** Relative to cwd when it is under it, so messages stay readable. */
function displayPath(abs, root = process.cwd()) {
  const rel = path.relative(root, abs);
  return rel && !rel.startsWith('..') ? rel : abs;
}

function readConfig(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed !== null && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Walk a dotted key. Returns `undefined` for a key that is absent, for a key
 * whose parent is absent, and for a key that tries to index into a scalar —
 * all three are "no value here", and the caller's default covers all three.
 */
function lookup(config, key) {
  let node = config;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return undefined;
    if (!Object.prototype.hasOwnProperty.call(node, part)) return undefined;
    node = node[part];
  }
  return node;
}

/** Print a value the way a shell caller can compare it: booleans lowercased. */
function render(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** A bare word from the command line, typed: `true`/`false` and digits. */
function coerce(raw) {
  const lowered = raw.toLowerCase();
  if (lowered === 'true') return true;
  if (lowered === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

/** Set a dotted key, creating the intermediate objects it needs. */
function assign(config, key, value) {
  const parts = key.split('.');
  let node = config;
  for (const part of parts.slice(0, -1)) {
    if (node[part] === null || typeof node[part] !== 'object' || Array.isArray(node[part])) node[part] = {};
    node = node[part];
  }
  node[parts[parts.length - 1]] = value;
}

/** Two-space indentation, no trailing newline — the shape readers already see. */
function writeConfig(file, config) {
  fs.writeFileSync(file, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = { CANONICAL_REL, LEGACY_REL, assign, coerce, displayPath, lookup, readConfig, render, resolveConfigPath, writeConfig };
