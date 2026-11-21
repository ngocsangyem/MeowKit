// model-detector.cjs — SessionStart handler: detect model tier and density.
// SessionStart stdin may carry a `model` field with the model id; the host treats it
// as optional, so detection does not depend on it.
//
// Detection cascade:
//   1. The `model` field from SessionStart stdin
//   2. The environment, in the order `lib/resolve-model.cjs` defines (the same order
//      end-of-session resolution uses)
//   3. Default: STANDARD tier, FULL density (safe — never silently LEAN)
// When ANTHROPIC_BASE_URL points away from Anthropic, a Claude-looking name is not
// trusted: that endpoint may serve its own model under the name, so the tier is
// unknown and density is FULL, and the reason is printed.
//
// Output: writes detected-model.json into the session-marker state class
// Emits: human-readable model detection line to stdout (reaches model via SessionStart)

const { configValue } = require('../lib/read-config.cjs');
const { lookup } = require('../lib/density-lookup.cjs');
const { envModelCandidates, thirdPartyEndpoint } = require('../lib/resolve-model.cjs');

// Model id → tier and density: one table shared with the autobuild density script.
const classifyModel = lookup;

module.exports = function modelDetector(ctx, state) {
  // dispatch.cjs routes only SessionStart events here, so no event-name guard: the
  // field is absent from some hosts' stdin, and a guard on it silently disabled detection.
  // `ctx.env` lets a test pass a hermetic environment.
  const env = ctx.env || process.env;
  const candidates = [];
  if (ctx.model) candidates.push(['stdin', String(ctx.model)]);
  for (const [name, value] of envModelCandidates(env)) candidates.push([name, value]);

  let result;
  let confidence;
  let sourceId;
  const endpoint = thirdPartyEndpoint(env);

  if (!endpoint) {
    for (const [source, id] of candidates) {
      const hit = classifyModel(id);
      if (hit) {
        result = hit;
        confidence = source === 'stdin' ? `stdin_${hit.match}` : `env_${source}`;
        sourceId = id;
        break;
      }
    }
  }

  if (!result) {
    result = { tier: 'STANDARD', density: 'FULL' };
    confidence = endpoint ? 'third_party_endpoint' : 'default';
    sourceId = endpoint && candidates.length ? candidates[0][1] : 'unknown';
  }
  // The id is echoed into the model's context; strip anything but id characters.
  sourceId = String(sourceId).replace(/[^a-zA-Z0-9._-]/g, '');

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
  if (confidence === 'third_party_endpoint') {
    return `Model: ${sourceId} via ${endpoint}, a non-Anthropic endpoint; tier unknown (using ${result.tier}/${result.density}).\n`;
  }
  if (confidence === 'default') {
    return `Model: not detected (defaulting to ${result.tier}/${result.density}). Set MEOWKIT_MODEL_HINT for optimal density.\n`;
  }

  return `Model: ${sourceId} → ${result.tier}/${result.density} (${confidence})\n`;
};
