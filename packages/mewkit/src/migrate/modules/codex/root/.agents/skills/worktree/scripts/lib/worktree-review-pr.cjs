'use strict';

/**
 * review-pr worktree actions for worktree.cjs.
 *
 * Creates an isolated, SHA-bound, DETACHED worktree from a PR ref and writes a
 * manifest whose ownership nonce is what cleanup trusts. The user's checkout and
 * unrelated feature worktrees are never touched: create never runs
 * checkout/switch/reset outside the new path, and cleanup removes a worktree only
 * when the manifest nonce matches the in-worktree back-reference AND the path is a
 * detached `.worktrees/review-pr-*` worktree.
 *
 * SECURITY: a review worktree is where UNTRUSTED PR code is built/tested, so both
 * the in-worktree back-reference (.mewkit-review.json) and any on-disk manifest are
 * attacker-writable. Therefore (a) every git invocation here uses array-argv exec
 * (`execFileSync('git', [...])`) — NO shell string is ever built, so no field can
 * inject a command; and (b) manifest/back-reference fields are format-validated
 * before use as defense-in-depth. Do not reintroduce the shared string-based
 * `git()` helper on any path that carries manifest/back-reference data.
 *
 * Canonical schema: packages/mewkit/src/review/schema.ts (ReviewManifestSchema).
 * This CommonJS module cannot import it; a vitest parity test asserts the manifest
 * emitted here validates under that schema, so the two sides cannot drift.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { checkGitRepo, checkGitVersion, detectBaseBranch, getWorktreeRecords } = require('./worktree-git-helpers.cjs');

const SCHEMA_VERSION = '1.0.0';
const WT_DIR = '.worktrees';
const WT_PREFIX = 'review-pr-';        // .worktrees/review-pr-<pr>-<session>
const REF_NS = 'refs/mewkit';          // refs/mewkit/review-pr-<pr>-<session>
const BACKREF_FILE = '.mewkit-review.json';
const MANIFEST_KEYS = [
  'schemaVersion', 'session', 'nonce', 'worktreePath', 'pr', 'ref', 'headSha',
  'baseSha', 'baseBranch', 'baseRemote', 'host', 'owner', 'repo', 'createdAt',
];

// ── git via array-argv (NO shell — injection-proof) ──────────────────────────
function gitExec(argv, options = {}) {
  try {
    const output = execFileSync('git', argv, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: options.cwd || process.cwd(),
    });
    return { success: true, output: output.trim() };
  } catch (error) {
    return { success: false, error: error.message, stderr: error.stderr?.toString().trim() || '', code: error.status };
  }
}

// ── flag helpers ─────────────────────────────────────────────────────────────
const getFlag = (args, name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? null);
};
const hasFlag = (args, name) => args.includes(name);

// ── input validation (throws Error with .code) ───────────────────────────────
const SESSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
function fail(code, message) { const e = new Error(message); e.code = code; throw e; }

function isValidSession(session) {
  return typeof session === 'string' && session.length > 0 && session.length <= 128 && !session.includes('..') && SESSION_RE.test(session);
}
function isValidPr(n) { return Number.isInteger(n) && n > 0; }

function validateSession(session) {
  if (!session) fail('MISSING_SESSION', 'Session id is required (--session <id>)');
  if (!isValidSession(session)) fail('INVALID_SESSION', `Invalid session id: "${session}" (letters, digits, . _ - only; no path separators or "..")`);
  return session;
}
function validatePr(raw) {
  if (raw == null) fail('MISSING_PR', 'PR number is required (--pr <n>)');
  const n = Number(raw);
  if (!isValidPr(n)) fail('INVALID_PR', `Invalid PR number: "${raw}" (positive integer required)`);
  return n;
}
function validateRemote(remote) {
  if (!remote) fail('MISSING_REMOTE', 'Base remote is required (--remote <name>); it must point at the PR base repo, not a fork');
  if (!NAME_RE.test(remote)) fail('INVALID_REMOTE', `Invalid remote name: "${remote}"`);
  return remote;
}

// ── github URL parsing ───────────────────────────────────────────────────────
function parseRemoteGitHub(url) {
  if (!url) return null;
  const m = url.trim().match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?\/?$/i);
  return m ? { host: 'github', owner: m[1], repo: m[2] } : null;
}

// ── name computation ─────────────────────────────────────────────────────────
const worktreeName = (pr, session) => `${WT_PREFIX}${pr}-${session}`;
const reviewRef = (pr, session) => `${REF_NS}/${WT_PREFIX}${pr}-${session}`;
const relWorktreePath = (pr, session) => `${WT_DIR}/${worktreeName(pr, session)}`;
const REF_RE = /^refs\/mewkit\/review-pr-\d+-[A-Za-z0-9._-]+$/;

// ── manifest shape + format check (.cjs-side boundary; Zod is canonical) ──────
function assertManifestShape(m) {
  if (!m || typeof m !== 'object') fail('INVALID_MANIFEST', 'Manifest is not an object');
  for (const k of MANIFEST_KEYS) {
    if (m[k] === undefined || m[k] === null || m[k] === '') fail('INVALID_MANIFEST', `Manifest missing required field: ${k}`);
  }
  if (!isValidPr(m.pr)) fail('INVALID_MANIFEST', 'Manifest pr must be a positive integer');
  if (!isValidSession(m.session)) fail('INVALID_MANIFEST', `Manifest session is not path-safe: "${m.session}"`);
  // Format-validate the two fields that reach git and the filesystem, so a tampered
  // manifest cannot smuggle metacharacters or a path outside the review namespace
  // (defense-in-depth on top of array-argv exec).
  if (typeof m.ref !== 'string' || !REF_RE.test(m.ref)) fail('INVALID_MANIFEST', `Manifest ref is not a review ref: "${m.ref}"`);
  if (typeof m.worktreePath !== 'string' || !m.worktreePath.startsWith(`${WT_DIR}/${WT_PREFIX}`) || m.worktreePath.includes('..') || path.isAbsolute(m.worktreePath)) {
    fail('INVALID_MANIFEST', `Manifest worktreePath must be a relative ${WT_DIR}/${WT_PREFIX}* path: "${m.worktreePath}"`);
  }
  // ref must agree with pr/session so the guard's name check and the ref are consistent.
  if (m.ref !== reviewRef(m.pr, m.session)) fail('INVALID_MANIFEST', 'Manifest ref does not match pr/session');
  return m;
}

// ── ownership guard (pure — the authority for cleanup) ────────────────────────
// record: { path, branch, detached, isMainWorktree } | undefined
// backref: { session, nonce, pr } | null (read from <worktree>/.mewkit-review.json)
function isOwnedReviewWorktree(manifest, record, backref) {
  if (!manifest || !manifest.nonce) return { ok: false, reason: 'manifest has no ownership nonce' };
  if (!record) return { ok: false, reason: 'target worktree not found in git worktree list' };
  if (record.isMainWorktree) return { ok: false, reason: 'refusing to touch the main worktree' };
  const base = path.basename(record.path);
  if (!base.startsWith(WT_PREFIX)) return { ok: false, reason: `not a review worktree (basename must start with "${WT_PREFIX}")` };
  if (!record.path.split(path.sep).includes(WT_DIR)) return { ok: false, reason: `path is not under ${WT_DIR}/` };
  const detached = record.detached === true || record.branch === 'detached';
  if (!detached) return { ok: false, reason: 'worktree has a branch (a review worktree must be detached)' };
  if (base !== worktreeName(manifest.pr, manifest.session)) return { ok: false, reason: 'worktree name does not match manifest pr/session' };
  if (!backref || !backref.nonce) return { ok: false, reason: 'in-worktree back-reference missing' };
  if (backref.nonce !== manifest.nonce) return { ok: false, reason: 'nonce mismatch (worktree is not owned by this manifest)' };
  return { ok: true };
}

function readBackref(worktreeAbsPath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(worktreeAbsPath, BACKREF_FILE), 'utf-8'));
  } catch { return null; }
}

// ── create ────────────────────────────────────────────────────────────────────
function cmdReviewPr(ctx) {
  const { args, dryRun, explicitBase, output, outputError } = ctx;
  const gitRoot = checkGitRepo(outputError);
  checkGitVersion(outputError);

  let pr, session, remote;
  try {
    pr = validatePr(getFlag(args, '--pr'));
    session = validateSession(getFlag(args, '--session'));
    remote = validateRemote(getFlag(args, '--remote'));
  } catch (e) {
    return outputError(e.code, e.message, { suggestion: 'Usage: worktree review-pr --pr <n> --remote <base-remote> --session <id> [--base <branch>] [--dry-run]' });
  }

  const baseBranch = explicitBase || detectBaseBranch(gitRoot);
  const ref = reviewRef(pr, session);
  const relPath = relWorktreePath(pr, session);
  const worktreeAbs = path.join(gitRoot, relPath);
  const sessionDir = path.join(gitRoot, 'tasks', 'reviews', session);
  const manifestPath = path.join(sessionDir, 'manifest.json');
  const nonce = crypto.randomBytes(9).toString('hex');
  const createdAt = new Date().toISOString();

  const makeManifest = (headSha, baseSha, host, owner, repo) => ({
    schemaVersion: SCHEMA_VERSION, session, nonce, worktreePath: relPath, pr, ref,
    headSha, baseSha, baseBranch, baseRemote: remote, host, owner, repo, createdAt,
  });

  if (dryRun) {
    const urlRes = gitExec(['remote', 'get-url', remote], { cwd: gitRoot });
    const parsed = urlRes.success ? parseRemoteGitHub(urlRes.output) : null;
    const gh = parsed || { host: 'github', owner: '(unresolved)', repo: '(unresolved)' };
    return output({
      success: true, dryRun: true,
      message: 'Dry run — no fetch, no worktree created',
      wouldCreate: {
        manifest: makeManifest('DRY-RUN-head-not-fetched', 'DRY-RUN-base-not-fetched', gh.host, gh.owner, gh.repo),
        sessionDir: path.relative(gitRoot, sessionDir),
        remoteResolved: !!parsed,
      },
    });
  }

  // Resolve the base remote's owner/repo (must be the PR base repo, not a fork).
  const urlRes = gitExec(['remote', 'get-url', remote], { cwd: gitRoot });
  if (!urlRes.success) return outputError('REMOTE_NOT_FOUND', `Remote "${remote}" not found`, { suggestion: urlRes.stderr });
  const gh = parseRemoteGitHub(urlRes.output);
  if (!gh) return outputError('REMOTE_NOT_GITHUB', `Remote "${remote}" is not a GitHub remote; v1 supports GitHub only`, { url: urlRes.output });

  // 1. Fetch the PR head onto a review-namespaced ref. pull/N/head lives ONLY on
  //    the base remote — binding to `remote` (the base) is what keeps fork PRs safe.
  const fetchRes = gitExec(['fetch', remote, `pull/${pr}/head:${ref}`], { cwd: gitRoot });
  if (!fetchRes.success) return outputError('PR_FETCH_FAILED', `Failed to fetch pull/${pr}/head from ${remote}`, { gitError: fetchRes.stderr });

  const headRes = gitExec(['rev-parse', ref], { cwd: gitRoot });
  if (!headRes.success) { gitExec(['update-ref', '-d', ref], { cwd: gitRoot }); return outputError('HEAD_RESOLVE_FAILED', `Could not resolve head SHA for ${ref}`); }
  const headSha = headRes.output.trim();

  // baseSha = the PR's fork point (merge-base with base). Fall back to the base tip
  // only if merge-base is unavailable; if the base branch itself cannot be resolved,
  // fail explicitly BEFORE creating the worktree rather than writing an empty SHA.
  const mbRes = gitExec(['merge-base', ref, baseBranch], { cwd: gitRoot });
  let baseSha = mbRes.success ? mbRes.output.trim() : '';
  if (!baseSha) {
    const baseTip = gitExec(['rev-parse', baseBranch], { cwd: gitRoot });
    baseSha = baseTip.success ? baseTip.output.trim() : '';
  }
  if (!baseSha) { gitExec(['update-ref', '-d', ref], { cwd: gitRoot }); return outputError('BASE_RESOLVE_FAILED', `Could not resolve base branch "${baseBranch}"; pass --base <branch>`); }

  // 2. Create the detached worktree. Transactional: any failure after this point
  //    runs the owned teardown before exiting non-zero (no litter).
  try { fs.mkdirSync(path.join(gitRoot, WT_DIR), { recursive: true }); } catch { /* best effort */ }
  const addRes = gitExec(['worktree', 'add', '--detach', worktreeAbs, headSha], { cwd: gitRoot });
  if (!addRes.success) { gitExec(['update-ref', '-d', ref], { cwd: gitRoot }); return outputError('WORKTREE_ADD_FAILED', 'Failed to add review worktree', { gitError: addRes.stderr }); }

  const teardown = () => {
    gitExec(['worktree', 'remove', '--force', worktreeAbs], { cwd: gitRoot });
    gitExec(['update-ref', '-d', ref], { cwd: gitRoot });
  };
  try {
    fs.writeFileSync(path.join(worktreeAbs, BACKREF_FILE), JSON.stringify({ session, nonce, pr }, null, 2));
    fs.mkdirSync(sessionDir, { recursive: true });
    const manifest = makeManifest(headSha, baseSha, gh.host, gh.owner, gh.repo);
    assertManifestShape(manifest);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return output({ success: true, message: 'Review worktree created', manifest, manifestPath: path.relative(gitRoot, manifestPath) });
  } catch (e) {
    teardown();
    return outputError('REVIEW_PR_SETUP_FAILED', `Setup failed after worktree add (rolled back): ${e.message}`);
  }
}

