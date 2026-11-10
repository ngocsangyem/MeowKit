#!/usr/bin/env node
'use strict';

/**
 * skill-python.cjs — run a skill's Python script in that skill's own environment.
 *
 * Usage:
 *   node .cursor/scripts/skill-python.cjs <script.py> [args...]
 *   node .cursor/scripts/skill-python.cjs --skill <name> -m pytest [args...]
 *
 * Every documented Python invocation in the kit goes through here instead of
 * naming an interpreter path directly. Two reasons:
 *
 *   The interpreter moved, and will move again. One resolver means a relocation
 *   is one edit, not an edit in every step file that happens to call Python.
 *
 *   A missing environment has to produce an ANSWER, not a crash. Naming the
 *   interpreter path directly means the shell reports "no such file" and the
 *   user is left to work out which of ~120 skills wanted what. This prints the
 *   skill, the requirement it declares, and the one command that fixes it.
 *
 * It never installs anything. Provisioning is a thing a user asks for by name;
 * a script that silently built an environment mid-task would make an optional
 * runtime mandatory again, just later and less visibly.
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ENVS_REL = path.join('.meowkit', 'envs');

/**
 * Kit directories this resolver looks under, in lookup order. The projection
 * ships the directory this runtime actually installs, so the list names only
 * that one — a lookup in a directory this runtime never creates would be a
 * fabricated path.
 */
const KIT_DIRS = ['.cursor'];

/** Walk up for the project root — the directory holding a kit directory. */
function findProjectRoot(start) {
  if (process.env.PROJECT_ROOT) return process.env.PROJECT_ROOT;
  let dir = path.resolve(start);
  for (;;) {
    if (KIT_DIRS.some((kit) => fs.existsSync(path.join(dir, kit)))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

/**
 * Which skill is being run, taken from the script path rather than an argument.
 *
 * Deriving it means the call sites needed only their interpreter prefix
 * swapped — a mechanical change across many files — instead of each one
 * learning to name its own skill, which is a thing a copied line gets wrong.
 */
function skillFromArgs(argv) {
  const flag = argv.indexOf('--skill');
  if (flag !== -1 && argv[flag + 1]) return { skill: argv[flag + 1], rest: [...argv.slice(0, flag), ...argv.slice(flag + 2)] };
  for (const arg of argv) {
    // Any provider's skills directory, not just this one's: the projections
    // place the same skills under `.agents/skills/` and `.cursor/skills/`, and a
    // resolver that only knew one of them would fail in the other two.
    const match = /(?:^|[/\\])\.[a-z][a-z0-9-]*[/\\]skills[/\\](?:mk-)?([^/\\]+)[/\\]/.exec(arg);
    if (match) return { skill: match[1], rest: argv };
  }
  return { skill: null, rest: argv };
}

/**
 * Read `requires_runtime` from the skill's frontmatter, for the diagnostic.
 *
 * Tries every kit directory and both naming conventions: the projections install
 * the same skill as `mk-<name>`, and a diagnostic that only found the authored
 * layout would silently drop the interpreter requirement from the message in
 * exactly the environments that are hardest to debug.
 */
function declaredRuntime(root, skill) {
  for (const kit of KIT_DIRS) {
    for (const dirName of [skill, `mk-${skill}`]) {
      try {
        const text = fs.readFileSync(path.join(root, kit, 'skills', dirName, 'SKILL.md'), 'utf8');
        const match = /^requires_runtime:\s*\[?([^\]\n]+)\]?\s*$/m.exec(text);
        if (match) return match[1].trim().replace(/["']/g, '');
      } catch {
        // Not installed under this kit directory or this name — try the next.
      }
    }
  }
  return null;
}

function hasSystemPython() {
  for (const candidate of ['python3', 'python', 'py']) {
    const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', [candidate], { stdio: 'ignore' });
    if (probe.status === 0) return true;
  }
  return false;
}

/**
 * The remediation message. Deliberately exact and copy-pasteable: the point of
 * failing here rather than inside Python is that the user gets a command, not a
 * stack trace.
 */
function reportMissing(root, skill, reason) {
  const runtime = declaredRuntime(root, skill);
  const lines = [`[${skill}] ${reason}`, ''];
  if (!hasSystemPython()) {
    lines.push(
      `No Python interpreter is installed, and ${skill} requires ${runtime || 'python'}.`,
      `Install it, then run:`,
      '',
      `    mewkit skill env ${skill}`,
    );
  } else {
    lines.push(`${skill} needs its own environment at ${path.join(ENVS_REL, skill)}. Create it with:`, '', `    mewkit skill env ${skill}`);
  }
  lines.push('', `This command installs only the packages ${skill} pins. It is never run for you.`, '');
  process.stderr.write(`${lines.join('\n')}\n`);
}

function main(argv) {
  if (!argv.length) {
    process.stderr.write('usage: skill-python.cjs <script.py> [args...]\n       skill-python.cjs --skill <name> -m <module> [args...]\n');
    return 2;
  }

  const { skill, rest } = skillFromArgs(argv);
  const root = findProjectRoot(process.cwd());

  if (!skill) {
    process.stderr.write(
      'skill-python.cjs could not tell which skill this is for.\n' +
        'Pass a script path under a skills/<skill>/ directory, or name it with --skill <skill>.\n',
    );
    return 2;
  }

  const envDir = path.join(root, ENVS_REL, skill);
  const python = process.platform === 'win32' ? path.join(envDir, 'Scripts', 'python.exe') : path.join(envDir, 'bin', 'python3');

  if (!fs.existsSync(envDir)) {
    reportMissing(root, skill, 'no interpreter environment');
    return 1;
  }
  // An environment whose directory survived but whose interpreter did not gets
  // the same message: to every caller the two states are the same state.
  if (!fs.existsSync(python)) {
    reportMissing(root, skill, 'environment present but its interpreter is missing');
    return 1;
  }

  const run = spawnSync(python, rest, { stdio: 'inherit', cwd: process.cwd() });
  if (run.error) {
    process.stderr.write(`[${skill}] could not start ${python}: ${run.error.message}\n`);
    return 1;
  }
  return run.status === null ? 1 : run.status;
}

process.exit(main(process.argv.slice(2)));
