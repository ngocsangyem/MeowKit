// checkpoint-writer.cjs — Stop handler: write structured checkpoint with git state.
// Merges clean-state verification into checkpoint write (single handler owns lifecycle).
//
// On Stop event:
//   1. Check git status (clean/dirty)
//   2. Read current budget + model state from session-state/
//   3. Write checkpoint-latest.json (overwriting; sequence auto-incremented in writeCheckpoint)
//
// Checkpoint dir: session-state/checkpoints/

const fs = require('fs');
const path = require('path');
const { gitHead, gitBranch, gitStatus, writeCheckpoint } = require(
  require('path').join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.claude', 'hooks', 'lib', 'checkpoint-utils.cjs')
);

const ROOT = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const TASK_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

// READ-ONLY cache of the active durable task, for the checkpoint summary. The checkpoint never
// WRITES task state — it consumes the canonical pointer (active-plan.json → taskId) and the record
// as a summary. Best-effort: any absence/parse error yields null (no fabrication).
function activeTaskSummary() {
  try {
    const pointer = JSON.parse(fs.readFileSync(path.join(ROOT, 'session-state', 'active-plan.json'), 'utf8'));
    const taskId = pointer && typeof pointer.taskId === 'string' ? pointer.taskId : null;
    if (!taskId || !TASK_ID_RE.test(taskId)) return null;
    const record = JSON.parse(fs.readFileSync(path.join(ROOT, 'tasks', 'active', taskId + '.json'), 'utf8'));
    return {
      taskId,
      status: typeof record.status === 'string' ? record.status : null,
      nextAction: typeof record.nextAction === 'string' ? record.nextAction : '',
    };
  } catch {
    return null;
  }
}

module.exports = function checkpointWriter(ctx, state) {
  const budget = state.load('budget-state');
  const model = state.load('detected-model');
  const activePlan = state.load('active-plan');

  const git = gitStatus();
  const commitHash = gitHead();
  const branch = gitBranch();

  const checkpoint = {
    version: '1.0.0',
    session_id: ctx.session_id || 'unknown',
    created_at: new Date().toISOString(),
    state: {
      model_tier: model?.tier || 'STANDARD',
      density: model?.density || 'FULL',
    },
    progress: {
      plan_path: activePlan?.path || null,
      // Read-only summary of the active durable task (null when none) — the checkpoint never
      // writes task state; it caches it for resume orientation.
      task: activeTaskSummary(),
    },
    environment: {
      git_branch: branch,
      last_commit_hash: commitHash,
      working_dir_clean: git.clean,
      uncommitted_changes: git.changes,
    },
    budget: budget ? {
      estimated_spent_usd: budget.estimated_cost_usd,
      estimated_input_tokens: budget.estimated_input_tokens,
      estimated_output_tokens: budget.estimated_output_tokens,
      turn_count: budget.turn_count,
    } : null,
  };

  writeCheckpoint(checkpoint);

  let summary = `Checkpoint #${checkpoint.sequence} saved.`;
  if (git.clean === false) {
    summary += ` WARNING: ${git.changes} uncommitted change(s).`;
  } else if (git.clean === null) {
    summary += ' Git status unknown.';
  }
  if (budget) {
    summary += ` Budget: $${budget.estimated_cost_usd} est.`;
  }

  return summary + '\n';
};
