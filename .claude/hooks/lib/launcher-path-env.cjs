'use strict';
// launcher-path-env.cjs — make the bare `mewkit` form resolve in the agent's shell.
//
// The kit tells the agent to run `mewkit plan approve …`. That name only resolves if it is
// on PATH, and an install leaves it in the project rather than on the machine. The host
// offers exactly one committed way to set a variable for later shell commands: a SessionStart
// hook appends an assignment to the file named by CLAUDE_ENV_FILE, whose contents the host
// runs before each subsequent Bash command.
//
// Four properties below are not preferences — each is a failure mode of the mechanism:
//
//   * APPEND, never truncate. Every hook in the session shares this file; truncating it
//     deletes variables another hook set.
//   * The value is FULLY EXPANDED, with no `$PATH` left in it. A line containing an
//     unexpanded `$PATH` costs PowerShell commands every variable any hook set, so the
//     convenient form breaks unrelated tooling rather than just this one.
//   * The directory is PREPENDED and contains only the launcher, so a project's pinned
//     version wins over a global install while `git`, `node` and everything else still
//     resolve exactly where they did before.
//   * No CLAUDE_ENV_FILE, or a write that fails, means the bare form is unavailable — which
//     is reported with a next action rather than left to fail later inside a tool call. The
//     hook path does not depend on this: hooks reach the CLI through the runtime descriptor,
//     so orientation, Gate 1 and Gate 2 behave identically with or without it.
//
// Windows PowerShell is a non-target by construction: the host does not pass PowerShell a
// variable whose value contains a path separator, so there the hint is the whole answer.

const fs = require('fs');
const path = require('path');

const LAUNCHER_REL = path.join('.meowkit', 'bin', 'mewkit');
const HINT = 'Run `mewkit doctor` to see why the bare `mewkit` form is unavailable in this shell.';

/**
 * The launcher itself, only when it really is a file inside this project.
 *
 * A clone needs this: the runtime descriptor records an absolute path, so the copy a
 * teammate checks out names the directory the kit was installed in, not theirs, and the
 * containment check correctly refuses it. The launcher is committed at a known
 * project-relative location, so it can be found without trusting any recorded path — and
 * it is still subject to the same containment rule, so finding it this way grants nothing
 * the descriptor path would not have granted.
 */
function containedLauncher(projectRoot) {
  let realLauncher;
  let realRoot;
  try {
    realLauncher = fs.realpathSync(path.join(projectRoot, LAUNCHER_REL));
    realRoot = fs.realpathSync(projectRoot);
    if (!fs.statSync(realLauncher).isFile()) return null;
  } catch {
    return null;
  }
  // Same containment rule the runtime descriptor uses: resolve both sides, then require the
  // real target to stay inside the real project root.
  const rel = path.relative(realRoot, realLauncher);
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
  return realLauncher;
}

/**
 * Quote a value so the shell reads every byte of it literally.
 *
 * Single quotes, not double: inside double quotes a shell still expands `$VAR`, `${…}`,
 * `$(…)` and backticks, and a `"` or trailing backslash breaks the quoting outright. The
 * value here is assembled from PATH entries and from the project directory's own name, and a
 * directory name is attacker-chosen often enough — a clone named from a hostile URL, an
 * archive unpacked into a crafted path — that "the inputs are ours" is not a safe premise.
 * Inside single quotes the only byte that needs care is `'` itself, closed and re-opened the
 * standard way.
 */
function singleQuote(value) {
  return `'${value.split("'").join("'\\''")}'`;
}

/**
 * Append the PATH assignment for this project's launcher. Returns a short note when the
 * bare form could not be made to resolve, and an empty string when it could.
 */
function exposeLauncherOnPath(options = {}) {
  const projectRoot = options.projectRoot || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const envFile = options.envFile === undefined ? process.env.CLAUDE_ENV_FILE : options.envFile;
  const currentPath = options.path === undefined ? process.env.PATH || '' : options.path;

  const launcher = containedLauncher(projectRoot);
  if (!launcher || !envFile) return HINT;
  const dir = path.dirname(launcher);

  // Already first: adding the line again every session would grow the file without changing
  // what it means.
  const entries = currentPath.split(path.delimiter).filter(Boolean);
  if (entries[0] === dir) return '';

  const value = [dir, ...entries.filter((entry) => entry !== dir)].join(path.delimiter);

  // A newline or NUL cannot be written as one assignment at all, so there is nothing to
  // quote: refuse and leave the bare form unavailable rather than append a line whose second
  // half the shell would read as a command.
  if (/[\n\r\0]/.test(value)) return HINT;

  try {
    fs.appendFileSync(envFile, `export PATH=${singleQuote(value)}\n`, 'utf8');
  } catch {
    return HINT;
  }
  return '';
}

module.exports = { exposeLauncherOnPath, containedLauncher, singleQuote, LAUNCHER_REL, HINT };