// ── cleanup (manifest-only) ─────────────────────────────────────────────────────
function cmdReviewPrCleanup(ctx) {
  const { args, dryRun, output, outputError } = ctx;
  const gitRoot = checkGitRepo(outputError);
  checkGitVersion(outputError);

  if (hasFlag(args, '--sweep')) return sweep(ctx, gitRoot);

  const manifestArg = getFlag(args, '--manifest');
  if (!manifestArg) return outputError('MISSING_MANIFEST', 'A manifest path is required (--manifest <path>); cleanup accepts nothing else');
  const manifestAbs = path.resolve(gitRoot, manifestArg);
  if (!fs.existsSync(manifestAbs)) return outputError('MANIFEST_NOT_FOUND', `Manifest not found: ${manifestArg}`);

  let manifest;
  try { manifest = assertManifestShape(JSON.parse(fs.readFileSync(manifestAbs, 'utf-8'))); }
  catch (e) { return outputError(e.code || 'INVALID_MANIFEST', `Cannot read manifest: ${e.message}`); }

  const worktreeAbs = path.resolve(gitRoot, manifest.worktreePath);
  const records = getWorktreeRecords(gitRoot, gitRoot, outputError);
  const record = records.find((r) => path.resolve(r.path) === worktreeAbs);
  const backref = readBackref(worktreeAbs);

  const guard = isOwnedReviewWorktree(manifest, record, backref);
  if (!guard.ok) return outputError('CLEANUP_REFUSED', `Refusing to remove worktree: ${guard.reason}`, { worktreePath: manifest.worktreePath });

  if (dryRun) return output({ success: true, dryRun: true, message: 'Dry run — no changes made', wouldRemove: { worktreePath: manifest.worktreePath, ref: manifest.ref } });

  const rm = gitExec(['worktree', 'remove', '--force', worktreeAbs], { cwd: gitRoot });
  if (!rm.success) return outputError('WORKTREE_REMOVE_FAILED', `Failed to remove ${manifest.worktreePath}`, { gitError: rm.stderr });
  gitExec(['update-ref', '-d', manifest.ref], { cwd: gitRoot });
  return output({ success: true, message: 'Review worktree removed', removedPath: manifest.worktreePath, ref: manifest.ref });
}

