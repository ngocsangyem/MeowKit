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

function gitTopLevel(cwd) {
  const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', timeout: 2000 });
  if (result.status !== 0 || typeof result.stdout !== 'string') return null;
  // git prints forward slashes on Windows; resolve to the platform form the variable branch returns.
  const top = result.stdout.trim();
  return top !== '' && isDirectory(top) ? path.resolve(top) : null;
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

/** Resolve the guard root and make it the working directory; null when either step fails. */
function enterGuardRoot(cwd = process.cwd(), env = process.env) {
  const root = resolveGuardRoot(env, cwd);
  if (!root) return null;
  try {
    process.chdir(root);
    return root;
  } catch {
    return null;
  }
}

module.exports = { enterGuardRoot, resolveGuardRoot, resolveProjectRoot };
