// checkpoint-writer.cjs — Stop handler: write structured checkpoint with git state.
// Merges clean-state verification into checkpoint write (single handler owns lifecycle).
//
// On Stop event:
//   1. Check git status (clean/dirty)
//   2. Read current budget + model state from session-state/
//   3. Write sequenced checkpoint-NNN.json
//   4. Update checkpoint-latest.json pointer
//
// Checkpoint dir: session-state/checkpoints/

const { nextSequence, gitHead, gitBranch, gitStatus, writeCheckpoint } = require(
  require('path').join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.claude', 'hooks', 'lib', 'checkpoint-utils.cjs')
);

module.exports = function checkpointWriter(ctx, state) {
  const budget = state.load('budget-state');
  const model = state.load('detected-model');
  const activePlan = state.load('active-plan');

  const git = gitStatus();
  const commitHash = gitHead();
  const branch = gitBranch();

  const seq = nextSequence();
  const checkpoint = {
    version: '1.0.0',
    sequence: seq,
    session_id: ctx.session_id || 'unknown',
    created_at: new Date().toISOString(),
    state: {
      model_tier: model?.tier || 'STANDARD',
      density: model?.density || 'FULL',
    },
    progress: {
      plan_path: activePlan?.path || null,
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

  writeCheckpoint(checkpoint, seq);

  let summary = `Checkpoint #${seq} saved.`;
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
