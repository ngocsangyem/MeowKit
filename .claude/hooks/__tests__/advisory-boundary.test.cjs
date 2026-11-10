// Canonical hook regression test — locks behavior-shaping output of gate-enforcement.cjs.
// Mirrors claudekit's advisory-boundary-policy.test.cjs pattern:
// asserts that critical output strings remain in place across refactors.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const GATE_HOOK = path.join(PROJECT_ROOT, '.claude/hooks/gate-enforcement.cjs');
const PRIVACY_HOOK = path.join(PROJECT_ROOT, '.claude/hooks/privacy-block.cjs');

test('gate-enforcement.cjs exists and is executable', () => {
  assert.ok(fs.existsSync(GATE_HOOK), `gate-enforcement.cjs missing at ${GATE_HOOK}`);
  // Windows has no execute bit to check; the host runs the hook through node there.
  if (process.platform === 'win32') return;
  const stat = fs.statSync(GATE_HOOK);
  assert.ok((stat.mode & 0o111) !== 0, 'gate-enforcement.cjs not executable');
});

test('gate-enforcement.cjs declares the @@GATE_BLOCK@@ sentinel', () => {
  const body = fs.readFileSync(GATE_HOOK, 'utf8');
  assert.match(body, /@@GATE_BLOCK@@/, '@@GATE_BLOCK@@ sentinel removed — would silently break gate enforcement');
});

test('privacy-block.cjs declares the @@PRIVACY_BLOCK@@ sentinel and exit 2', () => {
  assert.ok(fs.existsSync(PRIVACY_HOOK), `privacy-block.cjs missing at ${PRIVACY_HOOK}`);
  const body = fs.readFileSync(PRIVACY_HOOK, 'utf8');
  assert.match(body, /@@PRIVACY_BLOCK@@/, '@@PRIVACY_BLOCK@@ sentinel removed — would break AskUserQuestion handshake');
  assert.match(body, /process\.exit\(2\)/, 'exit 2 removed — privacy block would not be enforced (exit 1 is non-blocking)');
});

test('privacy-block.cjs references AskUserQuestion in stderr guidance', () => {
  const body = fs.readFileSync(PRIVACY_HOOK, 'utf8');
  assert.match(body, /AskUserQuestion/, 'AskUserQuestion reference removed — model would not know how to retry');
});

test('gate-enforcement.cjs cannot be switched off by a hook-profile variable', () => {
  const body = fs.readFileSync(GATE_HOOK, 'utf8');
  // The gate used to carry a comment promising never to honour the profile. Not
  // reading the variable at all is the stronger property, so assert the absence
  // rather than the promise.
  assert.doesNotMatch(
    body,
    /MEOWKIT_HOOK_PROFILE|MEOW_HOOK_PROFILE|MEOW_PROFILE/,
    'the gate reads a hook-profile variable — a profile could bypass it',
  );
});
