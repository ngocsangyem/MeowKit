// auto-checkpoint.cjs — PostToolUse handler: periodic crash-recovery checkpoint.
// Saves lightweight checkpoint every N tool calls (default 20) as crash recovery.
// Stop event doesn't fire on crashes — this ensures progress isn't lost.
//
// Also detects phase transitions by watching writes to tasks/ directories.

const path = require('path');

const { nextSequence, writeCheckpoint } = require(
  path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.claude', 'hooks', 'lib', 'checkpoint-utils.cjs')
);

const INTERVAL = 20;
const TRANSITION_DIRS = ['tasks/plans/', 'tasks/contracts/', 'tasks/reviews/'];

module.exports = function autoCheckpoint(ctx, state) {
  const filePath = ctx.tool_input?.file_path || '';

  const counter = state.load('auto-checkpoint-counter') || { count: 0 };
  counter.count += 1;

  const isTransition = TRANSITION_DIRS.some((dir) => filePath.includes(dir));

  if (counter.count % INTERVAL !== 0 && !isTransition) {
    state.save('auto-checkpoint-counter', counter);
    return '';
  }

  state.save('auto-checkpoint-counter', counter);

  const budget = state.load('budget-state');
  const model = state.load('detected-model');

  const seq = nextSequence();
  const checkpoint = {
    version: '1.0.0',
    sequence: seq,
    type: isTransition ? 'transition' : 'periodic',
    session_id: ctx.session_id || 'unknown',
    created_at: new Date().toISOString(),
    state: {
      model_tier: model?.tier || 'STANDARD',
      density: model?.density || 'FULL',
    },
    progress: {
      tool_calls: counter.count,
      trigger: isTransition ? `transition: ${filePath}` : `periodic: every ${INTERVAL}`,
    },
    budget: budget ? {
      estimated_spent_usd: budget.estimated_cost_usd,
      turn_count: budget.turn_count,
    } : null,
  };

  writeCheckpoint(checkpoint, seq);
  return '';
};
