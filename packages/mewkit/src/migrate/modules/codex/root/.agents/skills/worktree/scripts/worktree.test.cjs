#!/usr/bin/env node
/**
 * Test suite for worktree.cjs
 * Run: node meowkit/.agents/skills/worktree/scripts/worktree.test.cjs
 *
 * All destructive tests use --dry-run; only info/list/status/prune touch live state.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, 'worktree.cjs');
const reviewPr = require('./lib/worktree-review-pr.cjs');
// Run tests from the current git root so we have a real repo context
const TEST_CWD = execSync('git rev-parse --show-toplevel', {
  encoding: 'utf-8',
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe']
}).trim();

let passed = 0;
let failed = 0;

function run(args, options = {}) {
  const cwd = options.cwd || TEST_CWD;
  try {
    const output = execSync(`node "${SCRIPT_PATH}" ${args}`, {
      encoding: 'utf-8',
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output: output.trim(), exitCode: 0 };
  } catch (error) {
    return {
      success: false,
      output: error.stdout?.toString().trim() || '',
      stderr: error.stderr?.toString().trim() || '',
      exitCode: error.status || 1
    };
  }
}

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    throw new Error(`Invalid JSON: ${str.slice(0, 120)}...`);
  }
}

// ─── INFO ─────────────────────────────────────────────────────────────────────
console.log('\n📋 INFO Command Tests');

test('info returns valid JSON', () => {
  const result = run('info --json');
  assert(result.success, `Command should succeed. stderr: ${result.stderr}`);
  const json = assertJSON(result.output);
  assert(json.info === true, 'Should have info: true');
});

test('info detects repo type', () => {
  const json = assertJSON(run('info --json').output);
  assert(['standalone', 'monorepo'].includes(json.repoType), 'Should detect repo type');
});

test('info detects base branch', () => {
  const json = assertJSON(run('info --json').output);
  assert(json.baseBranch, 'Should have baseBranch field');
  assert(['dev', 'develop', 'main', 'master'].includes(json.baseBranch), `Unexpected branch: ${json.baseBranch}`);
});

test('info returns worktreeRoot field', () => {
  const json = assertJSON(run('info --json').output);
  assert(typeof json.worktreeRoot === 'string', 'Should have worktreeRoot string');
  assert(json.worktreeRoot.length > 0, 'worktreeRoot should not be empty');
});

test('info returns dirtyState field', () => {
  const json = assertJSON(run('info --json').output);
  assert(typeof json.dirtyState === 'boolean', 'Should have boolean dirtyState');
});

test('info returns envFiles array', () => {
  const json = assertJSON(run('info --json').output);
  assert(Array.isArray(json.envFiles), 'Should have envFiles array');
});

// ─── LIST ─────────────────────────────────────────────────────────────────────
console.log('\n📂 LIST Command Tests');

test('list returns valid JSON with worktrees array', () => {
  const result = run('list --json');
  assert(result.success, `Command should succeed. stderr: ${result.stderr}`);
  const json = assertJSON(result.output);
  assert(json.success === true, 'Should have success: true');
  assert(Array.isArray(json.worktrees), 'Should have worktrees array');
});

test('list shows main worktree', () => {
  const json = assertJSON(run('list --json').output);
  assert(json.worktrees.length > 0, 'Should have at least one worktree');
  assert(json.worktrees.some(w => w.isMainWorktree), 'Should have a main worktree');
});

// ─── STATUS ───────────────────────────────────────────────────────────────────
console.log('\n🩺 STATUS Command Tests');

test('status returns valid JSON', () => {
  const result = run('status --json');
  assert(result.success, `Command should succeed. stderr: ${result.stderr}`);
  const json = assertJSON(result.output);
  assert(json.success === true, 'Should have success: true');
});

test('status has currentWorktree field', () => {
  const json = assertJSON(run('status --json').output);
  assert('currentWorktree' in json, 'Should have currentWorktree field');
});

test('status worktrees have ahead/behind fields', () => {
  const json = assertJSON(run('status --json').output);
  assert(Array.isArray(json.worktrees), 'Should have worktrees array');
  json.worktrees.forEach(w => {
    assert(typeof w.ahead === 'number', `worktree should have numeric ahead: ${JSON.stringify(w)}`);
    assert(typeof w.behind === 'number', `worktree should have numeric behind: ${JSON.stringify(w)}`);
  });
});

// ─── PRUNE --dry-run ──────────────────────────────────────────────────────────
console.log('\n🧹 PRUNE Command Tests');

test('prune --dry-run returns valid JSON with dryRun: true', () => {
  const result = run('prune --dry-run --json');
  assert(result.success, `Command should succeed. stderr: ${result.stderr}`);
  const json = assertJSON(result.output);
  assert(json.success === true, 'Should have success: true');
  assert(json.dryRun === true, 'Should have dryRun: true');
});

test('prune --dry-run does not modify git state', () => {
  // Run twice; second result should be identical (no mutation)
  const r1 = assertJSON(run('prune --dry-run --json').output);
  const r2 = assertJSON(run('prune --dry-run --json').output);
  assert(JSON.stringify(r1) === JSON.stringify(r2), 'Dry-run should be idempotent');
});

// ─── CREATE --dry-run (feature mode) ─────────────────────────────────────────
console.log('\n🌿 CREATE Feature Mode Tests (dry-run)');

test('create feat-name with feat prefix returns dryRun and correct branch', () => {
  const result = run('create feat-name --prefix feat --dry-run --json');
  assert(result.success, `Command should succeed. stderr: ${result.stderr}`);
  const json = assertJSON(result.output);
  assert(json.success === true, 'Should succeed');
  assert(json.dryRun === true, 'Should be dry run');
  assert(json.wouldCreate.branch.startsWith('feat/'), `Branch should start with feat/: ${json.wouldCreate.branch}`);
});

test('create with fix prefix produces fix/ branch', () => {
  const json = assertJSON(run('create fix-name --prefix fix --dry-run --json').output);
  assert(json.wouldCreate.branch.startsWith('fix/'), `Expected fix/ prefix: ${json.wouldCreate.branch}`);
});

test('create with --no-prefix preserves feature name without prefix', () => {
  const json = assertJSON(run('create PROJ-123-desc --no-prefix --dry-run --json').output);
  assert(!json.wouldCreate.branch.includes('/'), `Branch should have no prefix slash: ${json.wouldCreate.branch}`);
  assert(json.wouldCreate.branch.includes('PROJ-123'), `Should preserve original casing: ${json.wouldCreate.branch}`);
});

// ─── CREATE --dry-run (orchestrated mode) ────────────────────────────────────
console.log('\n🤖 CREATE Orchestrated Mode Tests (dry-run)');

test('create agent-x --orchestrated returns parallel/{name}-{ts} branch', () => {
  const result = run('create agent-x --orchestrated --dry-run --json');
  assert(result.success, `Command should succeed. stderr: ${result.stderr}`);
  const json = assertJSON(result.output);
  assert(json.success === true, 'Should succeed');
  assert(json.dryRun === true, 'Should be dry run');
  assert(json.wouldCreate.branch.startsWith('parallel/agent-x-'), `Branch should match parallel/agent-x-*: ${json.wouldCreate.branch}`);
  assert(json.wouldCreate.orchestrated === true, 'Should flag orchestrated: true');
});

test('create agent-x --orchestrated worktreePath contains .worktrees/agent-x', () => {
  const json = assertJSON(run('create agent-x --orchestrated --dry-run --json').output);
  const p = json.wouldCreate.worktreePath;
  assert(p.includes('.worktrees') && p.endsWith('agent-x'), `.worktreePath should end with .worktrees/agent-x: ${p}`);
});

test('orchestrated branch timestamp portion is numeric', () => {
  const json = assertJSON(run('create timer-agent --orchestrated --dry-run --json').output);
  const branch = json.wouldCreate.branch; // parallel/timer-agent-{ts}
  const parts = branch.split('-');
  const ts = parts[parts.length - 1];
  assert(/^\d+$/.test(ts), `Last segment should be a timestamp: ${ts}`);
});

// ─── Security / sanitization ──────────────────────────────────────────────────
console.log('\n🔒 Security / Sanitization Tests (dry-run)');

test('feature name with spaces is sanitized to kebab-case', () => {
  const json = assertJSON(run('create "my feature" --prefix feat --dry-run --json').output);
  assert(json.wouldCreate.branch === 'feat/my-feature', `Expected feat/my-feature: ${json.wouldCreate.branch}`);
});

test('feature name with unicode chars is sanitized', () => {
  const json = assertJSON(run('create "café-feature" --prefix feat --dry-run --json').output);
  // Diacritics stripped → cafe-feature
  assert(json.success === true, 'Should succeed');
  assert(json.wouldCreate.branch.startsWith('feat/'), `Should still produce feat/ branch: ${json.wouldCreate.branch}`);
  assert(!json.wouldCreate.branch.includes('é'), 'Diacritics should be stripped');
});

test('--base with shell metacharacter is rejected with INVALID_BASE_BRANCH', () => {
  const result = run('create test-feature --prefix feat --base "main;evil" --dry-run --json');
  assert(!result.success, 'Command should fail');
  const json = assertJSON(result.output);
  assert(json.error.code === 'INVALID_BASE_BRANCH', `Expected INVALID_BASE_BRANCH, got: ${json.error.code}`);
});

test('--prefix with spaces is sanitized', () => {
  const json = assertJSON(run('create my-feature --prefix "feat ure" --dry-run --json').output);
  // sanitizeBranchPrefix converts spaces to dashes
  assert(json.wouldCreate.branch.startsWith('feat-ure/') || json.wouldCreate.branch.startsWith('feat/'), `Unexpected prefix: ${json.wouldCreate.branch}`);
});

// ─── REMOVE --dry-run ─────────────────────────────────────────────────────────
console.log('\n🗑️  REMOVE Command Tests (dry-run)');

test('remove nonexistent name returns WORKTREE_NOT_FOUND', () => {
  const result = run('remove nonexistent-worktree-xyz --dry-run --json');
  assert(!result.success, 'Command should fail');
  const json = assertJSON(result.output);
  assert(json.error.code === 'WORKTREE_NOT_FOUND', `Expected WORKTREE_NOT_FOUND, got: ${json.error.code}`);
});

test('remove without arg returns MISSING_WORKTREE', () => {
  const result = run('remove --json');
  assert(!result.success, 'Command should fail');
  const json = assertJSON(result.output);
  assert(json.error.code === 'MISSING_WORKTREE', `Expected MISSING_WORKTREE, got: ${json.error.code}`);
});

// ─── Error handling ───────────────────────────────────────────────────────────
console.log('\n⚠️  Error Handling Tests');

test('unknown command returns UNKNOWN_COMMAND with exit code 1', () => {
  const result = run('bogus-command --json');
  assert(!result.success, 'Should fail');
  assert(result.exitCode === 1, `Should exit 1, got: ${result.exitCode}`);
  const json = assertJSON(result.output);
  assert(json.error.code === 'UNKNOWN_COMMAND', `Expected UNKNOWN_COMMAND, got: ${json.error.code}`);
});

test('create without feature name returns MISSING_FEATURE', () => {
  const result = run('create --json');
  assert(!result.success, 'Should fail');
  const json = assertJSON(result.output);
  assert(json.error.code === 'MISSING_FEATURE', `Expected MISSING_FEATURE, got: ${json.error.code}`);
});

test('create --orchestrated without agent name returns MISSING_AGENT_NAME', () => {
  const result = run('create --orchestrated --json');
  assert(!result.success, 'Should fail');
  const json = assertJSON(result.output);
  assert(json.error.code === 'MISSING_AGENT_NAME', `Expected MISSING_AGENT_NAME, got: ${json.error.code}`);
});

// ─── REVIEW-PR: input validation (pure) ────────────────────────────────────────
console.log('\n🔎 review-pr input validation (pure functions)');

test('validateSession accepts a safe id', () => {
  assert(reviewPr.validateSession('feat-42_x.1') === 'feat-42_x.1', 'safe id should pass through');
});

['../evil', 'a/b', 'a\\b', '/abs', '..', 'a/../b', '.hidden-start'].forEach((bad) => {
  test(`validateSession rejects path-unsafe id: ${JSON.stringify(bad)}`, () => {
    let code = null;
    try { reviewPr.validateSession(bad); } catch (e) { code = e.code; }
    assert(code === 'INVALID_SESSION' || (bad === '.hidden-start' && code === 'INVALID_SESSION'), `Expected INVALID_SESSION, got: ${code}`);
  });
});

test('validatePr rejects non-positive / non-integer', () => {
  ['0', '-2', 'abc', '3.5'].forEach((bad) => {
    let code = null;
    try { reviewPr.validatePr(bad); } catch (e) { code = e.code; }
    assert(code === 'INVALID_PR', `Expected INVALID_PR for ${bad}, got: ${code}`);
  });
  assert(reviewPr.validatePr('12') === 12, 'valid PR should coerce to number');
});

test('validateRemote requires a remote name', () => {
  let code = null;
  try { reviewPr.validateRemote(null); } catch (e) { code = e.code; }
  assert(code === 'MISSING_REMOTE', `Expected MISSING_REMOTE, got: ${code}`);
});

test('parseRemoteGitHub parses https and ssh forms, rejects non-github', () => {
  const https = reviewPr.parseRemoteGitHub('https://github.com/ngocsangyem/MeowKit.git');
  assert(https && https.owner === 'ngocsangyem' && https.repo === 'MeowKit', `https parse failed: ${JSON.stringify(https)}`);
  const ssh = reviewPr.parseRemoteGitHub('git@github.com:acme/repo.git');
  assert(ssh && ssh.owner === 'acme' && ssh.repo === 'repo', `ssh parse failed: ${JSON.stringify(ssh)}`);
  assert(reviewPr.parseRemoteGitHub('https://gitlab.com/a/b.git') === null, 'non-github should be null');
});

// ─── REVIEW-PR: cleanup ownership guard (pure) ──────────────────────────────────
console.log('\n🛡️  review-pr cleanup ownership guard (pure functions)');

const OWNED_MANIFEST = { pr: 7, session: 'sess', nonce: 'NONCE123', worktreePath: '.worktrees/review-pr-7-sess' };
const OWNED_RECORD = { path: '/repo/.worktrees/review-pr-7-sess', branch: 'detached', detached: true, isMainWorktree: false };
const OWNED_BACKREF = { session: 'sess', nonce: 'NONCE123', pr: 7 };

test('guard OKs a matching detached owned review worktree', () => {
  const g = reviewPr.isOwnedReviewWorktree(OWNED_MANIFEST, OWNED_RECORD, OWNED_BACKREF);
  assert(g.ok === true, `Expected ok, got: ${JSON.stringify(g)}`);
});

test('guard OKs even when the worktree is dirty (ownership, not cleanliness, is the gate)', () => {
  const dirtyRecord = { ...OWNED_RECORD, dirty: true };
  const g = reviewPr.isOwnedReviewWorktree(OWNED_MANIFEST, dirtyRecord, OWNED_BACKREF);
  assert(g.ok === true, `Dirty owned worktree should still be cleanable: ${JSON.stringify(g)}`);
});

test('guard REFUSES a nonce mismatch', () => {
  const g = reviewPr.isOwnedReviewWorktree(OWNED_MANIFEST, OWNED_RECORD, { ...OWNED_BACKREF, nonce: 'OTHER' });
  assert(g.ok === false && /nonce/.test(g.reason), `Expected nonce refusal: ${JSON.stringify(g)}`);
});

test('guard REFUSES a path outside .worktrees/review-pr-', () => {
  const feat = { path: '/repo/.worktrees/feat-something', branch: 'detached', detached: true, isMainWorktree: false };
  const g = reviewPr.isOwnedReviewWorktree({ ...OWNED_MANIFEST, worktreePath: '.worktrees/feat-something' }, feat, { nonce: 'NONCE123' });
  assert(g.ok === false, `Expected refusal for non-review path: ${JSON.stringify(g)}`);
});

test('guard REFUSES a non-detached worktree (has a branch)', () => {
  const branched = { ...OWNED_RECORD, branch: 'feature/x', detached: false };
  const g = reviewPr.isOwnedReviewWorktree(OWNED_MANIFEST, branched, OWNED_BACKREF);
  assert(g.ok === false && /detached/.test(g.reason), `Expected detached refusal: ${JSON.stringify(g)}`);
});

test('guard REFUSES the main worktree', () => {
  const main = { ...OWNED_RECORD, isMainWorktree: true };
  const g = reviewPr.isOwnedReviewWorktree(OWNED_MANIFEST, main, OWNED_BACKREF);
  assert(g.ok === false && /main/.test(g.reason), `Expected main refusal: ${JSON.stringify(g)}`);
});

test('guard REFUSES when the target worktree is absent', () => {
  const g = reviewPr.isOwnedReviewWorktree(OWNED_MANIFEST, undefined, OWNED_BACKREF);
  assert(g.ok === false, `Expected refusal when record missing: ${JSON.stringify(g)}`);
});

test('guard REFUSES when the in-worktree back-reference is missing', () => {
  const g = reviewPr.isOwnedReviewWorktree(OWNED_MANIFEST, OWNED_RECORD, null);
  assert(g.ok === false && /back-reference/.test(g.reason), `Expected backref refusal: ${JSON.stringify(g)}`);
});

// ─── REVIEW-PR: injection-class regression (manifest field format) ─────────────
console.log('\n💥 review-pr injection-class regression (assertManifestShape)');

const GOOD_MANIFEST = {
  schemaVersion: '1.0.0', session: 'sess', nonce: 'N', worktreePath: '.worktrees/review-pr-7-sess',
  pr: 7, ref: 'refs/mewkit/review-pr-7-sess', headSha: 'abc', baseSha: 'def', baseBranch: 'main',
  baseRemote: 'origin', host: 'github', owner: 'o', repo: 'r', createdAt: 't',
};

test('assertManifestShape accepts a well-formed manifest', () => {
  assert(reviewPr.assertManifestShape(GOOD_MANIFEST) === GOOD_MANIFEST, 'valid manifest should pass');
});

test('assertManifestShape REJECTS a ref with shell metacharacters (C2 regression)', () => {
  let code = null;
  try { reviewPr.assertManifestShape({ ...GOOD_MANIFEST, ref: 'refs/x ; touch PWNED #' }); } catch (e) { code = e.code; }
  assert(code === 'INVALID_MANIFEST', `Expected INVALID_MANIFEST for injected ref, got: ${code}`);
});

test('assertManifestShape REJECTS a worktreePath outside .worktrees/review-pr- (H1 regression)', () => {
  ['../../etc', '/abs/review-pr-7-sess', '.worktrees/feat-x', '.worktrees/review-pr-7-sess/../..'].forEach((bad) => {
    let code = null;
    try { reviewPr.assertManifestShape({ ...GOOD_MANIFEST, worktreePath: bad }); } catch (e) { code = e.code; }
    assert(code === 'INVALID_MANIFEST', `Expected INVALID_MANIFEST for worktreePath ${bad}, got: ${code}`);
  });
});

test('assertManifestShape REJECTS a ref inconsistent with pr/session', () => {
  let code = null;
  try { reviewPr.assertManifestShape({ ...GOOD_MANIFEST, ref: 'refs/mewkit/review-pr-9-other' }); } catch (e) { code = e.code; }
  assert(code === 'INVALID_MANIFEST', `Expected INVALID_MANIFEST for mismatched ref, got: ${code}`);
});

// ─── REVIEW-PR: CLI validation + dry-run (no network) ──────────────────────────
console.log('\n🌐 review-pr CLI (dry-run, no network)');

test('review-pr --dry-run emits a schema-shaped manifest', () => {
  const json = assertJSON(run('review-pr --pr 7 --remote origin --session ci-dry --dry-run --json').output);
  assert(json.success && json.dryRun, 'should be a successful dry run');
  const m = json.wouldCreate.manifest;
  assert(m.worktreePath === '.worktrees/review-pr-7-ci-dry', `worktreePath: ${m.worktreePath}`);
  assert(m.ref === 'refs/mewkit/review-pr-7-ci-dry', `ref: ${m.ref}`);
  reviewPr.assertManifestShape(m); // throws if a required field is missing
});

test('review-pr rejects a path-unsafe session id at the CLI', () => {
  const r = run('review-pr --pr 7 --remote origin --session bad/slash --json');
  assert(!r.success, 'should fail');
  const json = assertJSON(r.output);
  assert(json.error.code === 'INVALID_SESSION', `Expected INVALID_SESSION, got: ${json.error.code}`);
});

test('review-pr without --pr returns MISSING_PR', () => {
  const json = assertJSON(run('review-pr --remote origin --session x --json').output);
  assert(json.error.code === 'MISSING_PR', `Expected MISSING_PR, got: ${json.error.code}`);
});

test('review-pr without --remote returns MISSING_REMOTE', () => {
  const json = assertJSON(run('review-pr --pr 7 --session x --json').output);
  assert(json.error.code === 'MISSING_REMOTE', `Expected MISSING_REMOTE, got: ${json.error.code}`);
});

test('review-pr-cleanup without --manifest returns MISSING_MANIFEST', () => {
  const json = assertJSON(run('review-pr-cleanup --json').output);
  assert(json.error.code === 'MISSING_MANIFEST', `Expected MISSING_MANIFEST, got: ${json.error.code}`);
});

test('review-pr-cleanup with a nonexistent manifest returns MANIFEST_NOT_FOUND', () => {
  const json = assertJSON(run('review-pr-cleanup --manifest /nope/manifest.json --json').output);
  assert(json.error.code === 'MANIFEST_NOT_FOUND', `Expected MANIFEST_NOT_FOUND, got: ${json.error.code}`);
});

test('review-pr-cleanup --sweep --dry-run lists candidates without applying', () => {
  const json = assertJSON(run('review-pr-cleanup --sweep --dry-run --json').output);
  assert(json.success && json.sweep === true && json.applied === false, `Expected sweep dry-run: ${JSON.stringify(json).slice(0,120)}`);
  assert(Array.isArray(json.worktrees), 'sweep should return a worktrees array');
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n❌ Some tests failed.');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed.');
}