// ── stale sweep ─────────────────────────────────────────────────────────────────
// Removes review worktrees that are still session-owned but whose run ended. A
// candidate must be a detached `.worktrees/review-pr-*` worktree carrying a
// FORMAT-VALID back-reference; when the persisted manifest still exists the full
// ownership guard (nonce match) must also pass. Untrusted PR code cannot use this to
// run commands (array-argv exec) nor to widen the target set (format validation).
function sweep(ctx, gitRoot) {
  const { args, output, outputError } = ctx;
  const apply = hasFlag(args, '--apply');
  const records = getWorktreeRecords(gitRoot, gitRoot, outputError)
    .filter((r) => !r.isMainWorktree && path.basename(r.path).startsWith(WT_PREFIX));
  const candidates = [];
  const skipped = [];
  for (const r of records) {
    const abs = path.resolve(r.path);
    const backref = readBackref(abs);
    const detached = r.detached === true || r.branch === 'detached';
    if (!detached || !backref || !isValidSession(backref.session) || !isValidPr(backref.pr) || path.basename(abs) !== worktreeName(backref.pr, backref.session)) {
      if (backref) skipped.push({ worktreePath: path.relative(gitRoot, abs), reason: 'malformed or non-owned back-reference' });
      continue;
    }
    // If the manifest survives, require a full nonce-matched ownership proof.
    const manifestPath = path.join(gitRoot, 'tasks', 'reviews', backref.session, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      let manifest = null;
      try { manifest = assertManifestShape(JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))); } catch { manifest = null; }
      if (!manifest || !isOwnedReviewWorktree(manifest, r, backref).ok) {
        skipped.push({ worktreePath: path.relative(gitRoot, abs), reason: 'manifest present but ownership guard failed' });
        continue;
      }
    }
    candidates.push({ worktreePath: path.relative(gitRoot, abs), session: backref.session, pr: backref.pr });
    if (apply) {
      gitExec(['worktree', 'remove', '--force', abs], { cwd: gitRoot });
      gitExec(['update-ref', '-d', reviewRef(backref.pr, backref.session)], { cwd: gitRoot });
    }
  }
  return output({ success: true, sweep: true, applied: apply, count: candidates.length, worktrees: candidates, skipped,
    message: apply ? `Removed ${candidates.length} stale review worktree(s)` : `${candidates.length} stale review worktree(s) would be removed (--apply to execute)` });
}

module.exports = {
  cmdReviewPr, cmdReviewPrCleanup,
  // exported for unit tests
  validateSession, validatePr, validateRemote, parseRemoteGitHub,
  worktreeName, reviewRef, relWorktreePath, isOwnedReviewWorktree, assertManifestShape,
};
