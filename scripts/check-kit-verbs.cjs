#!/usr/bin/env node
'use strict';
// check-kit-verbs.cjs — every `mewkit <verb>` the shipped kit names resolves.
//
// Skills, agents and rules instruct an agent to run CLI verbs. A verb that was
// renamed or never existed fails at the worst moment: mid-session, inside a
// workflow the agent cannot finish, with an error the user did not ask for. A
// grep is enough to catch it, so it is a committed check rather than a review
// habit.
//
// The verb list is the CLI's own catalogue, imported from the build output, so
// adding a command cannot leave this check stale.
//
//   node scripts/check-kit-verbs.cjs [--json]

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
// The SHIPPED kit only. `docs/` and `packages/docs/` carry changelogs and
// review records naming verbs that existed at the time and do not now; those are
// historical record, and rewriting them would falsify what a past release had.
// A stale verb there misleads a reader; a stale verb in a skill breaks a session.
const TREES = ['.claude'];
const CATALOGUE = path.join(ROOT, 'packages', 'mewkit', 'dist', 'cli', 'command-catalogue.js');

/** `npx mewkit x`, `mewkit x`, `mewkit x --flag` — the shapes prose actually uses. */
const CALL = /\b(?:npx\s+)?mewkit\s+([a-z][a-z0-9-]*)/g;

/**
 * Words that follow `mewkit` in prose without being verbs. Each is a real
 * occurrence in the tree, kept visible here rather than silently skipped.
 */
const NOT_A_VERB = new Set([
  'cli', 'is', 'and', 'to', 'in', 'on', 'the', 'a', 'as', 'at', 'for', 'from', 'it', 'its',
  'does', 'did', 'will', 'would', 'can', 'cannot', 'has', 'have', 'had', 'run', 'runs', 'ran',
  'repo', 'repository', 'project', 'projects', 'kit', 'install', 'installed', 'installs',
  'command', 'commands', 'verb', 'verbs', 'v', 'version', 'versions', 'binary', 'package',
  'workflow', 'workflows', 'session', 'sessions', 'agent', 'agents', 'skill', 'skills',
  'hook', 'hooks', 'rule', 'rules', 'memory', 'own', 'this', 'that', 'then', 'they', 'with',
  'without', 'under', 'via', 'when', 'where', 'which', 'while', 'who', 'why', 'but', 'by',
  'not', 'no', 'or', 'of', 'if', 'you', 'your', 'we', 'us', 'may', 'must', 'should',
  'ships', 'shipped', 'tracks', 'tracked', 'runtime', 'sync', 'knows', 'reads', 'writes',
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'worktrees', 'logs']);
const EXTENSIONS = new Set(['.md', '.mdx', '.cjs', '.js', '.mjs', '.ts', '.sh', '.py', '.json', '.yml', '.yaml']);

function knownVerbs() {
  if (!fs.existsSync(CATALOGUE)) {
    throw new Error('packages/mewkit/dist is not built; run `npm run build` first');
  }
  // eslint-disable-next-line global-require
  const { CLI_CATALOGUE } = require(CATALOGUE);
  const verbs = new Set();
  for (const command of CLI_CATALOGUE.commands) verbs.add(command.name);
  for (const alias of Object.keys(CLI_CATALOGUE.aliases ?? {})) verbs.add(alias);
  return verbs;
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (EXTENSIONS.has(path.extname(abs))) out.push(abs);
  }
}

/** Every unresolved verb in the shipped kit, with the file and line naming it. */
function findUnresolved() {
  const verbs = knownVerbs();
  const files = [];
  for (const tree of TREES) walk(path.join(ROOT, tree), files);

  const findings = [];
  let calls = 0;
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(CALL)) {
        const verb = match[1];
        if (NOT_A_VERB.has(verb)) continue;
        calls += 1;
        if (verbs.has(verb)) continue;
        findings.push({ file: path.relative(ROOT, file), line: index + 1, verb });
      }
    });
  }
  return { findings, calls, verbs: [...verbs].sort() };
}

function main(argv) {
  const { findings, calls, verbs } = findUnresolved();
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ ok: findings.length === 0, calls, verbs, findings }, null, 2)}\n`);
    return findings.length === 0 ? 0 : 1;
  }
  for (const f of findings) {
    process.stdout.write(`${f.file}:${f.line}: \`mewkit ${f.verb}\` does not resolve to a subcommand\n`);
  }
  if (findings.length > 0) {
    process.stdout.write(`FAIL: ${findings.length} unresolved mewkit verb(s)\n`);
    return 1;
  }
  process.stdout.write(`PASS: ${calls} mewkit verb reference(s), all resolving to one of ${verbs.length} subcommands\n`);
  return 0;
}

module.exports = { findUnresolved, knownVerbs };

if (require.main === module) process.exit(main(process.argv.slice(2)));
