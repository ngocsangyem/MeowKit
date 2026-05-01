// orientation-ritual.cjs — SessionStart handler: resume from checkpoint.
// On session resume, loads latest checkpoint and injects context.
// Skips build check (record build_state: unknown, agent verifies lazily).
//
// SessionStart stdin has `source` field: startup|resume|clear|compact
// Only runs full ritual on resume/clear/compact. Fresh startup skipped.

const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const { LATEST_FILE, gitHead } = require(
  path.join(ROOT, '.claude', 'hooks', 'lib', 'checkpoint-utils.cjs')
);

// Reject path traversal and control-char injection in untrusted plan_path field
// before emitting it into stdout (Claude Code injects as system context).
// Plan paths are canonically absolute (set-active-plan resolves them), so we do
// NOT reject absolute paths — only `..` traversal and control chars.
function safePlanPath(p) {
  if (!p || typeof p !== 'string') return null;
  if (p.includes('..')) return null;
  if (/[\x00-\x1f]/.test(p)) return null;
  return p;
}

module.exports = function orientationRitual(ctx, state) {
  const source = ctx.source || 'startup';
  if (source === 'startup') return '';

  let checkpoint;
  try {
    checkpoint = JSON.parse(fs.readFileSync(LATEST_FILE, 'utf8'));
  } catch {
    return '';
  }

  // Verify git state
  const currentHash = gitHead();
  const checkpointHash = checkpoint.environment?.last_commit_hash;
  let gitWarning = '';
  if (checkpointHash && checkpointHash !== 'unknown' && currentHash !== checkpointHash) {
    gitWarning = `\nWARNING: Git hash changed since checkpoint (was ${checkpointHash}, now ${currentHash}). External changes detected.`;
  }

  const lines = [];
  lines.push(`Resuming session (checkpoint #${checkpoint.sequence})`);
  lines.push(`Model: ${checkpoint.state?.model_tier || 'unknown'}/${checkpoint.state?.density || 'unknown'}`);

  const plan = safePlanPath(checkpoint.progress?.plan_path);
  if (plan) {
    lines.push(`Active plan: ${plan}`);
  }

  lines.push(`Git: ${checkpoint.environment?.git_branch || 'unknown'} @ ${currentHash}`);

  if (checkpoint.environment?.working_dir_clean === false) {
    lines.push(`WARNING: ${checkpoint.environment?.uncommitted_changes || '?'} uncommitted changes at last checkpoint`);
  } else if (checkpoint.environment?.working_dir_clean === null) {
    lines.push('Git status was unknown at last checkpoint');
  }

  if (checkpoint.budget) {
    lines.push(`Budget: $${checkpoint.budget.estimated_spent_usd} est. (${checkpoint.budget.turn_count} turns)`);
  }

  if (gitWarning) lines.push(gitWarning);
  lines.push('Build state: unknown (verify on first tool use)');

  return lines.join('\n') + '\n';
};
