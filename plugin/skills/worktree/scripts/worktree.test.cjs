#!/usr/bin/env node
/**
 * Test suite for worktree.cjs
 * Run: node meowkit/.claude/skills/worktree/scripts/worktree.test.cjs
 *
 * All destructive tests use --dry-run; only info/list/status/prune touch live state.
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, 'worktree.cjs');
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

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n❌ Some tests failed.');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed.');
}
