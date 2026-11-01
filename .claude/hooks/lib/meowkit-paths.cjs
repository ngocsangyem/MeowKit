// meowkit-paths.cjs — one resolver for the runtime-neutral `.meowkit/` state taxonomy.
//
// Mirrors packages/mewkit/src/state/meowkit-state-paths.ts so hooks and the CLI
// agree on where state lives:
//   memory/     the team store (decisions.md, gotchas.md)
//   telemetry/  append logs (cost-log, trace-log, skill-usage, reviews)
//   state/      session markers, flags, model metadata
//   cache/      derived, rebuildable artifacts (docs cache, codebase map)
//
// Pre-migration fallback: a project whose memory still lives at `.meowkit/memory`
// keeps using it until `mewkit migrate` moves it. Writing to the new taxonomy
// while old content sits in the legacy tree would split a user's history across
// two directories, so the legacy path wins whenever it is the only one present.
const fs = require('node:fs');
const path = require('node:path');

const LEGACY_REL = path.join('.claude', 'memory');

function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

const LEGACY_STORE_FILES = ['decisions.md', 'gotchas.md'];

/** True when the legacy tree holds a recognised MEMORY store file and no `.meowkit/memory` exists. */
function usingLegacyTree(root) {
  if (fs.existsSync(path.join(root, '.meowkit', 'memory'))) return false;
  const legacy = path.join(root, LEGACY_REL);
  if (!fs.existsSync(legacy)) return false;
  try {
    const entries = new Set(fs.readdirSync(legacy));
    return LEGACY_STORE_FILES.some((f) => entries.has(f));
  } catch {
    return false;
  }
}

/** Resolve one taxonomy class to an absolute directory. */
function stateDir(cls, root = projectRoot()) {
  // Legacy fallback is scoped to `memory`: telemetry/state/cache never lived there.
  if (cls === 'memory' && usingLegacyTree(root)) return path.join(root, LEGACY_REL);
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
