'use strict';
// env-read-scan.cjs — find every environment-name READ in the shipped kit.
//
// "Read" rather than "occurrence" is the whole point: documentation prose names
// variables legitimately, so a scan that flags every mention would be noise
// nobody keeps green. Only a syntactic read counts.
//
// Two detection methods, because one is not enough. A literal read spells the
// name out and a regex finds it. A COMPOSED read builds the name at runtime —
// `os.getenv(f'MEOWKIT_{suffix}')` — and a literal scan is blind to it, which is
// how roughly sixteen genuinely-read names once looked reader-less. A composition
// zone is therefore scanned for the suffix literals its composing call can reach.

const fs = require('node:fs');
const path = require('node:path');

const PREFIXES = ['MEOWKIT_', 'MEOW_', 'MK_'];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'worktrees', 'modules', '__pycache__']);
const CODE_EXT = new Set(['.cjs', '.mjs', '.js', '.ts', '.tsx', '.py', '.sh', '.bash', '.zsh']);

const NAME = '[A-Z][A-Z0-9_]*';

/** One regex per read syntax. Each must capture the bare name in group 1. */
const READ_PATTERNS = [
  // process.env.NAME / process.env["NAME"] / env.NAME / env["NAME"]
  new RegExp(`\\benv\\.(${NAME})`, 'g'),
  new RegExp(`\\benv\\[\\s*['"\`](${NAME})['"\`]\\s*\\]`, 'g'),
  // (opts.env ?? process.env).NAME and env?.NAME — the same read with the
  // fallback spelled out. A scan that only knows `env.NAME` reads straight past
  // it, which is how a cost cap went on reading a migrated name unnoticed.
  new RegExp(`\\)\\s*\\.(${NAME})`, 'g'),
  new RegExp(`\\benv\\?\\.(${NAME})`, 'g'),
  // os.environ["NAME"] / os.environ.get("NAME") / os.getenv("NAME")
  new RegExp(`os\\.environ(?:\\.get)?[\\[(]\\s*['"](${NAME})['"]`, 'g'),
  new RegExp(`os\\.getenv\\(\\s*['"](${NAME})['"]`, 'g'),
  // shell $NAME and ${NAME} / ${NAME:-default}
  new RegExp(`\\$\\{(${NAME})[:}]`, 'g'),
  new RegExp(`\\$(${NAME})\\b`, 'g'),
  // shell export / assignment of a name the kit then reads back
  new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?(${NAME})=`, 'g'),
];

const hasPrefix = (name) => PREFIXES.some((p) => name.startsWith(p) && name.length > p.length);

/** 1-based line of a match, so a finding points at something a reader can open. */
const lineOf = (source, index) => source.slice(0, index).split('\n').length;

/** Every file under `dir` whose extension is code. */
function codeFiles(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) codeFiles(full, out);
    } else if (CODE_EXT.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/** Literal reads in one file's source, as `{ name, line }`. */
function literalReads(source) {
  const found = [];
  for (const pattern of READ_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);
    while (match) {
      if (hasPrefix(match[1])) {
        found.push({ name: match[1], line: lineOf(source, match.index) });
      }
      match = pattern.exec(source);
    }
  }
  return found;
}

/**
 * Composed reads for one zone. Every upper-case multi-word literal the zone's
 * files spell is a candidate suffix: the composing helper takes its argument
 * from a map in a sibling file, so the suffix and the call site are never on the
 * same line and following the dataflow would be guesswork. Over-collecting is
 * the safe direction — a non-suffix literal is declared in the table by name,
 * so a NEW composed suffix cannot pass as one.
 */
function composedReads(root, zone, nonSuffix) {
  const dir = path.join(root, zone.dir);
  const literal = /['"]([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)['"]/g;
  const found = [];
  for (const file of codeFiles(dir)) {
    const source = fs.readFileSync(file, 'utf8');
    literal.lastIndex = 0;
    let match = literal.exec(source);
    while (match) {
      const suffix = match[1];
      if (!nonSuffix.has(suffix) && !PREFIXES.some((p) => suffix.startsWith(p))) {
        found.push({
          name: `${zone.prefix}${suffix}`,
          line: lineOf(source, match.index),
          file,
          composed: true,
        });
      }
      match = literal.exec(source);
    }
  }
  return found;
}

/** `{ reads }` over the given trees, each read carrying its file, line and name. */
function scanReads(root, trees, table) {
  const nonSuffix = new Set(Object.keys(table.nonSuffixLiterals || {}).filter((k) => k !== 'comment'));
  const reads = [];
  for (const tree of trees) {
    for (const file of codeFiles(path.join(root, tree))) {
      const source = fs.readFileSync(file, 'utf8');
      for (const hit of literalReads(source)) reads.push({ ...hit, file });
    }
  }
  for (const zone of table.compositionZones || []) {
    reads.push(...composedReads(root, zone, nonSuffix));
  }
  return reads;
}

module.exports = { PREFIXES, codeFiles, literalReads, composedReads, scanReads };
