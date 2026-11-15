#!/usr/bin/env node
'use strict';
// check-instruction-criteria.cjs — run the mechanical instruction audit criteria over the
// kit's instruction text on every runtime it ships to.
//
// Usage:
//   node scripts/check-instruction-criteria.cjs [tree ...]       check; exit 1 on a finding
//   node scripts/check-instruction-criteria.cjs --metrics [tree ...]  print the metrics table
//
// A tree is `.claude` or a bundle root such as `kit/bundles/codex/root`; `kit/bundles`
// expands to both bundle roots. With no tree, all three are checked.
// Criteria and their scope: docs/maintainer/instruction-audit-criteria.md.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { checkFile, emphaticCount, gatePhraseCount, pinnedText } = require('./lib/instruction-criteria-rules.cjs');

const REPO = path.resolve(__dirname, '..');
const DEFAULT_TREES = ['.claude', 'kit/bundles/codex/root', 'kit/bundles/cursor/root'];
const TEXT_EXT = new Set(['.md', '.mdc', '.toml']);
const SKIP_DIRS = new Set(['node_modules', '__tests__', '.venv', 'worktrees', 'logs', 'cache', 'session-state', 'agent-memory', 'memory']);

/** sha256 of the blocked-pattern table plus the numbered injection rules (must not change). */
const PINNED_SHA256 = 'e0b639506d83aff3e9040f3fdbfad35c016ee46ff701ad2f1daff04ced2461fa';

/**
 * Always-on bytes per tree may only shrink. Claude Code loads every rule file; the bundles
 * load their root AGENTS.md (Cursor's .mdc rules are all agent-requested or glob-scoped).
 */
const ALWAYS_ON_CEILING = { '.claude': 18500, 'kit/bundles/codex/root': 7745, 'kit/bundles/cursor/root': 4688 };

function expand(trees) {
  const out = [];
  for (const t of trees.length ? trees : DEFAULT_TREES) {
    const norm = t.replace(/\/+$/, '');
    if (norm === 'kit/bundles') out.push('kit/bundles/codex/root', 'kit/bundles/cursor/root');
    else out.push(norm);
  }
  return out;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out);
    } else if (TEXT_EXT.has(path.extname(entry.name))) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function alwaysOnFiles(tree) {
  const abs = path.join(REPO, tree);
  if (tree === '.claude') {
    const rules = path.join(abs, 'rules');
    return fs.readdirSync(rules).filter((f) => f.endsWith('.md')).map((f) => path.join(rules, f));
  }
  const agents = path.join(abs, 'AGENTS.md');
  return fs.existsSync(agents) ? [agents] : [];
}

function measure(tree) {
  const abs = path.join(REPO, tree);
  const files = walk(abs);
  let gate = 0;
  let emphatic = 0;
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    gate += gatePhraseCount(path.relative(abs, f), text);
    emphatic += emphaticCount(text);
  }
  const alwaysOn = alwaysOnFiles(tree).reduce((n, f) => n + fs.statSync(f).size, 0);
  return { tree, files: files.length, alwaysOn, gate, emphatic };
}

function check(tree) {
  const abs = path.join(REPO, tree);
  const findings = [];
  for (const f of walk(abs)) {
    const rel = path.relative(abs, f);
    for (const x of checkFile(rel, fs.readFileSync(f, 'utf8'), abs)) findings.push({ file: path.join(tree, rel), ...x });
  }
  const { alwaysOn } = measure(tree);
  if (alwaysOn > ALWAYS_ON_CEILING[tree]) {
    findings.push({ file: tree, line: 0, criterion: 'A8', text: `always-on text is ${alwaysOn} B, above the ${ALWAYS_ON_CEILING[tree]} B ceiling` });
  }
  if (tree === '.claude') {
    const sha = crypto.createHash('sha256').update(pinnedText(abs)).digest('hex');
    if (sha !== PINNED_SHA256) findings.push({ file: tree, line: 0, criterion: 'pinned', text: 'the blocked-pattern table or the numbered injection rules changed' });
  }
  return findings;
}

function main(argv) {
  const metrics = argv.includes('--metrics');
  const trees = expand(argv.filter((a) => !a.startsWith('--')));
  if (metrics) {
    console.log('| Tree | Text files | Always-on bytes | Gate phrases | Emphatic tokens |');
    console.log('|---|---|---|---|---|');
    for (const t of trees) {
      const m = measure(t);
      console.log(`| ${m.tree} | ${m.files} | ${m.alwaysOn} | ${m.gate} | ${m.emphatic} |`);
    }
    return 0;
  }
  const findings = trees.flatMap(check);
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

module.exports = { measure, check };
