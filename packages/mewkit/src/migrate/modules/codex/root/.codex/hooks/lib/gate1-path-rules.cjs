'use strict';
// gate1-path-rules.cjs — which paths the plan gate classifies, and how.
//
// The rules are anchored on path SEGMENTS, not substrings. An earlier substring
// form let `tasks/plansold/foo.ts` and `srctasks/plans/foo.ts` read as allowed
// plan writes, so every rule here is written as either a rooted prefix or a
// `/`-delimited interior match, and each is paired with its own interior form.
//
// Backup and legacy directories are rejected BEFORE any allow rule, because a
// path like `tasks/contracts.bak/foo.ts` otherwise satisfies an allowlist by
// extension or prefix while sitting outside the tree the gate governs.

const path = require('node:path');

/**
 * Translate one shell-style pattern to a regex with the same reach. `*` spans
 * separators here, exactly as it does in a shell `case` pattern — that is what
 * makes `tasks/plans/*` cover a nested phase file.
 */
function patternToRegex(pattern) {
  const body = pattern
    .split('')
    .map((ch) => {
      if (ch === '*') return '.*';
      if (ch === '?') return '.';
      return ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return new RegExp(`^${body}$`);
}

const matchesAny = (value, patterns) => patterns.some((p) => patternToRegex(p).test(value));

/** Contract files are schema-checked on edit so a hand edit cannot break the schema. */
const CONTRACT_FILE = ['tasks/contracts/*.md', '*/tasks/contracts/*.md'];

/** A write into one of these is refused outright, ahead of every allow rule. */
const SUSPICIOUS_DIR = ['*.bak/*', '*_legacy/*', '*_old/*', '*.tmp/*', '*.backup/*'];

/**
 * Non-source trees. Root-level config files are deliberately NOT here: they fall
 * through to the plan check, so writing one requires a plan first.
 */
const NON_SOURCE = [
  'tasks/plans/*', '*/tasks/plans/*',
  'tasks/reviews/*', '*/tasks/reviews/*',
  'tasks/contracts/*', '*/tasks/contracts/*',
  'docs/*', '*/docs/*',
  '.claude/*', '*/.claude/*',
];

/** Test files, by extension marker or by directory. */
const TEST_FILE = ['*.test.*', '*.spec.*', '*/__tests__/*', '*/test/*', '*/tests/*'];

/**
 * Strip the project root and a leading `./` so an absolute path is classified
 * identically to the repo-relative spelling of the same file. Without this a
 * segment-anchored rule silently stops matching when a tool reports an
 * absolute path.
 */
function normalizePath(filePath, root) {
  let out = filePath;
  if (root) {
    const prefix = `${root}${path.sep === '\\' ? '\\' : '/'}`;
    if (out.startsWith(prefix)) out = out.slice(prefix.length);
    // A tool may report the same path with forward slashes on a platform whose
    // separator is a backslash, so handle that spelling too.
    if (out.startsWith(`${root}/`)) out = out.slice(root.length + 1);
  }
  return out.replace(/^\.\//, '');
}

const isContractFile = (p) => matchesAny(p, CONTRACT_FILE);
const isSuspiciousDir = (p) => matchesAny(p, SUSPICIOUS_DIR);
const isNonSource = (p) => matchesAny(p, NON_SOURCE);
const isTestFile = (p) => matchesAny(p, TEST_FILE);

module.exports = {
  CONTRACT_FILE,
  NON_SOURCE,
  SUSPICIOUS_DIR,
  TEST_FILE,
  isContractFile,
  isNonSource,
  isSuspiciousDir,
  isTestFile,
  matchesAny,
  normalizePath,
  patternToRegex,
};
