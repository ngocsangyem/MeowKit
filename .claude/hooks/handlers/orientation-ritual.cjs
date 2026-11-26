// orientation-ritual.cjs — SessionStart handler: safe resume orientation.
//
// On resume/clear/compact (NOT fresh startup — that stays disabled until the release gate), it
// prefers the installed mewkit runtime: it runs the committed launcher `.meowkit/bin/mewkit`
// only after resolving it and checking it is a file inside the project (same realpath-both-sides
// containment the PATH exposure uses), then runs `orient --no-record` with a timeout to inject
// the bounded, control-stripped envelope the CLI renders. It NEVER calls bare `npx`, scans
// arbitrary parent node_modules, or trusts a missing binary. When the runtime is
// missing/untrusted/failed, it falls back to the checkpoint cache — explicitly LABELED as
// fallback, never presented as recovered orientation.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const CLAUDE_DIR = path.join(ROOT, '.claude');
const { LATEST_READ_FILE, gitHead } = require(
  path.join(CLAUDE_DIR, 'hooks', 'lib', 'checkpoint-utils.cjs')
);
const { exposeLauncherOnPath, containedLauncher } = require(
  path.join(CLAUDE_DIR, 'hooks', 'lib', 'launcher-path-env.cjs')
);

// Run the installed runtime's bounded orientation. Read-only (`--no-record`), timeout-bounded;
// any failure returns null so the caller falls back.
function orientViaRuntime(exe) {
  try {
    const out = execFileSync(exe, ['orient', '--no-record'], {
      cwd: ROOT,
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
    return out.length ? out : null;
  } catch {
    return null;
  }
}

function safePlanPath(p) {
  if (!p || typeof p !== 'string') return null;
  if (p.includes('..')) return null;
  if (/[\x00-\x1f]/.test(p)) return null;
  return p;
}

// What a session is told when a trusted executable exists but could not answer, and there is
// no checkpoint either. Labeled like the fallback: it reports a reachability fact, never
// orientation.
const UNREACHABLE_RUNTIME =
  '[orientation unavailable: the installed runtime did not answer — run `mewkit doctor`]';

// Checkpoint fallback — the pre-runtime resume summary, LABELED so it is never mistaken for a
// live orientation from durable state.
function checkpointFallback() {
  let checkpoint;
  try {
    checkpoint = JSON.parse(fs.readFileSync(LATEST_READ_FILE, 'utf8'));
  } catch {
    return '';
  }
  const currentHash = gitHead();
  const checkpointHash = checkpoint.environment && checkpoint.environment.last_commit_hash;
  const lines = ['[orientation fallback: installed runtime unavailable — checkpoint cache, verify live before acting]'];
  lines.push(`Resuming session (checkpoint #${checkpoint.sequence})`);
  const plan = safePlanPath(checkpoint.progress && checkpoint.progress.plan_path);
  if (plan) lines.push(`Active plan: ${plan}`);
  const branch = (checkpoint.environment && checkpoint.environment.git_branch) || 'unknown';
  lines.push(`Git: ${branch} @ ${currentHash === null ? 'unknown' : currentHash}`);
  if (checkpointHash && currentHash !== null && checkpointHash !== currentHash) {
    lines.push(`WARNING: git hash changed since checkpoint (was ${checkpointHash}, now ${currentHash}).`);
  }
  lines.push('Build state: unknown (verify on first tool use)');
  return lines.join('\n') + '\n';
}

module.exports = function orientationRitual(ctx) {
  const source = (ctx && ctx.source) || 'startup';

  // Make the bare `mewkit` form resolve for this session's shell commands. Deliberately
  // independent of orientation: it applies on every session source, including the fresh
  // startup that prints no orientation at all, and orientation itself reaches the CLI
  // through the launcher's project path rather than through PATH. A note comes back only when
  // the bare form could not be exposed.
  const pathNote = exposeLauncherOnPath({ projectRoot: ROOT });

  // Fresh startup orientation stays disabled until the release gate proves the runtime +
  // latency, and that silence includes this note: the PATH write above has already happened,
  // so the bare form works either way, and a startup session that prints one line would be
  // the fresh-startup output this handler is specifically not supposed to produce yet.
  if (source === 'startup') return '';

  const prefix = pathNote ? pathNote + '\n' : '';

  // Preferred path: bounded orientation from the committed launcher at its known
  // project-relative path. `containedLauncher` resolves symlinks on both sides and refuses a
  // target outside the project, so a clone runs its own launcher and nothing else.
  const launcher = containedLauncher(ROOT);
  const attempted = Boolean(launcher);
  if (launcher) {
    const oriented = orientViaRuntime(launcher);
    if (oriented) return prefix + oriented + '\n';
  }

  // Otherwise: labeled checkpoint fallback (never claimed as recovered orientation).
  const fallback = checkpointFallback();
  if (fallback) return prefix + fallback;

  // Nothing to fall back to AND an executable that did not answer — the case a fresh clone
  // hits when the pinned CLI is not on this machine. Staying silent here would read as
  // "nothing to resume", which is a different fact from "the CLI could not be reached", so
  // say which one it is and name the command that explains it.
  if (attempted) return `${prefix}${UNREACHABLE_RUNTIME}\n`;
  return prefix;
};
