// model-detector.cjs — SessionStart handler: detect model tier and density.
// SessionStart stdin provides `model` field with model ID string.
//
// Detection cascade:
//   1. Parse `model` field from SessionStart stdin
//   2. Fallback: MEOWKIT_MODEL_HINT env var
//   3. Default: STANDARD tier, FULL density (safe — never silently LEAN)
//
// Output: writes detected-model.json into the session-marker state class
// Emits: human-readable model detection line to stdout (reaches model via SessionStart)

const { configValue } = require('../lib/read-config.cjs');
const { lookup } = require('../lib/density-lookup.cjs');

// Model id → tier and density: one table shared with the autobuild density script.
const classifyModel = lookup;

module.exports = function modelDetector(ctx, state) {
  // CF2 fix: dispatch.cjs already routes only SessionStart events to this handler.
  // The previous guard on ctx.hook_event_name silently killed detection when the
  // field was absent from stdin JSON (undefined !== 'SessionStart' → true → exit).
  // Guard removed; dispatch routing is the authoritative event filter.

  const modelId = ctx.model || process.env.CLAUDE_MODEL || process.env.CLAUDE_MODEL_ID || null;
  const hintId = process.env.MEOWKIT_MODEL_HINT || null;

  let result;
  let confidence;
  let sourceId;

  // Step 1: Parse model from stdin
  if (modelId) {
    result = classifyModel(modelId);
    if (result) {
      confidence = `stdin_${result.match}`;
      sourceId = modelId;
    }
  }

  // Step 2: Fallback to MEOWKIT_MODEL_HINT
  if (!result && hintId) {
    result = classifyModel(hintId);
    if (result) {
      confidence = 'env_hint';
      sourceId = hintId;
    }
  }

  // Step 3: Default
  if (!result) {
    result = { tier: 'STANDARD', density: 'FULL' };
    confidence = 'default';
    sourceId = 'unknown';
  }

  // A configured density preset overrides the detected one.
  const configured = String(configValue('autobuild.mode', '', { root: ctx.root }).value);
  if (['MINIMAL', 'FULL', 'LEAN'].includes(configured)) {
    result.density = configured;
  }

  const detected = {
    model_id: sourceId,
    tier: result.tier,
    density: result.density,
    confidence,
    detected_at: new Date().toISOString(),
  };

  state.save('detected-model', detected);

  // Emit to stdout (SessionStart stdout reaches model context)
  if (confidence === 'default') {
    return `Model: not detected (defaulting to ${result.tier}/${result.density}). Set MEOWKIT_MODEL_HINT for optimal density.\n`;
  }

  return `Model: ${sourceId} → ${result.tier}/${result.density} (${confidence})\n`;
};
