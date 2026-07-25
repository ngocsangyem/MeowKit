// meowkit-paths.cjs — one resolver for the runtime-neutral `.meowkit/` state taxonomy.
//
// Mirrors packages/mewkit/src/state/meowkit-state-paths.ts so hooks and the CLI
// agree on where state lives:
//   memory/     curated stores (fixes, review-patterns, architecture-decisions,
//               security-findings, decisions, quick-notes) + generated views
//   telemetry/  append logs (cost-log, trace-log, skill-usage, reviews, eureka)
//   state/      session markers, flags, model metadata
//   cache/      derived, rebuildable artifacts (wiki-index.db)
//
// Pre-migration fallback: a project whose memory still lives at `.claude/memory`
// keeps using it until `mewkit migrate` moves it. Writing to the new taxonomy
// while old content sits in the legacy tree would split a user's history across
// two directories, so the legacy path wins whenever it is the only one present.
// This matches detectLegacyMemory() in packages/mewkit/src/commands/memory.ts.
const fs = require('node:fs');
const path = require('node:path');

const LEGACY_REL = path.join('.claude', 'memory');

function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

/** True when the legacy tree holds real content and no `.meowkit/` counterpart exists. */
function usingLegacyTree(root) {
  if (fs.existsSync(path.join(root, '.meowkit', 'memory'))) return false;
  const legacy = path.join(root, LEGACY_REL);
  if (!fs.existsSync(legacy)) return false;
  try {
    return fs.readdirSync(legacy).some((f) => f !== '.gitkeep');
  } catch {
    return false;
  }
}

/** Resolve one taxonomy class to an absolute directory. */
function stateDir(cls, root = projectRoot()) {
  if (usingLegacyTree(root)) return path.join(root, LEGACY_REL);
  return path.join(root, '.meowkit', cls);
}

const memoryDir = (root) => stateDir('memory', root);
const telemetryDir = (root) => stateDir('telemetry', root);
const sessionStateDir = (root) => stateDir('state', root);
const cacheDir = (root) => stateDir('cache', root);

module.exports = {
  projectRoot,
  usingLegacyTree,
  stateDir,
  memoryDir,
  telemetryDir,
  sessionStateDir,
  cacheDir,
};
