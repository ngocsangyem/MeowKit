'use strict';
// host-evidence.cjs — which `mewkit host` commands are evidence of a passing check.
//
// `mewkit host run … -- <cmd>` exits with <cmd>'s own code when it ran to the end in the
// foreground, and 75 when it handed control back early, so a successful call means <cmd>
// passed: it counts as <cmd>. `--background` always exits 75 and never counts.
//
// `mewkit host jobs wait <id>` names no runner at all. It counts only when the job's own
// record says it ended with exit 0 (`exit` is 0, no `cancelled` marker) and the tree it ran
// on is the tree now; the credited class is the one the job recorded, never the command
// text. A lost, cancelled, still-running or failed job, or a tree changed since, counts as
// nothing. Dependency-free: bundled with the completion-check core.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MEWKIT = String.raw`(?:\S*[\\/])?mewkit(?:\.exe)?`;
const RUN = new RegExp(String.raw`^${MEWKIT}\s+host\s+run\b(.*?)\s--\s+(\S.*)$`);
const WAIT = new RegExp(String.raw`^${MEWKIT}\s+host\s+jobs\s+wait\s+([A-Za-z0-9-]{1,64})(?:\s+--timeout(?:=|\s+)\S+)?$`);
const CLASSES = new Set(['test', 'typecheck', 'lint', 'build']);

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
function finishedJob(command, home = os.homedir()) {
  const id = waitedJobId(command);
  if (!id) return null;
  const dir = path.join(home, '.meowkit', 'host', 'jobs', id);
  try {
    if (fs.readFileSync(path.join(dir, 'exit'), 'utf8').trim() !== '0') return null;
    if (fs.existsSync(path.join(dir, 'cancelled'))) return null;
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    if (!CLASSES.has(meta.cmd_class) || typeof meta.tree_digest !== 'string' || !meta.tree_digest) return null;
    return { cls: meta.cmd_class, digest: meta.tree_digest };
  } catch {
    return null;
  }
}

module.exports = { runInner, waitedJobId, finishedJob };
