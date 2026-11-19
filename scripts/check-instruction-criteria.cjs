#!/usr/bin/env node
'use strict';
// check-instruction-criteria.cjs — run the mechanical instruction audit criteria over the
// kit's instruction text on every runtime it ships to.
//
// Usage:
//   node scripts/check-instruction-criteria.cjs [tree ...]            check; exit 1 on a finding
//   node scripts/check-instruction-criteria.cjs --baseline <file> ... fail only where a file grew
//   node scripts/check-instruction-criteria.cjs --write-baseline <file> [tree ...]
//   node scripts/check-instruction-criteria.cjs --metrics [tree ...]  print the metrics table
//   node scripts/check-instruction-criteria.cjs --emphatic [tree ...] emphatic tokens per file
//
// A tree is `.claude`, a directory, or `installed:<runtime>` (codex, cursor, grok, pi, omp): what
// `mewkit init` writes for that runtime from this checkout (scripts/lib/installed-tree.cjs,
// which needs the mewkit binary). With no tree, `.claude` and all five are checked.
// Criteria and their scope: docs/maintainer/instruction-audit-criteria.md.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { checkFile, emphaticCount, gatePhraseCount, pinnedText, PINNED_SECTIONS } = require('./lib/instruction-criteria-rules.cjs');
const { checkHostFile, readPins } = require('./lib/instruction-criteria-host-rules.cjs');
const { checkSkillFile, listingChars, isSkill } = require('./lib/instruction-criteria-skill-rules.cjs');
const { frontmatterValue } = require('./lib/instruction-criteria-frontmatter.cjs');
const { allowed, looseEntries, overBaseline, readBaseline, writeBaseline } = require('./lib/instruction-criteria-baseline.cjs');
const { installedTree } = require('./lib/installed-tree.cjs');

