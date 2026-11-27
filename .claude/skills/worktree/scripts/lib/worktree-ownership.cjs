'use strict';

/**
 * Worktree ownership for worktree.cjs: who made a worktree, and whether `remove`
 * may touch it.
 *
 * Several runtimes create their own worktrees in places the kit does not know, so
 * ownership is positive: the script writes a marker into each worktree's private git
 * dir when it creates one, and `remove` acts only on marked worktrees (plus unmarked
 * direct children of `<main>/.worktrees/`, made before markers existed). The marker
 * sits outside the working tree, so `git status` never shows it and git deletes it
 * with the worktree.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { git, WORKTREES_DIR } = require('./worktree-git-helpers.cjs');

const MARKER_FILE = 'meowkit-owner.json';
const REVIEW_BACKREF = '.mewkit-review.json';
const REVIEW_PREFIX = 'review-pr-';
const REMOVABLE_OWNERS = new Set(['kit', 'legacy']);
const MAX_DIRTY_PATHS = 10;

function realpathOr(p) {
  try { return fs.realpathSync(p); } catch { return path.resolve(p); }
}

// The list record's adminPath is the worktree path, not its admin dir, so ask git.
function worktreeGitDir(worktreePath) {
  const result = git(['rev-parse', '--git-dir'], { silent: true, cwd: worktreePath });
  return result.success && result.output ? path.resolve(worktreePath, result.output) : null;
}

function writeOwnerMarker(worktreePath, mode) {
  const gitDir = worktreeGitDir(worktreePath);
  if (!gitDir) throw new Error(`cannot resolve git dir of ${worktreePath}`);
  const marker = {
    schemaVersion: 1,
    nonce: crypto.randomBytes(9).toString('hex'),
    mode,
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(gitDir, MARKER_FILE), JSON.stringify(marker, null, 2));
  return marker;
}

function readOwnerMarker(worktreePath) {
  if (!fs.existsSync(worktreePath)) return null;
  const gitDir = worktreeGitDir(worktreePath);
  if (!gitDir) return null;
  try {
    const marker = JSON.parse(fs.readFileSync(path.join(gitDir, MARKER_FILE), 'utf-8'));
    return marker && marker.schemaVersion === 1 ? marker : null;
  } catch { return null; }
}

// main > kit (marker) > review > legacy (unmarked child of <main>/.worktrees/)
// > foreign. `legacy` is pinned to the default root, never to a flag or env root,
// so pointing WORKTREE_ROOT at a host's directory cannot make its worktrees removable.
function classifyOwner(record, mainRoot) {
  if (record.isMainWorktree) return 'main';
  if (readOwnerMarker(record.path)) return 'kit';
  const parent = realpathOr(path.dirname(record.path));
  const defaultRoot = realpathOr(path.join(mainRoot, WORKTREES_DIR));
  const inDefaultRoot = parent === defaultRoot;
  // A review worktree whose back-reference is gone is still review-owned by name.
  if (fs.existsSync(path.join(record.path, REVIEW_BACKREF)) ||
      (inDefaultRoot && path.basename(record.path).startsWith(REVIEW_PREFIX))) return 'review';
  return inDefaultRoot ? 'legacy' : 'foreign';
}

function withOwner(records, mainRoot) {
  return records.map(record => ({ ...record, owner: classifyOwner(record, mainRoot) }));
}

// Exact, then prefix, then (for terms of 4+ chars) contains, over name, path, branch.
function matchByTerm(records, term) {
  const fields = w => [path.basename(w.path), w.path, w.adminPath || '', w.branch || ''].map(f => f.toLowerCase());
  const tiers = [
    w => fields(w).some(f => f === term),
    w => fields(w).some(f => f.startsWith(term)),
    w => term.length >= 4 && fields(w).some(f => f.includes(term))
  ];
  for (const tier of tiers) {
    const hits = records.filter(tier);
    if (hits.length > 0) return hits;
  }
  return [];
}

// Untracked files count: a new module an agent has not committed yet is real work.
// The flags override a user's `status.showUntrackedFiles=no`, which `git worktree
// remove` also honours, so neither check would otherwise see untracked files.
// Returns null when git cannot read the worktree.
function dirtyPaths(worktreePath) {
  if (!fs.existsSync(worktreePath)) return [];
  const result = git(['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=none'], { silent: true, cwd: worktreePath });
  if (!result.success) return null;
  // The git helper trims output, so the first line may have lost its leading space.
  return result.output.split('\n').filter(Boolean).map(line => line.replace(/^[ MADRCUT?!]{1,2} /, ''));
}

function fail(code, message, details) {
  return { ok: false, code, message, details };
}

function foreignError(match, term) {
  const suggestion = match.owner === 'review'
    ? 'This is a review worktree; remove it with: node worktree.cjs review-pr-cleanup --manifest tasks/reviews/<session>/manifest.json'
    : `This script did not create this worktree. Remove it with the tool that made it, or: git worktree remove ${match.path}`;
  return fail('FOREIGN_WORKTREE', `Worktree matching "${term}" was not created by this script (${match.owner})`, {
    suggestion, worktreePath: match.path, owner: match.owner
  });
}

function selectRemovable(records, rawTerm, mainRoot) {
  const term = rawTerm.toLowerCase();
  const candidates = withOwner(records.filter(w => !w.isMainWorktree), mainRoot);
  const removable = candidates.filter(w => REMOVABLE_OWNERS.has(w.owner));
  const matches = matchByTerm(removable, term);
  if (matches.length > 1) {
    return fail('MULTIPLE_WORKTREES_MATCH', `Multiple worktrees match "${rawTerm}"`, {
      suggestion: 'Be more specific or use full path',
      matchingWorktrees: matches.map(w => ({ name: path.basename(w.path), path: w.path, branch: w.branch }))
    });
  }
  if (matches.length === 1) return { ok: true, worktree: matches[0] };
  const others = matchByTerm(candidates.filter(w => !REMOVABLE_OWNERS.has(w.owner)), term);
  if (others.length > 0) return foreignError(others[0], rawTerm);
  return fail('WORKTREE_NOT_FOUND', `No worktree matching "${rawTerm}" found`, {
    suggestion: 'Use "node worktree.cjs list" to see available worktrees',
    availableWorktrees: removable.map(w => path.basename(w.path))
  });
}

// Selects, guards and removes one worktree. Never touches a worktree the kit does
// not own, and never discards uncommitted work unless `discardChanges` is set.
function removeOwnedWorktree({ records, term, mainRoot, discardChanges, dryRun }) {
  const selection = selectRemovable(records, term, mainRoot);
  if (!selection.ok) return selection;
  const { worktree } = selection;
  const worktreePath = worktree.path;
  const branchName = worktree.branch && worktree.branch !== 'detached' && worktree.branch !== 'bare'
    ? worktree.branch : null;
  const warnings = [];
  if (worktree.owner === 'legacy') {
    warnings.push(`Removing an unmarked worktree under ${WORKTREES_DIR}/ (created before ownership markers): ${worktreePath}`);
  }

  const dirty = dirtyPaths(worktreePath);
  if (!discardChanges && (dirty === null || dirty.length > 0)) {
    return fail('WORKTREE_DIRTY', `Worktree has uncommitted changes: ${worktreePath}`, {
      suggestion: 'Commit or move the work first, or pass --discard-changes to delete it. Ignored files are not checked and are deleted with the worktree.',
      worktreePath,
      dirtyPaths: dirty === null ? ['(git status failed)'] : dirty.slice(0, MAX_DIRTY_PATHS)
    });
  }

  if (dryRun) {
    return { ok: true, data: {
      success: true, dryRun: true, message: 'Dry run - no changes made',
      wouldRemove: { worktreePath, branch: branchName, deleteBranch: !!branchName, owner: worktree.owner },
      warnings: warnings.length > 0 ? warnings : undefined
    } };
  }

  const removeArgs = ['worktree', 'remove', worktreePath];
  if (discardChanges) removeArgs.push('--force');
  const removeResult = git(removeArgs, { silent: true, cwd: mainRoot });
  if (!removeResult.success) {
    return fail('WORKTREE_REMOVE_FAILED', `Failed to remove worktree: ${worktreePath}`, {
      suggestion: removeResult.stderr || 'Check if the worktree is locked',
      gitError: removeResult.stderr
    });
  }

  let branchDeleted = false;
  if (branchName) {
    const deleteResult = git(['branch', '-d', branchName], { silent: true, cwd: mainRoot });
    if (deleteResult.success) branchDeleted = true;
    else warnings.push(`Branch kept: ${branchName} (${deleteResult.stderr || 'not fully merged'})`);
  }

  return { ok: true, data: {
    success: true,
    message: 'Worktree removed successfully!',
    removedPath: worktreePath,
    owner: worktree.owner,
    branchDeleted: branchDeleted ? branchName : null,
    branchKept: !branchDeleted && branchName ? branchName : null,
    warnings: warnings.length > 0 ? warnings : undefined
  } };
}

module.exports = {
  MARKER_FILE,
  writeOwnerMarker,
  readOwnerMarker,
  classifyOwner,
  withOwner,
  selectRemovable,
  dirtyPaths,
  removeOwnedWorktree
};
