// model-detector.cjs — SessionStart handler: detect model tier and density.
// SessionStart stdin provides `model` field with model ID string.
//
// Detection cascade:
//   1. Parse `model` field from SessionStart stdin
//   2. Fallback: MEOWKIT_MODEL_HINT env var
//   3. Default: STANDARD tier, FULL density (safe — never silently LEAN)
//
// Output: writes session-state/detected-model.json
// Emits: human-readable model detection line to stdout (reaches model via SessionStart)

const MODEL_TIERS = {
  // Opus models → COMPLEX
  'claude-opus-4-6': { tier: 'COMPLEX', density: 'LEAN' },
  'claude-opus-4-5': { tier: 'COMPLEX', density: 'FULL' },
  'claude-opus-4': { tier: 'COMPLEX', density: 'FULL' },
  // Sonnet models → STANDARD
  'claude-sonnet-4-6': { tier: 'STANDARD', density: 'FULL' },
  'claude-sonnet-4-5': { tier: 'STANDARD', density: 'FULL' },
  'claude-sonnet-4': { tier: 'STANDARD', density: 'FULL' },
  // Haiku models → TRIVIAL
  'claude-haiku-4-5': { tier: 'TRIVIAL', density: 'MINIMAL' },
  'claude-haiku-4': { tier: 'TRIVIAL', density: 'MINIMAL' },
};

// Match model ID to tier by prefix (handles version suffixes like -20251001)
function classifyModel(modelId) {
  if (!modelId) return null;
  const normalized = modelId.toLowerCase();

  // Try exact match first
  if (MODEL_TIERS[normalized]) {
    return { ...MODEL_TIERS[normalized], match: 'exact' };
  }

  // Try prefix match (handles date suffixes)
  for (const [key, value] of Object.entries(MODEL_TIERS)) {
    if (normalized.startsWith(key)) {
      return { ...value, match: 'prefix' };
    }
  }

  // Fallback: classify by model family keyword
  if (normalized.includes('opus')) {
    // Opus 4.6+ gets LEAN density; older Opus gets FULL
    const density = normalized.includes('4-6') || normalized.includes('4.6') ? 'LEAN' : 'FULL';
    return { tier: 'COMPLEX', density, match: 'keyword' };
  }
  if (normalized.includes('sonnet')) return { tier: 'STANDARD', density: 'FULL', match: 'keyword' };
  if (normalized.includes('haiku')) return { tier: 'TRIVIAL', density: 'MINIMAL', match: 'keyword' };

  return null;
}

module.exports = function modelDetector(ctx, state) {
  // Only run on SessionStart events
  if (ctx.hook_event_name !== 'SessionStart') return '';

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

  // Allow density override via env var
  const densityOverride = process.env.MEOWKIT_HARNESS_MODE;
  if (densityOverride && ['MINIMAL', 'FULL', 'LEAN'].includes(densityOverride)) {
    result.density = densityOverride;
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
