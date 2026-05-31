// Canonical hook regression test — locks behavior-shaping output of gate-enforcement.sh.
// Mirrors claudekit's advisory-boundary-policy.test.cjs pattern:
// asserts that critical output strings remain in place across refactors.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const GATE_HOOK = path.join(PROJECT_ROOT, '.claude/hooks/gate-enforcement.sh');
const PRIVACY_HOOK = path.join(PROJECT_ROOT, '.claude/hooks/privacy-block.sh');

test('gate-enforcement.sh exists and is executable', () => {
  assert.ok(fs.existsSync(GATE_HOOK), `gate-enforcement.sh missing at ${GATE_HOOK}`);
  const stat = fs.statSync(GATE_HOOK);
  assert.ok((stat.mode & 0o111) !== 0, 'gate-enforcement.sh not executable');
});

test('gate-enforcement.sh declares the @@GATE_BLOCK@@ sentinel', () => {
  const body = fs.readFileSync(GATE_HOOK, 'utf8');
  assert.match(body, /@@GATE_BLOCK@@/, '@@GATE_BLOCK@@ sentinel removed — would silently break gate enforcement');
});

test('privacy-block.sh declares the @@PRIVACY_BLOCK@@ sentinel and exit 2', () => {
  assert.ok(fs.existsSync(PRIVACY_HOOK), `privacy-block.sh missing at ${PRIVACY_HOOK}`);
  const body = fs.readFileSync(PRIVACY_HOOK, 'utf8');
  assert.match(body, /@@PRIVACY_BLOCK@@/, '@@PRIVACY_BLOCK@@ sentinel removed — would break AskUserQuestion handshake');
  assert.match(body, /exit 2/, 'exit 2 removed — privacy block would not be enforced (exit 1 is non-blocking)');
});

test('privacy-block.sh references AskUserQuestion in stderr guidance', () => {
  const body = fs.readFileSync(PRIVACY_HOOK, 'utf8');
  assert.match(body, /AskUserQuestion/, 'AskUserQuestion reference removed — model would not know how to retry');
});

test('gate-enforcement.sh does not silently skip when CLAUDE_PROJECT_DIR is unset', () => {
  const body = fs.readFileSync(GATE_HOOK, 'utf8');
  // Confirms the safety-critical hook is not gated by MEOW_PROFILE skip; comment must remain
  assert.match(
    body,
    /safety-critical:\s*NEVER skip regardless of profile/i,
    'gate-enforcement.sh comment "NEVER skip regardless of profile" removed — gate could be bypassed by hook profile env var'
  );
});

// --- Typed-event emission wiring (Phase 4 observability) ---
const PRE_TASK_HOOK = path.join(PROJECT_ROOT, '.claude/hooks/pre-task-check.sh');
const EMIT_LIB = path.join(PROJECT_ROOT, '.claude/hooks/lib/emit-event.sh');

test('emit-event.sh lib exists and defines emit_event + the failed-trap installer', () => {
  assert.ok(fs.existsSync(EMIT_LIB), `emit-event.sh missing at ${EMIT_LIB}`);
  const body = fs.readFileSync(EMIT_LIB, 'utf8');
  assert.match(body, /emit_event\(\)/, 'emit_event() function removed');
  assert.match(body, /install_hook_failed_trap\(\)/, 'install_hook_failed_trap() removed');
  assert.match(body, /BASH_VERSION/, 'BASH_VERSION guard removed — trap could error under dash');
});

test('gate-enforcement.sh emits gate.blocked on every block path', () => {
  const body = fs.readFileSync(GATE_HOOK, 'utf8');
  const emits = body.match(/emit_event gate\.blocked/g) || [];
  assert.ok(emits.length >= 4, `expected >=4 gate.blocked emit sites, found ${emits.length}`);
  assert.match(body, /install_hook_failed_trap "gate-enforcement\.sh"/, 'hook.failed trap not installed');
});

test('privacy-block.sh emits privacy.blocked on every block path', () => {
  const body = fs.readFileSync(PRIVACY_HOOK, 'utf8');
  const emits = body.match(/emit_event privacy\.blocked/g) || [];
  assert.ok(emits.length >= 4, `expected >=4 privacy.blocked emit sites, found ${emits.length}`);
});

test('pre-task-check.sh emits injection.blocked at the block branch', () => {
  const body = fs.readFileSync(PRE_TASK_HOOK, 'utf8');
  assert.match(body, /emit_event injection\.blocked/, 'injection.blocked emit removed');
});
