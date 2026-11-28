'use strict';
// host-evidence.cjs — which `mewkit host` commands are evidence of a passing check.
//
// `mewkit host run … -- <cmd>` (or the `mk` alias) exits with <cmd>'s own code when it ran to the end in the
// foreground, and 75 when it handed control back early, so a successful call means <cmd>
// passed: it counts as <cmd>. `--background` always exits 75 and never counts.
//
// `mewkit host jobs wait <id>` names no runner at all. It counts only when the job's own
// record says it ended with exit 0 (`exit` is 0, no `cancelled` marker) and the tree it ran
// on (recorded by the supervisor, unchanged from the command's start to its exit) is the
// tree now, in this same worktree; the credited class is the one the job recorded, never the command
// text. A lost, cancelled, still-running or failed job, or a tree changed since, counts as
// nothing. Dependency-free: bundled with the completion-check core.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MEWKIT = String.raw`(?:\S*[\\/])?(?:mewkit|mk)(?:\.exe)?`;
const RUN = new RegExp(String.raw`^${MEWKIT}\s+host\s+run\b(.*?)\s--\s+(\S.*)$`);
const TIMEOUT = String.raw`--timeout(?:=|\s+)\S+`;
const WAIT = new RegExp(String.raw`^${MEWKIT}\s+host\s+jobs\s+wait(?:\s+${TIMEOUT})?\s+([A-Za-z0-9-]{1,64})(?:\s+${TIMEOUT})?$`);
const CLASSES = new Set(['test', 'typecheck', 'lint', 'build']);

/** Same spelling as the Rust side (`host::worktree::normalize`); shared fixture keeps them equal. */
function normalize(p) {
  const unified = String(p).replace(/\\/g, '/');
  let prefix = '';
  let rest = unified;
  if (/^[A-Za-z]:/.test(unified)) {
    prefix = `${unified[0].toLowerCase()}:`;
    rest = unified.slice(2);
  }
  const absolute = rest.startsWith('/');
  const parts = [];
  for (const seg of rest.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  const joined = parts.join('/');
  if (absolute) return joined ? `${prefix}/${joined}` : `${prefix}/`;
  return `${prefix}${joined}`;
}

/** The worktree root above `dir` (a `.git` dir or file), real path, or null. */
function worktreeOf(dir) {
  let cur = path.resolve(dir);
  for (;;) {
    if (fs.existsSync(path.join(cur, '.git'))) {
      try { return fs.realpathSync(cur); } catch { return cur; }
    }
    const up = path.dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
}


/** The command a foreground `mewkit host run … -- <cmd>` ran, or null. */
function runInner(segment) {
  const m = RUN.exec(segment.trim());
  if (!m || /(?:^|\s)--background\b/.test(m[1])) return null;
  return m[2].trim();
}

/** The job id of a `mewkit host jobs wait <id>` command, or null. */
function waitedJobId(command) {
  const m = typeof command === 'string' ? WAIT.exec(command.trim()) : null;
  return m ? m[1] : null;
}

/**
 * `{ cls, digest }` for a `jobs wait` whose job ended done(0) with a recorded class and tree
 * digest; null for anything else, including a command that is not a `jobs wait`.
 */
function finishedJob(command, home = os.homedir(), root = null) {
  const id = waitedJobId(command);
  if (!id) return null;
  // Two clean clones at one commit share a digest, so the job must also have run in this
  // worktree: another project's job is never credited here.
  const here = root ? worktreeOf(root) : null;
  const dir = path.join(home, '.meowkit', 'host', 'jobs', id);
  try {
    if (fs.readFileSync(path.join(dir, 'exit'), 'utf8').trim() !== '0') return null;
    if (fs.existsSync(path.join(dir, 'cancelled'))) return null;
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    // ran_tree_digest is the tree the command ran on, the same at its start and exit;
    // tree_digest is only the tree at enqueue, which may have changed while it waited.
    const ran = meta.ran_tree_digest;
    if (!CLASSES.has(meta.cmd_class) || typeof ran !== 'string' || !ran) return null;
    if (!here || typeof meta.worktree !== 'string' || normalize(meta.worktree) !== normalize(here)) return null;
    return { cls: meta.cmd_class, digest: ran };
  } catch {
    return null;
  }
}

module.exports = { runInner, waitedJobId, finishedJob, normalize, worktreeOf };
