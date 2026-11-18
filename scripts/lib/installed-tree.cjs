'use strict';
// What `mewkit init --target <runtime>` installs from the kit this checkout would publish,
// in a temp directory. The checks that read Codex or Cursor instruction text read this tree,
// so they see the files a user gets: `.claude/` projected for the runtime plus
// `kit/overlays/<runtime>/`, limited to the ship set (git-tracked, minus the exclusions).
//
//   node scripts/lib/installed-tree.cjs codex     print the directory (kept until you remove it)

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { excludeMatcher, shipSetExclusions, shipSetFiles } = require('../kit-ship-set.cjs');

const REPO = path.resolve(__dirname, '..', '..');
const RUNTIMES = ['codex', 'cursor'];
const trees = new Map();

/** Newest modification time under `dir`, in ms. */
function newest(dir) {
  let latest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'target' && entry.name !== 'tests') latest = Math.max(latest, newest(file));
    } else {
      latest = Math.max(latest, fs.statSync(file).mtimeMs);
    }
  }
  return latest;
}

/** The binary to install with: `$MEWKIT`, else this checkout's debug build. */
function binary() {
  if (process.env.MEWKIT) return process.env.MEWKIT;
  const built = path.join(REPO, 'target', 'debug', process.platform === 'win32' ? 'mewkit.exe' : 'mewkit');
  const build = 'run `cargo build -p mewkit-cli`, or set MEWKIT to a mewkit binary';
  if (!fs.existsSync(built)) throw new Error(`no mewkit binary at ${path.relative(REPO, built)}: ${build}`);
  // A build older than the installer's source would install what the last build projected.
  if (fs.statSync(built).mtimeMs < newest(path.join(REPO, 'crates'))) {
    throw new Error(`${path.relative(REPO, built)} is older than crates/: ${build}`);
  }
  return built;
}

let kit;

/** The ship set copied to a temp directory: the kit a release would carry. */
function kitDir() {
  if (kit) return kit;
  kit = fs.mkdtempSync(path.join(os.tmpdir(), 'meowkit-kit-'));
  process.on('exit', () => fs.rmSync(kit, { recursive: true, force: true }));
  for (const rel of shipSetFiles(REPO, excludeMatcher(shipSetExclusions(REPO)))) {
    const to = path.join(kit, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(REPO, rel), to);
  }
  return kit;
}

/** Install `runtime` into a fresh directory and return it; one install per process. */
function installedTree(runtime, { keep = false } = {}) {
  if (!RUNTIMES.includes(runtime)) throw new Error(`no installed tree for "${runtime}" (known: ${RUNTIMES.join(', ')})`);
  if (trees.has(runtime)) return trees.get(runtime);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `meowkit-installed-${runtime}-`));
  const args = ['init', '--target', runtime, '--yes', '--kit-dir', kitDir(), '--allow-unverified-kit'];
  const run = spawnSync(binary(), args, { cwd: dir, encoding: 'utf8' });
  if (run.status !== 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error(`mewkit init --target ${runtime} failed: ${(run.stderr || run.error?.message || '').trim().split('\n').pop()}`);
  }
  if (!keep) process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
  trees.set(runtime, dir);
  return dir;
}

if (require.main === module) {
  try {
    console.log(installedTree(process.argv[2], { keep: true }));
  } catch (err) {
    console.error(`installed-tree: ${err.message}`);
    process.exit(2);
  }
}

module.exports = { installedTree, RUNTIMES };
