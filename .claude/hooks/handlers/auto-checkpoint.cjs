// auto-checkpoint.cjs — PostToolUse handler: phase-transition checkpoint.
// Writes a lightweight checkpoint when a write touches a phase-transition directory
// (tasks/plans/, tasks/contracts/, tasks/reviews/). Stop event covers end-of-turn
// state; this handler only fires on workflow phase boundaries.

const path = require('path');

const { writeCheckpoint } = require(
  path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.claude', 'hooks', 'lib', 'checkpoint-utils.cjs')
);

const TRANSITION_DIRS = ['tasks/plans/', 'tasks/contracts/', 'tasks/reviews/'];

module.exports = function autoCheckpoint(ctx, state) {
  const filePath = ctx.tool_input?.file_path || '';
  const isTransition = TRANSITION_DIRS.some((dir) => filePath.includes(dir));
  if (!isTransition) return '';

  const budget = state.load('budget-state');
  const model = state.load('detected-model');

  const checkpoint = {
    version: '1.0.0',
    type: 'transition',
    session_id: ctx.session_id || 'unknown',
    created_at: new Date().toISOString(),
    state: {
      model_tier: model?.tier || 'STANDARD',
      density: model?.density || 'FULL',
    },
    progress: {
      trigger: `transition: ${filePath}`,
    },
    budget: budget ? {
      estimated_spent_usd: budget.estimated_cost_usd,
      turn_count: budget.turn_count,
    } : null,
  };

  writeCheckpoint(checkpoint);
  return '';
};
