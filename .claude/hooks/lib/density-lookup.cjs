'use strict';
// density-lookup.cjs — the one table from model id to model tier and autobuild density.
//
// Read by model-detector.cjs at session start and by the autobuild density-select.sh script
// (through the command line below), so the two can no longer disagree about a model.
//
//   node density-lookup.cjs <model-id>   prints "TIER DENSITY"; an unknown id prints
//                                        "STANDARD FULL" and exits 1
//
// Density follows tier: TRIVIAL → MINIMAL, STANDARD → FULL, COMPLEX → FULL, except the COMPLEX
// models listed in LEAN_MODELS, which need less scaffolding and get LEAN. An unknown model is
// STANDARD/FULL: never silently LEAN.

const TIER_DENSITY = { TRIVIAL: 'MINIMAL', STANDARD: 'FULL', COMPLEX: 'FULL' };

/** Exact or prefix ids (a date suffix such as -20251001 still matches). */
const MODEL_TIERS = {
  'claude-opus-4-7': 'COMPLEX',
  'claude-opus-4-6': 'COMPLEX',
  'claude-opus-4-5': 'COMPLEX',
  'claude-opus-4': 'COMPLEX',
  'claude-sonnet-4-6': 'STANDARD',
  'claude-sonnet-4-5': 'STANDARD',
  'claude-sonnet-4': 'STANDARD',
  'claude-haiku-4-5': 'TRIVIAL',
  'claude-haiku-4': 'TRIVIAL',
};

/** COMPLEX model ids (or id fragments) that get LEAN density. */
const LEAN_MODELS = ['opus-4-6', 'opus-4.6', 'opus-4-7', 'opus-4.7'];

/** Family keyword → tier, for ids the table does not name. */
const FAMILY_TIERS = [['opus', 'COMPLEX'], ['sonnet', 'STANDARD'], ['haiku', 'TRIVIAL']];

function densityFor(tier, id) {
  if (tier === 'COMPLEX' && LEAN_MODELS.some((m) => id.includes(m))) return 'LEAN';
  return TIER_DENSITY[tier];
}

/** `{ tier, density, match }` for a model id, or null when the id names no known model. */
function lookup(modelId) {
  if (!modelId || typeof modelId !== 'string') return null;
  const id = modelId.toLowerCase();
  if (MODEL_TIERS[id]) return { tier: MODEL_TIERS[id], density: densityFor(MODEL_TIERS[id], id), match: 'exact' };
  // Longest key first, so `claude-opus-4-6-…` is not taken by `claude-opus-4`.
  const keys = Object.keys(MODEL_TIERS).sort((a, b) => b.length - a.length);
  const key = keys.find((k) => id.startsWith(k));
  if (key) return { tier: MODEL_TIERS[key], density: densityFor(MODEL_TIERS[key], id), match: 'prefix' };
  const family = FAMILY_TIERS.find(([word]) => id.includes(word));
  if (family) return { tier: family[1], density: densityFor(family[1], id), match: 'keyword' };
  return null;
}

module.exports = { lookup, densityFor, MODEL_TIERS, LEAN_MODELS, TIER_DENSITY };

if (require.main === module) {
  const found = lookup(process.argv[2] || '');
  process.stdout.write(found ? `${found.tier} ${found.density}\n` : 'STANDARD FULL\n');
  process.exit(found ? 0 : 1);
}
