#!/usr/bin/env node
'use strict';
// check-kit-verbs.cjs — every `mewkit <verb> <sub>` the shipped kit names resolves.
//
// Skills, agents and rules instruct an agent to run CLI verbs. A verb that was
// renamed or never existed fails at the worst moment: mid-session, inside a
// workflow the agent cannot finish, with an error the user did not ask for. A
// grep is enough to catch it, so it is a committed check rather than a review
// habit.
//
// Both halves of the reference are checked. A verb-only check passed a kit that
// told the agent to run a SUB-verb which had never existed: the verb resolved, the
// sub-verb was collected and thrown away, and the instruction failed mid-session.
// The second token is resolved whenever the verb declares sub-verbs; a flag in that
// position is a flag, not a misspelled sub-verb.
//
// Both lists are the CLI's own catalogue, imported from the build output, so adding
// a command or a sub-verb cannot leave this check stale.
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

/**
 * `mewkit x`, `mewkit x y`, `mewkit x --flag` — the shapes prose actually uses. The
 * second group is the sub-verb candidate and is empty when a flag or nothing follows.
 */
const CALL = /\b(?:npx\s+)?mewkit\s+([a-z][a-z0-9-]*)(?:\s+([a-z][a-z0-9-]*))?/g;

/**
 * Words that follow `mewkit`, or follow a verb, in prose rather than naming a command.
 * Each is a real occurrence in the tree, kept visible here rather than silently skipped.
 *
 * A word that is ALSO a real command must never appear in these lists: listing it would
 * silence every reference to that command, verb and sub-verb alike. `versions` and `skill`
 * were listed and are commands, so a stale `mewkit skill <sub>` could not have been caught;
 * `memory` was listed and is no longer a command, so a leftover reference to it would have
 * been hidden instead of reported.
 *
 * Most of these words read as prose in either position, so they are listed once and the two
 * sets add only what is specific to their own slot.
 */
const PROSE_EITHER_SLOT = [
  'is', 'and', 'to', 'in', 'on', 'the', 'a', 'as', 'at', 'for', 'from', 'it', 'its', 'of',
  'or', 'if', 'then', 'that', 'this', 'with', 'without', 'when', 'while', 'where', 'which',
  'can', 'cannot', 'does', 'did', 'will', 'would', 'must', 'should', 'may', 'run', 'runs',
  'ran', 'reads', 'writes', 'command', 'commands', 'verb', 'verbs', 'via',
];

/** Prose that continues after a verb without naming a sub-verb. */
const NOT_A_SUBCOMMAND = new Set([
  ...PROSE_EITHER_SLOT,
  'so', 'prints', 'records', 'reports', 'refuses', 'subcommand', 'subcommands', 'form',
  'output', 'first', 'before', 'after', 'again', 'already', 'never', 'always', 'only',
  'still', 'against', 'inside', 'into', 'over', 'per', 'and\u002Dthen',
]);

/** Prose that follows `mewkit` itself — mostly what a sentence calls the tool or the repo. */
const NOT_A_VERB = new Set([
  ...PROSE_EITHER_SLOT,
  'cli', 'has', 'have', 'had', 'repo', 'repository', 'project', 'projects', 'kit', 'install',
  'installed', 'installs', 'v', 'version', 'binary', 'package', 'workflow', 'workflows',
  'session', 'sessions', 'agent', 'agents', 'skills', 'hook', 'hooks', 'rule', 'rules',
  'own', 'they', 'under', 'who', 'why', 'but', 'by', 'not', 'no', 'you', 'your', 'we', 'us',
  'ships', 'shipped', 'tracks', 'tracked', 'runtime', 'sync', 'knows',
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'worktrees', 'logs']);
const EXTENSIONS = new Set(['.md', '.mdx', '.cjs', '.js', '.mjs', '.ts', '.sh', '.py', '.json', '.yml', '.yaml']);

function knownSurface() {
  if (!fs.existsSync(CATALOGUE)) {
    throw new Error('packages/mewkit/dist is not built; run `npm run build` first');
  }
  // eslint-disable-next-line global-require
  const { CLI_CATALOGUE } = require(CATALOGUE);
  const verbs = new Set();
  // Verb -> its declared sub-verbs. Absent from this map means "declares none", which
  // is why a second token after such a verb is prose rather than a miss.
  const subcommands = new Map();
  // Verbs whose declared usage shows a positional argument (`note <decisions|gotchas>`,
  // `migrate <tool>`). A word after one of those is a VALUE, not a sub-verb, so it cannot
  // be resolved against a list — the declaration is what tells the two apart.
  const takesArgument = new Set();
  for (const command of CLI_CATALOGUE.commands) {
    verbs.add(command.name);
    if (Array.isArray(command.subcommands) && command.subcommands.length > 0) {
      subcommands.set(command.name, new Set(command.subcommands));
    } else if (typeof command.usage === 'string' && command.usage.includes('<')) {
      takesArgument.add(command.name);
    }
  }
  // `CLI_CATALOGUE.aliases` is {h: 'help', v: 'version', y: 'yes'} — short names for
  // FLAGS, not commands. Folding them into the verb set made `mewkit h` resolve as a verb
  // nobody can run, and made the count this check prints disagree with the catalogue's own
  // command count that the generated manual is required to match.
  return { verbs, subcommands, takesArgument };
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

/** Every unresolved reference in the shipped kit, with the file and line naming it. */
function findUnresolved() {
  const { verbs, subcommands, takesArgument } = knownSurface();
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
        if (!verbs.has(verb)) {
          findings.push({ file: path.relative(ROOT, file), line: index + 1, verb, reference: `mewkit ${verb}` });
          continue;
        }
        const candidate = match[2];
        if (candidate === undefined || NOT_A_SUBCOMMAND.has(candidate)) continue;
        if (takesArgument.has(verb)) continue;
        // A verb that declares no sub-verbs cannot have a valid one, so naming a word
        // after it is a reference nobody can run — the same defect as a misspelled
        // sub-verb, and it has to fail the same way.
        const declared = subcommands.get(verb) ?? new Set();
        if (declared.has(candidate)) continue;
        findings.push({
          file: path.relative(ROOT, file),
          line: index + 1,
          verb,
          subcommand: candidate,
          reference: `mewkit ${verb} ${candidate}`,
        });
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
    const what = f.subcommand === undefined ? 'command' : `subcommand of \`${f.verb}\``;
    process.stdout.write(`${f.file}:${f.line}: \`${f.reference}\` does not resolve to a known ${what}\n`);
  }
  if (findings.length > 0) {
    process.stdout.write(`FAIL: ${findings.length} unresolved mewkit reference(s)\n`);
    return 1;
  }
  process.stdout.write(
    `PASS: ${calls} mewkit reference(s), verb and subcommand, all resolving against ${verbs.length} commands\n`
  );
  return 0;
}

module.exports = { findUnresolved, knownSurface };

if (require.main === module) process.exit(main(process.argv.slice(2)));