const REPO = path.resolve(__dirname, '..');
const INSTALLED = 'installed:';
const DEFAULT_TREES = ['.claude', 'installed:codex', 'installed:cursor', 'installed:grok', 'installed:pi', 'installed:omp'];
const TEXT_EXT = new Set(['.md', '.mdc', '.toml']);
const SKIP_DIRS = new Set(['node_modules', '__tests__', '.venv']);
/** Host state at the top of a tree; a skill folder of the same name deeper down is still checked. */
const SKIP_TOP_DIRS = new Set(['worktrees', 'logs', 'cache', 'session-state', 'agent-memory', 'memory']);
const PINS_FILE = path.join(REPO, 'docs/maintainer/model-pins.md');
const CRITERIA = ['A1', 'A2', 'A5', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14'];

/** sha256 of the blocked-pattern table plus the numbered injection rules (must not change). */
const PINNED_SHA256 = 'e0b639506d83aff3e9040f3fdbfad35c016ee46ff701ad2f1daff04ced2461fa';

/**
 * Always-on bytes per tree may only shrink. Claude Code loads every rule file; every other
 * runtime loads the installed root AGENTS.md (the kit's shared block and its markers), and
 * Cursor also every installed `.mdc` rule marked `alwaysApply: true`. The Cursor figure rose
 * from 6316 when Cursor took the shared block in place of a shorter text of its own.
 */
const ALWAYS_ON_CEILING = { '.claude': 18191, 'installed:codex': 7687, 'installed:cursor': 10641, 'installed:grok': 7687, 'installed:pi': 7687, 'installed:omp': 7687 };
/** Codex stops reading project guidance past this many bytes (`project_doc_max_bytes`). */
const AGENTS_MD_CAP = 32768;
/** Skill listing ceilings in chars; Codex is lower so a 128k-context session keeps whole descriptions. */
const LISTING_CEILING = { '.claude': 16000, 'installed:codex': 12000, 'installed:cursor': 16000, 'installed:grok': 12000, 'installed:pi': 12000, 'installed:omp': 12000 };

/** Where a tree's files are. */
function dirOf(tree) {
  return tree.startsWith(INSTALLED) ? installedTree(tree.slice(INSTALLED.length)) : path.resolve(REPO, tree);
}

/** Listing chars summed over every skill in a tree. */
function listingTotal(tree) {
  const abs = dirOf(tree);
  return walk(abs).filter((f) => isSkill(path.relative(abs, f)))
    .reduce((n, f) => n + listingChars(fs.readFileSync(f, 'utf8'), kindOf(tree)), 0);
}

function expand(trees) {
  return (trees.length ? trees : DEFAULT_TREES).map((t) => (t.startsWith(INSTALLED) ? t : t.replace(/\/+$/, '')));
}

/** 'claude' for a `.claude` tree, else the runtime the tree is installed or laid out for. */
function kindOf(tree) {
  if (tree.startsWith(INSTALLED)) return tree.slice(INSTALLED.length);
  const parts = tree.split(/[\\/]+/);
  if (parts[parts.length - 1] === '.claude') return 'claude';
  return parts.includes('cursor') || fs.existsSync(path.resolve(REPO, tree, '.cursor')) ? 'cursor' : 'codex';
}

function walk(dir, out = [], top = true) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const skip = SKIP_DIRS.has(entry.name) || (top && SKIP_TOP_DIRS.has(entry.name));
      if (!skip) walk(path.join(dir, entry.name), out, false);
    } else if (TEXT_EXT.has(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function alwaysOnFiles(tree) {
  const abs = dirOf(tree);
  if (kindOf(tree) === 'claude') {
    const rules = path.join(abs, 'rules');
    return fs.readdirSync(rules).filter((f) => f.endsWith('.md')).map((f) => path.join(rules, f));
  }
  const out = [path.join(abs, 'AGENTS.md')].filter((f) => fs.existsSync(f));
  const mdc = path.join(abs, '.cursor', 'rules');
  if (fs.existsSync(mdc)) {
    for (const f of fs.readdirSync(mdc).filter((n) => n.endsWith('.mdc'))) {
      const file = path.join(mdc, f);
      if (frontmatterValue(fs.readFileSync(file, 'utf8'), 'alwaysApply') === 'true') out.push(file);
    }
  }
  return out;
}

function findingsOf(tree, pins = readPins(PINS_FILE)) {
  const abs = dirOf(tree);
  const ctx = { kind: kindOf(tree), pins };
  const findings = [];
  for (const f of walk(abs)) {
    const rel = path.relative(abs, f).split(path.sep).join('/');
    const text = fs.readFileSync(f, 'utf8');
    const raw = [...checkFile(rel, text, abs), ...checkHostFile(rel, text, ctx), ...checkSkillFile(rel, text, ctx)];
    for (const x of raw) if (!allowed(text, x)) findings.push({ file: `${tree}/${rel}`, ...x });
  }
  return findings;
}

function measure(tree) {
  const abs = dirOf(tree);
  const files = walk(abs);
  const pinned = PINNED_SECTIONS.map((p) => path.join(abs, p.file));
  const m = { tree, files: files.length, gate: 0, emphatic: 0, emphaticOutsidePinned: 0, skills: 0, listing: 0 };
  for (const f of files) {
    const rel = path.relative(abs, f);
    const text = fs.readFileSync(f, 'utf8');
    const n = emphaticCount(text);
    m.gate += gatePhraseCount(rel, text);
    m.emphatic += n;
    if (!pinned.includes(f)) m.emphaticOutsidePinned += n;
    if (isSkill(rel) && frontmatterValue(text, 'description') !== undefined) {
      m.skills += 1;
      m.listing += listingChars(text, kindOf(tree));
    }
  }
  m.alwaysOn = alwaysOnFiles(tree).reduce((n, f) => n + fs.statSync(f).size, 0);
  m.byCriterion = Object.fromEntries(CRITERIA.map((c) => [c, 0]));
  for (const f of findingsOf(tree)) m.byCriterion[f.criterion] += 1;
  return m;
}

function check(tree) {
  const findings = findingsOf(tree);
  const alwaysOn = alwaysOnFiles(tree).reduce((n, f) => n + fs.statSync(f).size, 0);
  const ceiling = ALWAYS_ON_CEILING[tree];
  if (ceiling !== undefined && alwaysOn > ceiling) {
    findings.push({ file: tree, line: 0, criterion: 'A8', text: `always-on text is ${alwaysOn} B, above the ${ceiling} B ceiling` });
  }
  const agentsMd = path.join(dirOf(tree), 'AGENTS.md');
  if (kindOf(tree) !== 'claude' && fs.existsSync(agentsMd) && fs.statSync(agentsMd).size > AGENTS_MD_CAP) {
    findings.push({ file: tree, line: 0, criterion: 'A8', text: `AGENTS.md is ${fs.statSync(agentsMd).size} B, above the ${AGENTS_MD_CAP} B a runtime reads` });
  }
  const listed = listingTotal(tree);
  if (LISTING_CEILING[tree] !== undefined && listed > LISTING_CEILING[tree]) {
    findings.push({ file: tree, line: 0, criterion: 'listing', text: `skill listing is ${listed} chars, above the ${LISTING_CEILING[tree]} ceiling` });
  }
  if (kindOf(tree) === 'claude') {
    const sha = crypto.createHash('sha256').update(pinnedText(dirOf(tree))).digest('hex');
    if (sha !== PINNED_SHA256) findings.push({ file: tree, line: 0, criterion: 'pinned', text: 'the blocked-pattern table or the numbered injection rules changed' });
  }
  return findings;
}

function printMetrics(trees) {
  const head = ['Tree', 'Text files', 'Always-on bytes', 'Gate phrases', 'Emphatic tokens', 'Emphatic outside pinned rules', 'Skills', 'Listing chars', ...CRITERIA.slice(3)];
  console.log(`| ${head.join(' | ')} |`);
  console.log(`|${head.map(() => '---').join('|')}|`);
  for (const t of trees) {
    const m = measure(t);
    const row = [m.tree, m.files, m.alwaysOn, m.gate, m.emphatic, m.emphaticOutsidePinned, m.skills, m.listing, ...CRITERIA.slice(3).map((c) => m.byCriterion[c])];
    console.log(`| ${row.join(' | ')} |`);
  }
}

function printEmphatic(trees) {
  for (const t of trees) {
    const abs = dirOf(t);
    const rows = walk(abs).map((f) => [emphaticCount(fs.readFileSync(f, 'utf8')), path.join(t, path.relative(abs, f))]);
    for (const [n, f] of rows.filter(([n]) => n > 0).sort((a, b) => b[0] - a[0])) console.log(`${n}\t${f}`);
  }
}

function main(argv) {
  const flag = (name) => {
    const i = argv.indexOf(name);
    if (i < 0) return undefined;
    const value = argv.splice(i, 2)[1];
    if (!value || value.startsWith('--')) throw new Error(`${name} needs a file path`);
    return value;
  };
  const baseline = flag('--baseline');
  const writeTo = flag('--write-baseline');
  const trees = expand(argv.filter((a) => !a.startsWith('--')));
  if (argv.includes('--metrics')) return printMetrics(trees), 0;
  if (argv.includes('--emphatic')) return printEmphatic(trees), 0;
  let findings = trees.flatMap(check);
  if (writeTo) {
    writeBaseline(path.resolve(writeTo), findings, trees);
    console.log(`Wrote ${writeTo}.`);
    findings = findings.filter((f) => f.criterion === 'A8' || f.criterion === 'pinned');
  } else if (baseline) {
    const recorded = readBaseline(path.resolve(baseline));
    const loose = looseEntries(findings, recorded, trees);
    findings = overBaseline(findings, recorded);
    for (const l of loose) findings.push({ file: l.file, line: 0, criterion: l.criterion, text: `baseline allows ${l.recorded}, file has ${l.now}: run --write-baseline to lower it` });
  }
  for (const f of findings) console.log(`${f.file}:${f.line}: [${f.criterion}] ${f.text}`);
  console.log(findings.length ? `\n${findings.length} finding(s).` : 'No findings.');
  return findings.length ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    console.error(`check-instruction-criteria: ${err.message}`);
    process.exit(2);
  }
}

module.exports = { measure, check, findingsOf, alwaysOnFiles, kindOf };
