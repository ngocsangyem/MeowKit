// budget-tracker.cjs — PostToolUse handler: estimate token cost from tool output.
// PostToolUse stdin provides `tool_response` with full tool output.
// Replaces dead cost-meter.sh (which exited on standard/fast profiles).
//
// Estimation: chars / 4 ≈ tokens (rough, English text). Imprecise but order-of-magnitude.
// Pricing: per 1M tokens (input/output) by model tier.
//
// Thresholds (configurable via env):
//   MEOWKIT_BUDGET_WARN  — warning threshold in USD (default: 30)
//   MEOWKIT_BUDGET_BLOCK — hard block threshold in USD (default: 100)
//   MEOWKIT_BUDGET_CAP   — user override for hard block (can be lower OR higher)

// Pricing per 1M tokens [input, output] in USD
const PRICING = {
  COMPLEX: { input: 15, output: 75 },
  STANDARD: { input: 3, output: 15 },
  TRIVIAL: { input: 0.80, output: 4 },
};

function estimateTokens(text) {
  if (!text) return 0;
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  return Math.ceil(str.length / 4);
}

module.exports = function budgetTracker(ctx, state) {
  // Estimate tokens from tool response
  const responseTokens = estimateTokens(ctx.tool_response);
  const inputTokens = estimateTokens(ctx.tool_input);
  if (responseTokens === 0 && inputTokens === 0) return '';

  // Load model tier from detected-model (written by model-detector at SessionStart)
  const modelInfo = state.load('detected-model');
  const tier = modelInfo?.tier || 'STANDARD';
  const pricing = PRICING[tier] || PRICING.STANDARD;

  // Load or initialize budget state
  const budget = state.load('budget-state') || {
    session_start: new Date().toISOString(),
    model_tier: tier,
    estimated_input_tokens: 0,
    estimated_output_tokens: 0,
    estimated_cost_usd: 0,
    turn_count: 0,
    warnings_emitted: 0,
  };

  // Accumulate
  budget.estimated_input_tokens += inputTokens;
  budget.estimated_output_tokens += responseTokens;
  budget.turn_count += 1;
  budget.model_tier = tier;

  // Calculate cost
  const inputCost = (budget.estimated_input_tokens / 1_000_000) * pricing.input;
  const outputCost = (budget.estimated_output_tokens / 1_000_000) * pricing.output;
  budget.estimated_cost_usd = Math.round((inputCost + outputCost) * 100) / 100;

  state.save('budget-state', budget);

  // Check thresholds (explicit undefined check to allow 0 as valid value)
  const warnEnv = process.env.MEOWKIT_BUDGET_WARN;
  const blockEnv = process.env.MEOWKIT_BUDGET_BLOCK;
  const capEnv = process.env.MEOWKIT_BUDGET_CAP;
  const warnThreshold = warnEnv !== undefined ? Number(warnEnv) : 30;
  // MEOWKIT_BUDGET_CAP overrides the hard block if set
  const blockThreshold = capEnv !== undefined ? Number(capEnv) : (blockEnv !== undefined ? Number(blockEnv) : 100);

  if (budget.estimated_cost_usd >= blockThreshold) {
    budget.warnings_emitted += 1;
    state.save('budget-state', budget);
    return `@@BUDGET_BLOCK@@\nEstimated cost: $${budget.estimated_cost_usd} (cap: $${blockThreshold}). Session budget exceeded.\nReview session-state/budget-state.json for details. Consider wrapping up.\n@@END_BUDGET@@\n`;
  }

  if (budget.estimated_cost_usd >= warnThreshold && budget.warnings_emitted === 0) {
    budget.warnings_emitted += 1;
    state.save('budget-state', budget);
    return `@@BUDGET_WARN@@\nEstimated cost: $${budget.estimated_cost_usd} (warn at $${warnThreshold}, cap at $${blockThreshold}).\n@@END_BUDGET@@\n`;
  }

  return '';
};
