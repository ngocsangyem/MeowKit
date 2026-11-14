'use strict';
// project-root.cjs — the project root a skill script acts on, the same way on every runtime.
//
// Order: MEOWKIT_PROJECT_DIR (set by whoever launches the script for a runtime that supplies
// no variable of its own) → CLAUDE_PROJECT_DIR (Claude Code) → CURSOR_PROJECT_DIR (Cursor) →
// the git top level of the working directory → the working directory. A variable that does
// not name an existing directory is skipped rather than trusted: a stale or hostile value
// must not move a guard's checks onto some other tree.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

/**
 * The root variables' values, in precedence order. Read by name, not through a list of names,
 * so a static scan of what a guard reads from the environment sees every one of them.
 */
const rootValues = (env) => [env.MEOWKIT_PROJECT_DIR, env.CLAUDE_PROJECT_DIR, env.CURSOR_PROJECT_DIR];

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** One `git rev-parse` query from `cwd`, trimmed; null when git fails or prints nothing. */
function revParse(cwd, args) {
  const result = spawnSync('git', ['rev-parse', ...args], { cwd, encoding: 'utf8', timeout: 2000 });
  if (result.status !== 0 || typeof result.stdout !== 'string') return null;
  const out = result.stdout.trim();
  return out === '' ? null : out;
}

function gitTopLevel(cwd) {
  // git prints forward slashes on Windows; resolve to the platform form the variable branch returns.
  const top = revParse(cwd, ['--show-toplevel']);
  return top !== null && isDirectory(top) ? path.resolve(top) : null;
}

function resolveProjectRoot(env = process.env, cwd = process.cwd()) {
  for (const value of rootValues(env)) {
    if (typeof value === 'string' && value.trim() !== '' && isDirectory(value)) return path.resolve(value);
  }
  return gitTopLevel(cwd) || cwd;
}

/**
 * The root a safety guard evaluates against, or null when there is none it can trust.
 *
 * Stricter than resolveProjectRoot on purpose: a guard that guesses its root checks the wrong
 * tree and allows what it should block. A root variable that is set but names no directory is
 * a failure, not a cue to try the next source, and the working directory is never a fallback.
 * Nor is a marker directory: `.codex/` and `.cursor/` also exist in a home directory, so a
 * walk up for one would make a stray session's root the user's home.
 */
function resolveGuardRoot(env = process.env, cwd = process.cwd()) {
  for (const value of rootValues(env)) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    return isDirectory(value) ? path.resolve(value) : null;
  }
  return gitTopLevel(cwd);
}

/** `p` as a real path, or null when it cannot be resolved. */
function realPath(p) {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return null;
  }
}

/** The repository's shared git directory as a real path, or null outside git. */
function gitCommonDir(cwd) {
  const dir = revParse(cwd, ['--path-format=absolute', '--git-common-dir']);
  return dir === null ? null : realPath(dir);
}

// Anything that can move git onto another tree without naming it plainly: substitution,
// variables, nested shells, eval, a directory stack, chdir in any tool, a bare `cd` (home),
// or git's own location overrides.
const OPAQUE_REDIRECT = /[`$]|\beval\b|\bexec\b|\bsource\b|\b(?:ba|z|da|k)?sh\b|\bpushd\b|\bpopd\b|chdir|\bcd\s*(?:$|[;&|)])|--git-dir|--work-tree|core\.worktree|\bGIT_DIR\b|\bGIT_WORK_TREE\b/;
// The plain ways a command names another directory: `cd <dir>` and `-C <dir>` / `-C<dir>`.
const NAMED_DIR = /(?:\bcd\s+|\s-C\s*)("[^"]*"|'[^']*'|[^\s;&|()]+)/g;

/** The directories a command names with `cd`/`-C`, resolved against `cwd`; null if unreadable. */
function namedDirectories(command, cwd) {
  const dirs = [];
  for (const match of command.matchAll(NAMED_DIR)) {
    const raw = match[1].replace(/^(["'])(.*)\1$/, '$2');
    if (raw === '' || raw.startsWith('~') || raw === '-') return null;
    // `..` after a symlink climbs out of where the link points, not out of the link (git -C is
    // physical), so a lexical resolve can name a tree other than the one git enters.
    if (raw.split(/[\\/]/).includes('..')) return null;
    dirs.push(path.resolve(cwd, raw));
  }
  return dirs;
}

/**
 * The root the ship guard evaluates: the guard root, unless the command plainly acts on a
 * linked worktree of that same repository, in which case that worktree's top level.
 *
 * A commit or push acts on the work tree it runs in. In a worktree session the project-dir
 * variable still names the main checkout, so judging the ship there checks another branch's
 * HEAD, changes and plan pointer, and blocks (or clears) this ship on that branch's paperwork.
 *
 * Neither the working directory nor the command decides alone: an agent picks both, and could
 * stand in a clean worktree while `git -C <main> commit` lands in the main checkout, or name a
 * clean worktree while committing in main. So the working directory's tree and every tree the
 * command names with `cd`/`-C` must be one and the same linked worktree — and whenever that
 * cannot be read with certainty (shell indirection, git location overrides, an
 * unrelated repository, a git too old for --path-format) the guard root is kept, exactly as
 * before this function existed.
 */
function resolveShipRoot(env = process.env, cwd = process.cwd(), command = '') {
  const root = resolveGuardRoot(env, cwd);
  if (!root) return null;
  if (OPAQUE_REDIRECT.test(command)) return root;
  const named = namedDirectories(command, cwd);
  if (named === null) return root;
  // The working directory always votes too: a named tree only counts when it is the same one,
  // so mentioning a clean worktree (in `-C <wt> status`, or a commit message) changes nothing.
  const tops = new Set([cwd, ...named].map((dir) => realPath(gitTopLevel(dir) || '')));
  if (tops.size !== 1 || tops.has(null)) return root;
  const [top] = tops;
  const rootReal = realPath(root);
  // A symlinked spelling of the root (macOS /var vs /private/var) is the root itself.
  if (rootReal === null || top === rootReal) return root;
  const shared = gitCommonDir(top);
  return shared !== null && shared === gitCommonDir(root) ? top : root;
}

/** Resolve the guard root and make it the working directory; null when either step fails. */
function enterGuardRoot(cwd = process.cwd(), env = process.env, resolve = resolveGuardRoot, command = '') {
  const root = resolve(env, cwd, command);
  if (!root) return null;
  try {
    process.chdir(root);
    return root;
  } catch {
    return null;
  }
}

module.exports = { enterGuardRoot, resolveGuardRoot, resolveProjectRoot, resolveShipRoot };
