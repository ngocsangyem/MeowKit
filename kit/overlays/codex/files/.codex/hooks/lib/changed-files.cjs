'use strict';
// changed-files.cjs — the files a ship action carries.
//
// A commit ships the staged set; `commit -a` / `--all` / `-am` also ships modified tracked files.
// A push, merge or pull request ships the commits not yet on the upstream; when no upstream is
// configured, the commits not on origin/HEAD. When neither resolves, the range is unknown and the
// caller decides what to run (`rangeKnown: false`).
//
// The repository is the hook input's `cwd`, not the project variable: after a session enters a
// worktree the project variable still names the starting checkout, while `cwd` follows the
// worktree.

const { spawnSync } = require('node:child_process');

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

const lines = (out) => (out || '').split('\n').map((s) => s.trim()).filter(Boolean);

/** True when commit arguments ask git to stage modified tracked files itself. */
function commitsAll(args) {
  return args.some((a) => a === '--all' || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(a));
}

function pushBase(root) {
  for (const ref of ['@{upstream}', 'origin/HEAD']) {
    if (git(root, ['rev-parse', '--verify', '--quiet', ref]) !== null) return ref;
  }
  return null;
}

/**
 * `{ files, rangeKnown }` for a parsed ship action. Deleted files are left out: there is
 * nothing on disk to lint or test.
 * @param {string} root
 * @param {{ kind: string, args: string[] }} ship
 */
function changedFiles(root, ship) {
  if (ship.kind === 'commit') {
    const staged = lines(git(root, ['diff', '--cached', '--name-only', '--diff-filter=ACMR']));
    const tracked = commitsAll(ship.args) ? lines(git(root, ['diff', '--name-only', '--diff-filter=ACMR'])) : [];
    return { files: [...new Set([...staged, ...tracked])], rangeKnown: true };
  }
  const base = pushBase(root);
  if (!base) return { files: [], rangeKnown: false };
  return { files: lines(git(root, ['diff', '--name-only', '--diff-filter=ACMR', `${base}...HEAD`])), rangeKnown: true };
}

module.exports = { changedFiles, commitsAll };
