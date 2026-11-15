// Canonical hook regression test — locks behavior-shaping output of the privacy and ship guards.
// Mirrors claudekit's advisory-boundary-policy.test.cjs pattern:
// asserts that critical output strings remain in place across refactors.
//
// Run with: node --test .claude/hooks/__tests__/

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const SHIP_HOOK = path.join(PROJECT_ROOT, '.claude/hooks/pre-ship.cjs');
const SHIP_CORE = path.join(PROJECT_ROOT, '.claude/hooks/lib/core/pre-ship.cjs');
const PRIVACY_HOOK = path.join(PROJECT_ROOT, '.claude/hooks/privacy-block.cjs');

test('privacy-block.cjs declares the @@PRIVACY_BLOCK@@ sentinel and exit 2', () => {
  assert.ok(fs.existsSync(PRIVACY_HOOK), `privacy-block.cjs missing at ${PRIVACY_HOOK}`);
  const body = fs.readFileSync(PRIVACY_HOOK, 'utf8');
  assert.match(body, /@@PRIVACY_BLOCK@@/, '@@PRIVACY_BLOCK@@ sentinel removed — would break AskUserQuestion handshake');
  assert.match(body, /process\.exit\(2\)/, 'exit 2 removed — privacy block would not be enforced (exit 1 is non-blocking)');
});

test('privacy-block.cjs references AskUserQuestion in stderr guidance', () => {
  // The guidance lines live in the shared decision the hook runs.
  const body = fs.readFileSync(path.join(path.dirname(PRIVACY_HOOK), 'lib/core/privacy.cjs'), 'utf8');
  assert.match(body, /AskUserQuestion/, 'AskUserQuestion reference removed — model would not know how to retry');
});

test('the ship check cannot be switched off by a hook-profile variable', () => {
  // Not reading the variable at all is the stronger property than a promise to
  // ignore it, so assert the absence in the hook and the decision it runs.
  for (const file of [SHIP_HOOK, SHIP_CORE]) {
    assert.doesNotMatch(
      fs.readFileSync(file, 'utf8'),
      /MEOWKIT_HOOK_PROFILE|MEOW_HOOK_PROFILE|MEOW_PROFILE/,
      `${path.basename(file)} reads a hook-profile variable — a profile could bypass the ship check`,
    );
  }
});
