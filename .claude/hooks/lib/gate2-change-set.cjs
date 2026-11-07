'use strict';
// gate2-change-set.cjs — what is this git command actually shipping, and does any
// of it ship code?
//
// Runs before the command does, so the answer has to be reconstructed from the
// index and the working tree rather than read off a commit that does not exist
// yet. Each command form needs a different question asked:
//
//   commit        the index is what ships
//   commit + add  the add has not run yet, so classify what it is ABOUT to stage,
//                 including untracked files — a brand-new source file is the most
//                 common thing a feature commit contains and would otherwise be
//                 invisible
//   commit -a     stages tracked modifications at commit time (never untracked)
//   push / merge  nothing is staged; the scope is the commit range about to leave
//                 the branch, which needs a base to compare against

const { spawnSync } = require('node:child_process');

const SHIP_COMMAND = /git commit|git push|git merge/;

/** Only git is spawned here, and only to read history — never to change it. */
function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.error || r.status !== 0) return '';
  return r.stdout || '';
}

const isShipCommand = (command) => SHIP_COMMAND.test(command || '');

const toPaths = (out) => (out || '').split('\n').map((s) => s.trim()).filter(Boolean);

/** Short HEAD, or '' when there is no history yet to bind a verdict to. */
function headSha(cwd) {
  return git(cwd, ['rev-parse', '--short', 'HEAD']).trim();
}

/**
 * The upstream (or the default branch) a push/merge would be measured against.
 * An unknown base is not an empty change set — it is an unanswerable question.
 */
function pushBase(cwd) {
  const upstream = git(cwd, ['rev-parse', '--abbrev-ref', '@{upstream}']).trim();
  if (upstream) return upstream;
  return git(cwd, ['merge-base', 'HEAD', 'origin/HEAD']).trim();
}

/**
 * `{ changed, baseMissing }`. `baseMissing` is true only for a push/merge whose
 * commit range could not be resolved, which the caller must treat as a block
 * rather than as "nothing ships".
 */
function changeSet(cwd, command) {
  const cmd = command || '';
  if (/git push|git merge/.test(cmd)) {
    const base = pushBase(cwd);
    if (!base) return { changed: [], baseMissing: true };
    return { changed: dedupe(toPaths(git(cwd, ['diff', '--name-only', `${base}..HEAD`]))), baseMissing: false };
  }
  if (!/git commit/.test(cmd)) return { changed: [], baseMissing: false };

  const paths = toPaths(git(cwd, ['diff', '--cached', '--name-only']));
  if (/git add/.test(cmd)) {
    paths.push(...toPaths(git(cwd, ['diff', '--name-only', 'HEAD'])));
    paths.push(...toPaths(git(cwd, ['ls-files', '--others', '--exclude-standard'])));
  }
  if (/commit -a|commit --all| -am | -a | --all /.test(cmd)) {
    paths.push(...toPaths(git(cwd, ['diff', '--name-only', 'HEAD'])));
  }
  return { changed: dedupe(paths), baseMissing: false };
}

/** The unions above can name a file more than once; order is the sorted set. */
const dedupe = (paths) => [...new Set(paths)].sort();

/**
 * Only the NO-SHIP set is enumerated. Listing ship-capable paths instead would
 * be unportable (one repo's layout is not another's) and fail-OPEN, because an
 * unrecognised path would sail through. Unknown path => ship-capable.
 *
 * `.claude/**` is ship-capable even though it is markdown: in a kit repo those
 * files ARE the product. That is why the `.md` rule is scoped outside `.claude`.
 */
function isNoShip(file) {
  if (/^\.claude\/|\/\.claude\//.test(file)) return false;
  if (/^docs\/|\/docs\//.test(file)) return true;
  if (file.startsWith('tasks/reports/')) return true;
  return file.endsWith('.md');
}

/** The first ship-capable file, or '' when the whole change set is no-ship. */
const firstShipFile = (changed) => changed.find((f) => !isNoShip(f)) || '';

module.exports = { changeSet, firstShipFile, git, headSha, isNoShip, isShipCommand };
